import { NextResponse } from 'next/server'
import { bridgeAdminClient, bridgeAuthError, missingServiceRole, noStore } from '@/lib/bridge'
import { OPEN_STATUSES, UUID_RE } from '@/lib/imaging'

export const dynamic = 'force-dynamic'

/**
 * The background agent's heartbeat, every few seconds. In one round trip it
 * registers the PC (so it appears in the website's station list), marks it
 * online, and collects any imaging session the doctor has asked this PC to run.
 *
 * `current_session_id` is the session the agent is already working on; its
 * status comes back so the agent learns about a cancel or an End press
 * without a second request.
 */
export async function POST(request: Request) {
  const unauthorized = bridgeAuthError(request)
  if (unauthorized) return unauthorized

  const admin = bridgeAdminClient()
  if (!admin) return missingServiceRole()

  const body = await request.json().catch(() => null)
  const stationId: string = body?.station_id ?? ''
  const name = String(body?.name ?? '').trim().slice(0, 80)
  const clinicId: string | null = UUID_RE.test(body?.clinic_id ?? '') ? body.clinic_id : null
  const currentSessionId: string | null = UUID_RE.test(body?.current_session_id ?? '')
    ? body.current_session_id
    : null

  if (!UUID_RE.test(stationId)) {
    return NextResponse.json({ error: 'station_id must be a UUID' }, { status: 400, headers: noStore })
  }
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400, headers: noStore })
  }

  const { error: stationError } = await admin.from('imaging_stations').upsert(
    {
      id: stationId,
      name,
      clinic_id: clinicId,
      last_seen_at: new Date().toISOString(),
      agent_version: String(body?.version ?? '').slice(0, 40) || null,
      capabilities: typeof body?.capabilities === 'object' && body.capabilities ? body.capabilities : {},
    },
    { onConflict: 'id' }
  )

  if (stationError) {
    const hint = stationError.message.includes('imaging_stations')
      ? ' — run migration 15_imaging_sessions.sql'
      : ''
    return NextResponse.json({ error: stationError.message + hint }, { status: 500, headers: noStore })
  }

  const { data: open } = await admin
    .from('imaging_sessions')
    .select('id, patient_id, mode, status, end_requested, created_at, patients(full_name)')
    .eq('station_id', stationId)
    .in('status', OPEN_STATUSES as unknown as string[])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let current: { id: string; status: string; end_requested: boolean } | null = null
  if (currentSessionId) {
    const { data } = await admin
      .from('imaging_sessions')
      .select('id, status, end_requested')
      .eq('id', currentSessionId)
      .eq('station_id', stationId)
      .maybeSingle()
    current = data
  }

  const patient = open?.patients as { full_name?: string } | { full_name?: string }[] | null | undefined
  const patientName = Array.isArray(patient) ? patient[0]?.full_name : patient?.full_name

  return NextResponse.json(
    {
      ok: true,
      session: open
        ? {
            id: open.id,
            patient_id: open.patient_id,
            patient_name: patientName ?? null,
            mode: open.mode,
            status: open.status,
            end_requested: open.end_requested,
          }
        : null,
      current,
    },
    { headers: noStore }
  )
}
