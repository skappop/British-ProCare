'use server'

// Wizard-friendly server actions for the guided Walk-In flow.
//
// These mirror the shapes of the existing patient/intake actions but RETURN
// their result instead of calling redirect(), so the client-side stepper can
// react and advance. The heavy lifting (logVisit, takePayment,
// createAppointment, getBomPreview, …) is reused from the existing modules —
// nothing here duplicates that logic.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MedicalHistory, PatientSafety, ReceptionPatient } from './types'

export async function searchWalkInPatients(query: string): Promise<ReceptionPatient[]> {
  const supabase = await createClient()
  const q = query?.trim()
  if (!q || q.length < 2) return []

  const { data } = await supabase
    .from('patients')
    .select('id, full_name, phone, file_number, is_ortho')
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,file_number.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(8)

  return (data as ReceptionPatient[]) || []
}

export async function quickCreatePatient(payload: {
  full_name: string
  phone?: string
  file_number?: string
  date_of_birth?: string
  gender?: string
  is_ortho?: boolean
}): Promise<{ ok: boolean; message?: string; patient?: ReceptionPatient }> {
  const supabase = await createClient()

  const full_name = payload.full_name?.trim()
  if (!full_name) return { ok: false, message: 'Enter the patient’s name to continue' }

  const { data, error } = await supabase
    .from('patients')
    .insert({
      full_name,
      phone: payload.phone?.trim() || null,
      file_number: payload.file_number?.trim() || null,
      date_of_birth: payload.date_of_birth || null,
      gender: payload.gender || null,
      is_ortho: !!payload.is_ortho,
    })
    .select('id, full_name, phone, file_number, is_ortho')
    .single()

  if (error || !data) {
    return { ok: false, message: error?.message || 'Could not create the patient' }
  }

  revalidatePath('/patients')
  return { ok: true, patient: data as ReceptionPatient }
}

export async function getPatientSafety(patientId: string): Promise<PatientSafety> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('patients')
    .select('medical_history, consent_signed_at, is_ortho')
    .eq('id', patientId)
    .single()

  return {
    medical_history: (data?.medical_history as MedicalHistory) || null,
    consent_signed_at: (data?.consent_signed_at as string) || null,
    is_ortho: !!data?.is_ortho,
  }
}

export async function quickSaveIntake(
  patientId: string,
  payload: {
    allergies?: string
    conditions?: string
    medications?: string
    pregnant?: boolean
    notes?: string
    consent?: boolean
  }
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()

  const medical_history: MedicalHistory = {
    allergies: payload.allergies?.trim() || null,
    conditions: payload.conditions?.trim() || null,
    medications: payload.medications?.trim() || null,
    pregnant: !!payload.pregnant,
    notes: payload.notes?.trim() || null,
  }

  const updates: Record<string, unknown> = { medical_history }
  if (payload.consent) updates.consent_signed_at = new Date().toISOString()

  const { error } = await supabase.from('patients').update(updates).eq('id', patientId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath(`/patients/${patientId}/intake`)
  return { ok: true }
}

// Current tooth chart for the walk-in charting panel (reuses patients.odontogram).
export async function getOdontogram(patientId: string): Promise<Record<string, { status: string; note?: string }>> {
  const supabase = await createClient()
  const { data } = await supabase.from('patients').select('odontogram').eq('id', patientId).single()
  return (data?.odontogram as Record<string, { status: string; note?: string }>) || {}
}

// logVisit() (the existing RPC action) returns { ok, message } but not the new
// visit id. For a single-desk reception flow the just-logged visit is always the
// patient's most recent one, so we fetch it here to wire up payment + receipt.
export async function getLatestVisit(
  patientId: string
): Promise<{ id: string; fee_charged: number | null } | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('visits')
    .select('id, fee_charged, visit_date')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { id: data.id as string, fee_charged: (data.fee_charged as number) ?? null }
}

// When the walk-in came from a booked appointment, close the loop: attach the
// visit and mark the appointment completed (feeds Recall + the dashboard).
export async function linkAppointmentToVisit(
  appointmentId: string,
  visitId: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ visit_id: visitId, status: 'completed' })
    .eq('id', appointmentId)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/appointments')
  revalidatePath('/')
  revalidatePath('/recall')
  return { ok: true }
}

/**
 * Hands a patient over to a clinic's day board.
 *
 * Creates the appointment already checked in, so the doctor sees them in the
 * Waiting lane the moment reception sends them — no booking step, no refresh.
 */
export async function sendPatientToClinic(
  patientId: string,
  clinicId: string,
  notes?: string,
  bookedAppointmentId?: string | null
): Promise<{ ok: boolean; message?: string; appointmentId?: string }> {
  const supabase = await createClient()

  if (!patientId) return { ok: false, message: 'No patient selected' }
  if (!clinicId) return { ok: false, message: 'Choose a clinic to send the patient to' }

  const now = new Date().toISOString()
  const note = notes?.trim() || null

  // A patient picked from "Booked today" already has an appointment. Route that
  // one rather than adding a second, which left the booking stranded in
  // Scheduled and put the patient on the board twice. Anything past check-in
  // (seated, seen) is a finished visit, so a return trip today gets a new row.
  let existing: { id: string; status: string; notes: string | null } | null = null
  if (bookedAppointmentId) {
    const { data: booked } = await supabase
      .from('appointments')
      .select('id, status, notes')
      .eq('id', bookedAppointmentId)
      .eq('patient_id', patientId)
      .maybeSingle()

    if (booked && (booked.status === 'scheduled' || booked.status === 'arrived')) {
      existing = booked
    }
  }

  const { data, error } = existing
    ? await supabase
        .from('appointments')
        .update({
          clinic_id: clinicId,
          status: 'arrived',
          arrived_at: now,
          notes: note ? [existing.notes, note].filter(Boolean).join(' — ') : existing.notes,
        })
        .eq('id', existing.id)
        .select('id')
        .single()
    : await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
          scheduled_at: now,
          arrived_at: now,
          status: 'arrived',
          duration_minutes: 30,
          notes: note,
        })
        .select('id')
        .single()

  if (error) {
    // Point at the migration that is actually missing rather than echoing a
    // Postgres message nobody at a reception desk can act on.
    const detail = error.message.toLowerCase()

    let message = error.message
    if (detail.includes('clinic_id') || detail.includes('clinics')) {
      message =
        'Clinics are not set up yet — run migration 13_clinics_and_realtime.sql in Supabase.'
    } else if (
      detail.includes('arrived_at') ||
      detail.includes('seated_at') ||
      detail.includes('appointments_status_check')
    ) {
      message =
        'Check-in is not set up yet — run migration 07_appointments_workflow.sql in Supabase. ' +
        'It adds the arrived/in-chair steps this uses.'
    }

    return { ok: false, message }
  }

  revalidatePath('/appointments')
  revalidatePath('/reception')

  return { ok: true, appointmentId: data.id }
}

/** Clinics available to send a patient to. */
export async function getClinicOptions(): Promise<
  { id: string; name: string; short_name: string | null }[]
> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('clinics')
    .select('id, name, short_name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return data ?? []
}

// ---------------------------------------------------------------------------
// Online pre-registration
// ---------------------------------------------------------------------------

export type PendingRegistration = {
  id: string
  created_at: string
  full_name: string
  phone: string
  reason: string | null
  preferred_clinic: string | null
  has_history: boolean
  health_note: string | null
  match: { id: string; full_name: string; file_number: string | null } | null
}

function digits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

// Egyptian numbers turn up as 010…, +2010…, 002010…; the last nine digits are
// the part that is always the same.
function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const x = digits(a)
  const y = digits(b)
  return x.length >= 8 && y.length >= 8 && x.slice(-9) === y.slice(-9)
}

export async function getPendingRegistrations(): Promise<PendingRegistration[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: regs, error } = await supabase
    .from('patient_registrations')
    .select('id, created_at, full_name, phone, reason, medical_history, preferred_clinic_id, clinics(name)')
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)

  // Before migration 14 the table does not exist; reception simply shows none.
  if (error || !regs) return []

  type RegRow = {
    id: string
    created_at: string
    full_name: string
    phone: string
    reason: string | null
    medical_history: Record<string, unknown> | null
    clinics: { name: string } | { name: string }[] | null
  }

  const results: PendingRegistration[] = []
  for (const reg of regs as unknown as RegRow[]) {
    // Stored numbers carry spaces, dashes and country codes, so match on the
    // trailing digits with anything allowed between them, then confirm exactly.
    const tail = digits(reg.phone).slice(-7)
    let match: PendingRegistration['match'] = null
    if (tail.length === 7) {
      const { data: candidates } = await supabase
        .from('patients')
        .select('id, full_name, file_number, phone')
        .ilike('phone', `%${tail.split('').join('%')}%`)
        .limit(5)
      const hit = (candidates ?? []).find((p) => samePhone(p.phone, reg.phone))
      if (hit) match = { id: hit.id, full_name: hit.full_name, file_number: hit.file_number }
    }

    const history = reg.medical_history || {}
    results.push({
      id: reg.id,
      created_at: reg.created_at,
      full_name: reg.full_name,
      phone: reg.phone,
      reason: reg.reason,
      preferred_clinic: (Array.isArray(reg.clinics) ? reg.clinics[0]?.name : reg.clinics?.name) ?? null,
      has_history: !!(history.allergies || history.conditions || history.medications || history.pregnant || history.notes),
      health_note: typeof history.notes === 'string' ? history.notes : null,
      match,
    })
  }

  return results
}

/**
 * Turns a pre-registration into a patient at the desk. `target` is 'new' to
 * create a record, or an existing patient's id when reception has confirmed
 * it is the same person.
 *
 * The self-reported medical history replaces what is on file — it is the
 * patient's most recent account, and the Safety step shows it for review next.
 * Treatment consent is not carried over: the online form only confirms the
 * details are accurate, which is not consent to examination and treatment.
 */
export async function acceptRegistration(
  registrationId: string,
  target: 'new' | string
): Promise<{ ok: boolean; message?: string; patient?: ReceptionPatient; reason?: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: reg } = await supabase
    .from('patient_registrations')
    .select('*')
    .eq('id', registrationId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!reg) return { ok: false, message: 'This registration was already handled.' }

  let patient: ReceptionPatient | null = null

  if (target === 'new') {
    const { data, error } = await supabase
      .from('patients')
      .insert({
        full_name: reg.full_name,
        phone: reg.phone,
        date_of_birth: reg.date_of_birth,
        gender: reg.gender,
        medical_history: reg.medical_history,
      })
      .select('id, full_name, phone, file_number, is_ortho')
      .single()

    if (error) return { ok: false, message: error.message }
    patient = { ...data, is_ortho: !!data.is_ortho }
  } else {
    const { data: existing } = await supabase
      .from('patients')
      .select('id, full_name, phone, file_number, is_ortho, date_of_birth, gender')
      .eq('id', target)
      .maybeSingle()

    if (!existing) return { ok: false, message: 'That patient could not be found.' }

    // Only fill gaps in the demographics; never overwrite what staff entered.
    const updates: Record<string, unknown> = { medical_history: reg.medical_history }
    if (!existing.phone && reg.phone) updates.phone = reg.phone
    if (!existing.date_of_birth && reg.date_of_birth) updates.date_of_birth = reg.date_of_birth
    if (!existing.gender && reg.gender) updates.gender = reg.gender

    const { error } = await supabase.from('patients').update(updates).eq('id', existing.id)
    if (error) return { ok: false, message: error.message }

    patient = {
      id: existing.id,
      full_name: existing.full_name,
      phone: existing.phone ?? reg.phone,
      file_number: existing.file_number,
      is_ortho: !!existing.is_ortho,
    }
  }

  await supabase
    .from('patient_registrations')
    .update({
      status: 'accepted',
      patient_id: patient.id,
      handled_at: new Date().toISOString(),
      handled_by: user?.id ?? null,
    })
    .eq('id', registrationId)

  revalidatePath('/patients')
  // The patient's own words for why they came, so the Send step can pass it
  // to the doctor instead of it being lost here.
  return { ok: true, patient, reason: reg.reason ?? null }
}

export async function dismissRegistration(registrationId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('patient_registrations')
    .update({ status: 'dismissed', handled_at: new Date().toISOString(), handled_by: user?.id ?? null })
    .eq('id', registrationId)
    .eq('status', 'pending')

  return { ok: !error }
}
