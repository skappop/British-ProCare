'use server'

// Wizard-friendly server actions for the guided Walk-In flow.
//
// These mirror the shapes of the existing patient/intake actions but RETURN
// their result instead of calling redirect(), so the client-side stepper can
// react and advance. The heavy lifting (logVisit, recordPayment,
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
  notes?: string
): Promise<{ ok: boolean; message?: string; appointmentId?: string }> {
  const supabase = await createClient()

  if (!patientId) return { ok: false, message: 'No patient selected' }
  if (!clinicId) return { ok: false, message: 'Choose a clinic to send the patient to' }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      clinic_id: clinicId,
      scheduled_at: now,
      arrived_at: now,
      status: 'arrived',
      duration_minutes: 30,
      notes: notes?.trim() || null,
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
