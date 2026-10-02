'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/auth/role'

type UpdateInput = {
  visitId: string
  patientId: string
  procedureIds: string[]
  fee: number | null
  notes: string
}

/**
 * Updates a past visit's procedures, fee, and notes. Owner only. The change is
 * logged in the audit trail (via database triggers on visit_procedures).
 */
export async function updateVisit(input: UpdateInput): Promise<{ ok: boolean; message?: string }> {
  if (!(await isOwner())) {
    return { ok: false, message: 'Only the owner can edit past visits' }
  }

  const { visitId, patientId, procedureIds, fee, notes } = input

  if (procedureIds.length === 0) {
    return { ok: false, message: 'Select at least one procedure' }
  }

  if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000)) {
    return { ok: false, message: 'Enter a valid fee' }
  }

  const supabase = await createClient()

  // Verify the visit belongs to this patient
  const { data: visit } = await supabase
    .from('visits')
    .select('id')
    .eq('id', visitId)
    .eq('patient_id', patientId)
    .maybeSingle()

  if (!visit) {
    return { ok: false, message: 'Visit not found' }
  }

  // Update the visit record
  const { error: visitError } = await supabase
    .from('visits')
    .update({
      fee_charged: fee,
      notes: notes || null,
    })
    .eq('id', visitId)

  if (visitError) {
    return { ok: false, message: visitError.message }
  }

  // Replace the procedures: delete all, then insert the new ones
  const { error: deleteError } = await supabase
    .from('visit_procedures')
    .delete()
    .eq('visit_id', visitId)

  if (deleteError) {
    return { ok: false, message: deleteError.message }
  }

  const { error: insertError } = await supabase
    .from('visit_procedures')
    .insert(procedureIds.map((pid) => ({ visit_id: visitId, procedure_id: pid })))

  if (insertError) {
    return { ok: false, message: insertError.message }
  }

  // Refresh all the places that show this visit
  revalidatePath(`/patients/${patientId}`)
  revalidatePath(`/patients/${patientId}/billing`)
  revalidatePath('/appointments')
  revalidatePath('/reception')
  revalidatePath('/reports')
  revalidatePath('/')

  return { ok: true }
}
