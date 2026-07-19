'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function saveIntake(patientId: string, formData: FormData) {
  const supabase = await createClient()

  const allergies = formData.get('allergies') as string
  const conditions = formData.get('conditions') as string
  const medications = formData.get('medications') as string
  const pregnant = formData.get('pregnant') === 'on'
  const notes = formData.get('notes') as string
  const consentGiven = formData.get('consent') === 'on'

  const medicalHistory = {
    allergies: allergies || null,
    conditions: conditions || null,
    medications: medications || null,
    pregnant,
    notes: notes || null,
  }

  const updates: Record<string, any> = { medical_history: medicalHistory }
  if (consentGiven) {
    updates.consent_signed_at = new Date().toISOString()
  }

  const { error } = await supabase.from('patients').update(updates).eq('id', patientId)

  if (error) {
    redirect(`/patients/${patientId}/intake?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath(`/patients/${patientId}/intake`)
  redirect(`/patients/${patientId}`)
}
