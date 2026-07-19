'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function revalidateAll() {
  revalidatePath('/appointments')
  revalidatePath('/')
  revalidatePath('/recall')
}

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const duration = formData.get('duration') as string
  const notes = formData.get('notes') as string

  if (!patientId || !date || !time) {
    return { ok: false, message: 'Pick a patient, date, and time' }
  }

  const scheduledAt = new Date(`${date}T${time}:00`)

  const { error } = await supabase.from('appointments').insert({
    patient_id: patientId,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: duration ? parseInt(duration) : 30,
    notes: notes || null,
  })

  if (error) return { ok: false, message: error.message }

  revalidateAll()
  return { ok: true, message: 'Appointment booked' }
}

// Advance an appointment through the day pipeline. Stamps arrival / seating
// times so the Day Tracker can show how long a patient has been waiting.
export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const supabase = await createClient()

  const updates: Record<string, unknown> = { status }
  const now = new Date().toISOString()
  if (status === 'arrived') updates.arrived_at = now
  if (status === 'in_chair') updates.seated_at = now

  const { error } = await supabase.from('appointments').update(updates).eq('id', appointmentId)
  if (error) return { ok: false, message: error.message }

  revalidateAll()
  return { ok: true, message: `Marked as ${status.replace('_', ' ')}` }
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
