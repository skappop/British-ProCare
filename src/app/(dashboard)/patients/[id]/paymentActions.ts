'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function recordPayment(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const amountRaw = formData.get('amount') as string
  const method = (formData.get('method') as string) || 'cash'
  const note = (formData.get('note') as string) || null
  const visitId = (formData.get('visit_id') as string) || null

  const amount = parseFloat(amountRaw)
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Enter a valid amount' }
  }

  const { error } = await supabase.from('payments').insert({
    patient_id: patientId,
    visit_id: visitId || null,
    amount,
    method,
    note,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/')

  return { ok: true, message: `Payment of EGP ${amount.toLocaleString()} recorded` }
}

export async function getPatientBalance(patientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patient_balances')
    .select('total_charged, total_paid, balance')
    .eq('patient_id', patientId)
    .single()

  return data || { total_charged: 0, total_paid: 0, balance: 0 }
}

export async function getPaymentHistory(patientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('id, amount, method, note, paid_at, visit_id')
    .eq('patient_id', patientId)
    .order('paid_at', { ascending: false })

  return data || []
}

export async function deletePayment(paymentId: string, patientId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/')
  return { ok: true, message: 'Payment removed' }
}
