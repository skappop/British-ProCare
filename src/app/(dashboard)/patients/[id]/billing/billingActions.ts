'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canHandleMoney } from '@/lib/auth/role'
import { PAYMENT_METHODS } from './methods'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * The visit a payment is for: the most recent one not yet fully paid. Done
 * here so reception never has to pick a visit from a list.
 */
async function visitToPay(supabase: Supabase, patientId: string): Promise<string | null> {
  const [{ data: visits }, { data: payments }] = await Promise.all([
    supabase.from('visits').select('id, fee_charged, visit_date').eq('patient_id', patientId).order('visit_date', { ascending: false }),
    supabase.from('payments').select('visit_id, amount').eq('patient_id', patientId).not('visit_id', 'is', null),
  ])
  const paid = new Map<string, number>()
  for (const p of payments ?? []) paid.set(p.visit_id as string, (paid.get(p.visit_id as string) ?? 0) + Number(p.amount))
  const open = (visits ?? []).find((v) => (Number(v.fee_charged) || 0) - (paid.get(v.id) ?? 0) > 0)
  return open?.id ?? visits?.[0]?.id ?? null
}

async function refresh(patientId: string) {
  revalidatePath(`/patients/${patientId}/billing`)
  revalidatePath('/appointments')
  revalidatePath('/patients')
  revalidatePath('/reception')
  revalidatePath('/reports')
  revalidatePath('/')
}

/**
 * Records money received. Shared by the Billing page and the walk-in flow.
 * Returns the payment's id so a receipt can be printed for it.
 */
export async function takePayment(input: {
  patientId: string
  amount: number | string
  method: string
  note?: string | null
  visitId?: string | null
  /** Set after the person confirmed that a same-amount payment moments ago was different money. */
  confirmDuplicate?: boolean
}): Promise<{ ok: boolean; message: string; paymentId?: string; duplicate?: boolean }> {
  if (!(await canHandleMoney())) return { ok: false, message: 'Only the front desk and the owner can take payments' }

  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter the amount received' }

  const supabase = await createClient()

  // The same amount for the same patient a few minutes ago is usually the
  // same money entered twice (two desks, or a retry after a slow save).
  if (!input.confirmDuplicate) {
    const recent = await recentSameAmount(supabase, input.patientId, amount)
    if (recent) {
      return {
        ok: false,
        duplicate: true,
        message: `EGP ${amount.toLocaleString()} was already recorded for this patient ${recent}. Is this a second, separate payment?`,
      }
    }
  }

  const visitId = input.visitId || (await visitToPay(supabase, input.patientId))
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === input.method)?.label ?? 'Other'
  const note = input.note?.trim() || null

  const row = { patient_id: input.patientId, visit_id: visitId, amount, method: input.method, note, paid_at: new Date().toISOString() }
  let { data, error } = await supabase.from('payments').insert(row).select('id').single()

  // Databases set up at different times accept different method names. Rather
  // than fail at the desk, store it as "other" and keep the real method in the note.
  if (error && (error.code === '23514' || /method/i.test(error.message))) {
    ;({ data, error } = await supabase
      .from('payments')
      .insert({ ...row, method: 'other', note: [methodLabel, note].filter(Boolean).join(' — ') })
      .select('id')
      .single())
  }
  if (error || !data) return { ok: false, message: error?.message || 'Could not record the payment' }

  await refresh(input.patientId)
  // Two desks saving at the very same moment both get past the check above:
  // say so, so one of them can be removed if it was the same money.
  const twin = input.confirmDuplicate ? null : await recentSameAmount(supabase, input.patientId, amount, data.id as string)
  return {
    ok: true,
    message: twin
      ? `EGP ${amount.toLocaleString()} received — note: the same amount was also recorded ${twin}. If it was the same money, remove one below.`
      : `EGP ${amount.toLocaleString()} received`,
    paymentId: data.id as string,
  }
}

/** "2 minutes ago" if the same amount was recorded for the patient in the last 10 minutes, else null. */
async function recentSameAmount(supabase: Supabase, patientId: string, amount: number, exceptId?: string): Promise<string | null> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  let q = supabase.from('payments').select('id, created_at').eq('patient_id', patientId).eq('amount', amount).gte('created_at', since)
  if (exceptId) q = q.neq('id', exceptId)
  const { data } = await q.order('created_at', { ascending: false }).limit(1)
  const at = data?.[0]?.created_at as string | undefined
  if (!at) return null
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  return mins <= 0 ? 'just now' : mins === 1 ? 'a minute ago' : `${mins} minutes ago`
}

export async function removePayment(paymentId: string, patientId: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await canHandleMoney())) return { ok: false, message: 'Not allowed' }
  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) return { ok: false, message: error.message }
  await refresh(patientId)
  return { ok: true }
}
