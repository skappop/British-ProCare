import { createClient } from '@/lib/supabase/server'
import type { CurrentVisit, SeenVisit, Upcoming } from './VisitPanel'

type ApptRow = {
  id: string
  status: string
  scheduled_at: string
  arrived_at: string | null
  seated_at: string | null
  notes: string | null
  duration_minutes: number
  clinic_id: string | null
  clinics: { name: string } | { name: string }[] | null
}

/**
 * The patient's visit today (waiting, in the chair, or booked) and their next
 * few bookings. "Today" is a window around now rather than a calendar day: the
 * server runs on UTC, so its midnight is not the clinic's.
 */
export async function getVisitState(patientId: string): Promise<{
  currentVisit: CurrentVisit | null
  currentClinicId: string | null
  seenToday: SeenVisit | null
  upcoming: Upcoming[]
}> {
  const supabase = await createClient()
  const now = Date.now()

  const { data } = await supabase
    .from('appointments')
    .select('id, status, scheduled_at, arrived_at, seated_at, notes, duration_minutes, clinic_id, clinics(name)')
    .eq('patient_id', patientId)
    .in('status', ['scheduled', 'arrived', 'in_chair', 'completed'])
    .gte('scheduled_at', new Date(now - 18 * 3600_000).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  const appts = ((data ?? []) as unknown as ApptRow[]).map((a) => ({
    ...a,
    clinic: (Array.isArray(a.clinics) ? a.clinics[0]?.name : a.clinics?.name) ?? null,
  }))

  const live = appts.find((a) => a.status === 'arrived' || a.status === 'in_chair')
  const bookedToday = appts.find(
    (a) => a.status === 'scheduled' && Math.abs(new Date(a.scheduled_at).getTime() - now) < 12 * 3600_000
  )
  const current = live ?? bookedToday ?? null
  // Finished today (only matters when nothing else is open for them).
  const seen = current
    ? null
    : [...appts].reverse().find((a) => a.status === 'completed' && new Date(a.scheduled_at).getTime() <= now + 3600_000)

  return {
    currentVisit: current
      ? {
          id: current.id,
          status: current.status as CurrentVisit['status'],
          scheduled_at: current.scheduled_at,
          arrived_at: current.arrived_at,
          seated_at: current.seated_at,
          clinic: current.clinic,
          notes: current.notes,
        }
      : null,
    currentClinicId: current?.clinic_id ?? seen?.clinic_id ?? null,
    seenToday: seen ? { id: seen.id, clinic: seen.clinic } : null,
    upcoming: appts
      .filter((a) => a.status === 'scheduled' && a.id !== current?.id && new Date(a.scheduled_at).getTime() > now)
      .slice(0, 3)
      .map((a) => ({ id: a.id, scheduled_at: a.scheduled_at, clinic: a.clinic, duration_minutes: a.duration_minutes })),
  }
}
