'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logVisit(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const procedureIds = formData.getAll('procedure_ids') as string[]
  const notes = formData.get('notes') as string
  const fee = formData.get('fee') as string
  const quickLogRaw = formData.get('quick_log') as string

  if (procedureIds.length === 0) {
    return { ok: false, message: 'Select at least one procedure' }
  }

  let quickLog = null
  if (quickLogRaw) {
    try {
      quickLog = JSON.parse(quickLogRaw)
    } catch {
      quickLog = null
    }
  }

  // The doctor's screen no longer shows fees, so an empty fee is normal here:
  // charge the procedures' standard prices, and reception adjusts on Billing.
  let feeValue: number | null = fee ? parseFloat(fee) : null
  if (feeValue === null || !Number.isFinite(feeValue)) {
    const { data: priced } = await supabase.from('procedures').select('base_fee').in('id', procedureIds)
    const total = (priced ?? []).reduce((sum, p) => sum + (Number(p.base_fee) || 0), 0)
    feeValue = total > 0 ? total : null
  }

  const { data, error } = await supabase.rpc('log_visit_with_deduction', {
    p_patient_id: patientId,
    p_procedure_ids: procedureIds,
    p_notes: notes || null,
    p_fee: feeValue,
    p_quick_log: quickLog,
  })

  if (error) {
    if (error.message.includes('INSUFFICIENT_STOCK')) {
      return { ok: false, message: error.message.replace('INSUFFICIENT_STOCK: ', 'Not enough stock: ') }
    }
    return { ok: false, message: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/inventory')

  const warnings = (data as any)?.reorder_warnings || []
  return {
    ok: true,
    message: warnings.length > 0
      ? `Visit saved. Low stock: ${warnings.map((w: any) => `${w.item} (${w.remaining} left)`).join(', ')}`
      : 'Visit saved successfully',
  }
}

export async function getLastQuickLog(patientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('visits')
    .select('ortho_quick_log')
    .eq('patient_id', patientId)
    .not('ortho_quick_log', 'is', null)
    .order('visit_date', { ascending: false })
    .limit(1)
    .single()

  return data?.ortho_quick_log || null
}

export async function getBomPreview(procedureIds: string[]) {
  const supabase = await createClient()
  if (procedureIds.length === 0) return []

  const { data } = await supabase
    .from('procedure_bom')
    .select('quantity, inventory(id, name, unit, stock)')
    .in('procedure_id', procedureIds)

  // merge duplicate items across procedures
  const merged: Record<string, { name: string; unit: string; stock: number; qty: number }> = {}
  for (const row of (data as any[]) || []) {
    const inv = row.inventory
    if (!merged[inv.id]) merged[inv.id] = { name: inv.name, unit: inv.unit, stock: inv.stock, qty: 0 }
    merged[inv.id].qty += Number(row.quantity)
  }
  return Object.values(merged)
}

export async function getLastVisitSetup(patientId: string) {
  const supabase = await createClient()

  const { data: lastVisit } = await supabase
    .from('visits')
    .select('id, fee_charged, ortho_quick_log, visit_procedures(procedure_id)')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(1)
    .single()

  if (!lastVisit) return null
  return {
    procedureIds: (lastVisit.visit_procedures as any[])?.map((vp) => vp.procedure_id) || [],
    fee: lastVisit.fee_charged,
    quickLog: lastVisit.ortho_quick_log,
  }
}

// ---------- Payments & Ledger ----------

export async function recordPayment(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const visitId = (formData.get('visit_id') as string) || null
  const amountRaw = formData.get('amount') as string
  const method = (formData.get('method') as string) || 'cash'
  const paidAt = (formData.get('paid_at') as string) || ''
  const note = (formData.get('notes') as string) || null

  const amount = parseFloat(amountRaw)
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Enter a valid payment amount' }
  }

  const { error } = await supabase.from('payments').insert({
    patient_id: patientId,
    visit_id: visitId,
    amount,
    method,
    paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
    note,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath(`/patients/${patientId}/billing`)
  revalidatePath('/')
  revalidatePath('/reports')

  return { ok: true, message: 'Payment recorded' }
}

export async function deletePayment(id: string, patientId: string) {
  const supabase = await createClient()
  await supabase.from('payments').delete().eq('id', id)
  revalidatePath(`/patients/${patientId}`)
  revalidatePath(`/patients/${patientId}/billing`)
  revalidatePath('/')
  revalidatePath('/reports')
}

export async function getPatientLedger(patientId: string) {
  const supabase = await createClient()

  const [{ data: visits }, { data: payments }] = await Promise.all([
    supabase.from('visits').select('id, fee_charged').eq('patient_id', patientId),
    supabase
      .from('payments')
      .select('id, amount, method, paid_at, note, visit_id')
      .eq('patient_id', patientId)
      .order('paid_at', { ascending: false }),
  ])

  const totalCharged = (visits || []).reduce((s, v: any) => s + (Number(v.fee_charged) || 0), 0)
  const totalPaid = (payments || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0)

  return {
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
    payments: payments || [],
  }
}
/**
 * Reception adjusting what a visit costs (a discount, a correction). The doctor
 * never sees fees, so this is where the auto-calculated fee gets its final say.
 */
export async function updateVisitFee(
  visitId: string,
  patientId: string,
  fee: string
): Promise<{ ok: boolean; message?: string }> {
  const { canHandleMoney } = await import('@/lib/auth/role')
  if (!(await canHandleMoney())) return { ok: false, message: 'Not allowed' }

  const value = fee.trim() === '' ? null : Number(fee)
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10_000_000)) {
    return { ok: false, message: 'Enter a valid amount' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('visits')
    .update({ fee_charged: value })
    .eq('id', visitId)
    .eq('patient_id', patientId)

  if (error) return { ok: false, message: error.message }

  revalidatePath(`/patients/${patientId}/billing`)
  return { ok: true }
}
