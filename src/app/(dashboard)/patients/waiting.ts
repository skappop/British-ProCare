import { createClient } from '@/lib/supabase/server'
import { clinicDayRange } from '@/lib/clinicDay'
import { getPayStates } from '@/lib/payStatus'
import { needsReception, type PayState } from '@/lib/payState'

export type WaitingRow = {
  appointment_id: string
  patient_id: string
  name: string
  status: 'arrived' | 'in_chair' | 'completed'
  since: string | null
  /** Seen patients only, when asked for: outstanding balance. */
  balance_due: number | null
  /** Seen patients only: where they stand with payment today. */
  pay_state: PayState | null
  clinic_id: string | null
  clinic: string | null
  note: string | null
}

/**
 * Patients checked in and not yet finished, oldest arrival first. With
 * `withSeen` (front-desk staff) it also returns today's seen patients who
 * still owe money, so reception can go straight to their payment.
 */
export async function getWaitingNow(withSeen = false): Promise<WaitingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, status, arrived_at, seated_at, notes, clinic_id, patients(full_name), clinics(name)')
    .in('status', withSeen ? ['arrived', 'in_chair', 'completed'] : ['arrived', 'in_chair'])
    .gte('scheduled_at', new Date(Date.now() - 18 * 3600_000).toISOString())
    .order('arrived_at', { ascending: true })

  if (error || !data) return []

  type Row = {
    id: string; patient_id: string; status: WaitingRow['status']
    arrived_at: string | null; seated_at: string | null; notes: string | null; clinic_id: string | null
    patients: { full_name: string } | { full_name: string }[] | null
    clinics: { name: string } | { name: string }[] | null
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v)

  const rows = data as unknown as Row[]
  const seenIds = rows.filter((r) => r.status === 'completed').map((r) => r.patient_id)
  const { start, end } = clinicDayRange()
  const pay = await getPayStates(supabase, seenIds, start, end)

  return rows
    // A seen patient drops off once settled (paid, or nothing to charge).
    .filter((r) => r.status !== 'completed' || needsReception(pay.get(r.patient_id)?.state ?? 'unknown'))
    .map((r) => ({
      appointment_id: r.id,
      patient_id: r.patient_id,
      name: one(r.patients)?.full_name ?? 'Patient',
      status: r.status,
      since: r.status === 'in_chair' ? r.seated_at ?? r.arrived_at : r.arrived_at,
      balance_due: r.status === 'completed' ? pay.get(r.patient_id)?.due ?? 0 : null,
      pay_state: r.status === 'completed' ? pay.get(r.patient_id)?.state ?? 'unknown' : null,
      clinic_id: r.clinic_id,
      clinic: one(r.clinics)?.name ?? null,
      note: r.notes,
    }))
}
