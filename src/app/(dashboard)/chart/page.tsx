import { createClient } from '@/lib/supabase/server'
import LiveRefresh from '@/components/LiveRefresh'
import ChartPicker, { type ChartRow } from './ChartPicker'

export const dynamic = 'force-dynamic'

type One<T> = T | T[] | null
const one = <T,>(v: One<T>) => (Array.isArray(v) ? v[0] ?? null : v)

/**
 * Quick chart: the assistant's way in from a phone. Whoever is under the
 * camera right now comes first, then everyone here today; one tap opens the
 * chart and nothing else.
 */
/** "Today" as a window around now: the server runs on UTC, not clinic time. */
function todayWindow() {
  const now = Date.now()
  return { since: new Date(now - 18 * 3600_000).toISOString(), until: new Date(now + 12 * 3600_000).toISOString() }
}

export default async function QuickChartPage() {
  const supabase = await createClient()
  const { since, until } = todayWindow()

  const [camera, today] = await Promise.all([
    // Needs migration 15; without it this simply returns nothing.
    supabase
      .from('imaging_sessions')
      .select('patient_id, status, patients(full_name, file_number), imaging_stations(name, clinic_id)')
      .in('status', ['requested', 'active', 'uploading'])
      .order('created_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('patient_id, status, arrived_at, scheduled_at, clinic_id, patients(full_name, file_number), clinics(name)')
      .in('status', ['arrived', 'in_chair', 'scheduled', 'completed'])
      .gte('scheduled_at', since)
      .lte('scheduled_at', until)
      .order('scheduled_at', { ascending: true }),
  ])

  type CameraRow = {
    patient_id: string
    patients: One<{ full_name: string; file_number: string | null }>
    imaging_stations: One<{ name: string; clinic_id: string | null }>
  }
  type ApptRow = {
    patient_id: string
    status: string
    arrived_at: string | null
    clinic_id: string | null
    patients: One<{ full_name: string; file_number: string | null }>
    clinics: One<{ name: string }>
  }

  const rows: ChartRow[] = []
  const seen = new Set<string>()
  for (const r of (camera.data ?? []) as unknown as CameraRow[]) {
    if (seen.has(r.patient_id)) continue
    seen.add(r.patient_id)
    const station = one(r.imaging_stations)
    rows.push({
      patient_id: r.patient_id,
      name: one(r.patients)?.full_name ?? 'Patient',
      file_number: one(r.patients)?.file_number ?? null,
      group: 'camera',
      detail: station?.name ? `Camera on · ${station.name}` : 'Camera on',
      clinic_id: station?.clinic_id ?? null,
    })
  }
  const order: Record<string, number> = { arrived: 0, in_chair: 0, scheduled: 1, completed: 2 }
  const appts = ((today.data ?? []) as unknown as ApptRow[]).sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
  for (const r of appts) {
    if (seen.has(r.patient_id)) continue
    seen.add(r.patient_id)
    const here = r.status === 'arrived' || r.status === 'in_chair'
    rows.push({
      patient_id: r.patient_id,
      name: one(r.patients)?.full_name ?? 'Patient',
      file_number: one(r.patients)?.file_number ?? null,
      group: here ? 'here' : r.status === 'completed' ? 'seen' : 'booked',
      detail: one(r.clinics)?.name ?? null,
      clinic_id: r.clinic_id,
    })
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold-deep font-mono">Chairside</p>
          <h1 className="font-display text-2xl text-ink-strong">Quick chart</h1>
        </div>
        <LiveRefresh tables={['appointments', 'imaging_sessions']} />
      </div>
      <ChartPicker rows={rows} />
    </div>
  )
}
