'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createLabCase(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const caseType = formData.get('case_type') as string
  const labName = formData.get('lab_name') as string
  const dueAt = formData.get('due_at') as string
  const labFee = formData.get('lab_fee') as string
  const notes = formData.get('notes') as string

  if (!patientId || !caseType) {
    return { ok: false, message: 'Patient and case type are required' }
  }

  const { error } = await supabase.from('lab_cases').insert({
    patient_id: patientId,
    case_type: caseType,
    lab_name: labName || null,
    due_at: dueAt || null,
    lab_fee: labFee ? parseFloat(labFee) : null,
    notes: notes || null,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/lab-cases')
  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Lab case created' }
}

export async function updateLabCaseStatus(labCaseId: string, status: string, patientId: string) {
  const supabase = await createClient()

  const updates: Record<string, any> = { status }
  if (status === 'received') updates.received_at = new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('lab_cases').update(updates).eq('id', labCaseId)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/lab-cases')
  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: `Marked as ${status.replace('_', ' ')}` }
}
