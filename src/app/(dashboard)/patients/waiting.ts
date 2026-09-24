import { createClient } from '@/lib/supabase/server'

export type WaitingRow = {
  appointment_id: string
  patient_id: string
  name: string
  status: 'arrived' | 'in_chair'
  since: string | null
  clinic_id: string | null
  clinic: string | null
  note: string | null
}

/** Patients checked in and not yet finished, oldest arrival first. */
export async function getWaitingNow(): Promise<WaitingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, status, arrived_at, seated_at, notes, clinic_id, patients(full_name), clinics(name)')
    .in('status', ['arrived', 'in_chair'])
    .gte('scheduled_at', new Date(Date.now() - 18 * 3600_000).toISOString())
    .order('arrived_at', { ascending: true })

  if (error || !data) return []

  type Row = {
    id: string; patient_id: string; status: 'arrived' | 'in_chair'
    arrived_at: string | null; seated_at: string | null; notes: string | null; clinic_id: string | null
    patients: { full_name: string } | { full_name: string }[] | null
    clinics: { name: string } | { name: string }[] | null
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v)

  return (data as unknown as Row[]).map((r) => ({
    appointment_id: r.id,
    patient_id: r.patient_id,
    name: one(r.patients)?.full_name ?? 'Patient',
    status: r.status,
    since: r.status === 'in_chair' ? r.seated_at : r.arrived_at,
    clinic_id: r.clinic_id,
    clinic: one(r.clinics)?.name ?? null,
    note: r.notes,
  }))
}
