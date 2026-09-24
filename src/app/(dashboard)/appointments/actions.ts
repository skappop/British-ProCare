'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function revalidateAll() {
  revalidatePath('/appointments')
  revalidatePath('/')
  revalidatePath('/recall')
}

export async function createAppointment(formData: FormData): Promise<{ ok: boolean; message: string; duplicate?: boolean }> {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const duration = formData.get('duration') as string
  const notes = formData.get('notes') as string

  // Prefer the exact instant the browser computed. Building it here from the
  // bare date and time would read them as UTC (the server's zone), shifting
  // every booking by the clinic's offset.
  const iso = formData.get('scheduled_at') as string | null
  const scheduledAt = iso ? new Date(iso) : new Date(`${date}T${time}:00`)

  if (!patientId || Number.isNaN(scheduledAt.getTime()) || (!iso && (!date || !time))) {
    return { ok: false, message: 'Pick a patient, date, and time' }
  }

  // "Decide on arrival": no clinic yet; it is chosen at check-in.
  const clinicId = (formData.get('clinic_id') as string) || null

  // The same patient booked twice on one day is usually a slip (booked from
  // two places, or rebooked without removing the first): ask first.
  if (formData.get('allow_second') !== '1') {
    const dayStart = new Date(scheduledAt)
    dayStart.setHours(dayStart.getHours() - 12)
    const dayEnd = new Date(scheduledAt)
    dayEnd.setHours(dayEnd.getHours() + 12)
    const { data: same } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('patient_id', patientId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .limit(1)
    if (same?.length) {
      const at = new Date(same[0].scheduled_at as string).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
      })
      return { ok: false, duplicate: true, message: `This patient is already booked for ${at}. Book another one as well?` }
    }
  }

  const { error } = await supabase.from('appointments').insert({
    patient_id: patientId,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: duration ? parseInt(duration) : 30,
    notes: notes || null,
    ...(clinicId ? { clinic_id: clinicId } : {}),
  })

  if (error) return { ok: false, message: error.message }

  revalidateAll()
  return { ok: true, message: 'Appointment booked' }
}

// Advance an appointment through the day pipeline. Stamps arrival / seating
// times so the Day Tracker can show how long a patient has been waiting.
export async function updateAppointmentStatus(appointmentId: string, status: string, clinicId?: string | null) {
  const supabase = await createClient()

  const updates: Record<string, unknown> = { status }
  // Checking in a patient booked as "decide on arrival": the clinic chosen now.
  if (clinicId) updates.clinic_id = clinicId
  const now = new Date().toISOString()
  if (status === 'arrived') updates.arrived_at = now
  if (status === 'in_chair') updates.seated_at = now

  const { error } = await supabase.from('appointments').update(updates).eq('id', appointmentId)
  if (error) return { ok: false, message: error.message }

  revalidateAll()
  return { ok: true, message: `Marked as ${status.replace('_', ' ')}` }
}

/** Choose the clinic for a patient booked as "decide on arrival". */
export async function setAppointmentClinic(appointmentId: string, clinicId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('appointments').update({ clinic_id: clinicId }).eq('id', appointmentId)
  if (error) return { ok: false, message: error.message }
  revalidateAll()
  revalidatePath('/reception')
  revalidatePath('/patients')
  return { ok: true }
}

export async function deleteAppointment(appointmentId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('appointments').delete().eq('id', appointmentId)
  if (error) return { ok: false, message: error.message }

  revalidateAll()
  return { ok: true, message: 'Appointment removed' }
}

export async function searchPatientsForBooking(query: string) {
  const supabase = await createClient()
  if (!query || query.length < 2) return []

  const { data } = await supabase
    .from('patients')
    .select('id, full_name, phone, file_number')
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,file_number.ilike.%${query}%`)
    .limit(8)

  return data || []
}

export type DayBooking = { at: string; name: string; clinic: string | null; clinic_id: string | null; status: string }

/** What is already booked in a window (a day), so a free time can be picked. */
export async function getBookingsBetween(fromIso: string, toIso: string): Promise<DayBooking[]> {
  const supabase = await createClient()
  const query = (columns: string) =>
    supabase
      .from('appointments')
      .select(columns)
      .gte('scheduled_at', fromIso)
      .lt('scheduled_at', toIso)
      .not('status', 'in', '(cancelled,no_show)')
      .order('scheduled_at')
  let { data, error } = await query('scheduled_at, status, clinic_id, patients(full_name), clinics(short_name, name)')
  // Before migration 13 there are no clinics to name.
  if (error) ({ data, error } = await query('scheduled_at, status, patients(full_name)'))
  type Row = {
    scheduled_at: string
    status: string
    clinic_id?: string | null
    patients: { full_name: string } | { full_name: string }[] | null
    clinics?: { short_name: string | null; name: string } | { short_name: string | null; name: string }[] | null
  }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v)
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    at: r.scheduled_at,
    status: r.status,
    name: one(r.patients)?.full_name ?? 'Patient',
    clinic: one(r.clinics ?? null)?.short_name ?? one(r.clinics ?? null)?.name ?? null,
    clinic_id: r.clinic_id ?? null,
  }))
}
