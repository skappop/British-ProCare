'use server'

import { createClient } from '@/lib/supabase/server'
import { OPEN_STATUSES, STATION_ONLINE_MS, UUID_RE, type ImagingMode } from '@/lib/imaging'

export type StationView = {
  id: string
  name: string
  clinic: string | null
  clinic_id: string | null
  last_seen_at: string | null
  capabilities: { intraoral?: boolean; xray?: boolean }
  busy: { session_id: string; patient_id: string; patient_name: string | null } | null
}

export type SessionView = {
  id: string
  station_id: string
  station_name: string | null
  mode: ImagingMode
  status: string
  end_requested: boolean
  images_captured: number
  images_uploaded: number
  images_failed: number
  message: string | null
  created_at: string
  ended_at: string | null
}

export type ImagingState = {
  ready: boolean
  stations: StationView[]
  open: SessionView | null
  last: SessionView | null
  serverNow: number
}

type Joined<T> = T | T[] | null | undefined
const one = <T,>(value: Joined<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null)

function toSession(row: Record<string, unknown>): SessionView {
  const station = one(row.imaging_stations as Joined<{ name: string }>)
  return {
    id: row.id as string,
    station_id: row.station_id as string,
    station_name: station?.name ?? null,
    mode: row.mode as ImagingMode,
    status: row.status as string,
    end_requested: !!row.end_requested,
    images_captured: (row.images_captured as number) ?? 0,
    images_uploaded: (row.images_uploaded as number) ?? 0,
    images_failed: (row.images_failed as number) ?? 0,
    message: (row.message as string) ?? null,
    created_at: row.created_at as string,
    ended_at: (row.ended_at as string) ?? null,
  }
}

const SESSION_COLUMNS =
  'id, station_id, mode, status, end_requested, images_captured, images_uploaded, images_failed, message, created_at, ended_at, imaging_stations(name)'

export async function getImagingState(patientId: string): Promise<ImagingState> {
  const supabase = await createClient()
  const empty: ImagingState = { ready: false, stations: [], open: null, last: null, serverNow: Date.now() }

  const { data: stations, error } = await supabase
    .from('imaging_stations')
    .select('id, name, clinic_id, last_seen_at, capabilities, clinics(name)')
    .order('name', { ascending: true })

  // No table yet means migration 15 has not been run.
  if (error) return empty

  const { data: busyRows } = await supabase
    .from('imaging_sessions')
    .select('id, station_id, patient_id, patients(full_name)')
    .in('status', OPEN_STATUSES as unknown as string[])

  const busyByStation = new Map(
    (busyRows ?? []).map((r) => [
      r.station_id,
      {
        session_id: r.id,
        patient_id: r.patient_id,
        patient_name: one(r.patients as Joined<{ full_name: string }>)?.full_name ?? null,
      },
    ])
  )

  const { data: open } = await supabase
    .from('imaging_sessions')
    .select(SESSION_COLUMNS)
    .eq('patient_id', patientId)
    .in('status', OPEN_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: last } = await supabase
    .from('imaging_sessions')
    .select(SESSION_COLUMNS)
    .eq('patient_id', patientId)
    .in('status', ['completed', 'failed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    ready: true,
    serverNow: Date.now(),
    stations: (stations ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      clinic_id: s.clinic_id,
      clinic: one(s.clinics as Joined<{ name: string }>)?.name ?? null,
      last_seen_at: s.last_seen_at,
      capabilities: (s.capabilities as StationView['capabilities']) ?? {},
      busy: busyByStation.get(s.id) ?? null,
    })),
    open: open ? toSession(open as Record<string, unknown>) : null,
    last: last ? toSession(last as Record<string, unknown>) : null,
  }
}

export async function startImaging(
  patientId: string,
  stationId: string,
  mode: ImagingMode
): Promise<{ ok: boolean; message?: string }> {
  if (!UUID_RE.test(patientId) || !UUID_RE.test(stationId)) return { ok: false, message: 'Invalid request' }
  if (!['intraoral', 'xray', 'both'].includes(mode)) return { ok: false, message: 'Invalid imaging type' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: station } = await supabase
    .from('imaging_stations')
    .select('id, name, clinic_id, last_seen_at')
    .eq('id', stationId)
    .maybeSingle()

  if (!station) return { ok: false, message: 'That computer is not registered.' }

  // Queueing work for a PC that is switched off would leave the doctor staring
  // at "Opening the camera…" forever. Say so now instead.
  const seen = station.last_seen_at ? new Date(station.last_seen_at).getTime() : 0
  if (Date.now() - seen > STATION_ONLINE_MS) {
    return { ok: false, message: `${station.name} is offline. Check the PC is on and the agent is running.` }
  }

  const { error } = await supabase.from('imaging_sessions').insert({
    station_id: station.id,
    patient_id: patientId,
    clinic_id: station.clinic_id,
    mode,
    requested_by: user?.id ?? null,
  })

  if (error) {
    if (error.code === '23505' || error.message.includes('one_open_per_station')) {
      return { ok: false, message: `${station.name} is already imaging another patient. End that session first.` }
    }
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

/** Ask the agent to finish: upload whatever is left, then close the software. */
export async function endImaging(sessionId: string): Promise<{ ok: boolean; message?: string }> {
  if (!UUID_RE.test(sessionId)) return { ok: false, message: 'Invalid request' }
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('imaging_sessions')
    .select('status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return { ok: false, message: 'Session not found' }

  // The agent never picked it up, so there is nothing to upload: just close it.
  if (session.status === 'requested') return cancelImaging(sessionId)

  const { error } = await supabase
    .from('imaging_sessions')
    .update({ end_requested: true })
    .eq('id', sessionId)
    .in('status', ['active', 'uploading'])

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Stop without finishing. Images already uploaded stay in the gallery. */
export async function cancelImaging(sessionId: string): Promise<{ ok: boolean; message?: string }> {
  if (!UUID_RE.test(sessionId)) return { ok: false, message: 'Invalid request' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('imaging_sessions')
    .update({ status: 'cancelled', ended_at: new Date().toISOString(), message: 'Cancelled from the website' })
    .eq('id', sessionId)
    .in('status', OPEN_STATUSES as unknown as string[])

  return error ? { ok: false, message: error.message } : { ok: true }
}
