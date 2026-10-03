'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canHandleMoney } from '@/lib/auth/role'
import { PAYMENT_METHODS } from './methods'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type PaymentPlanView = {
  id: string
  visitId: string | null
  totalAmount: number
  installmentCount: number
  intervalDays: number
  status: 'active' | 'completed' | 'cancelled'
  note: string | null
  installments: {
    id: string
    sequence: number
    dueAt: string
    amount: number
    paidAmount: number
    status: 'pending' | 'partial' | 'paid'
  }[]
}

function cleanPlan(row: any, payments: any[]): PaymentPlanView {
  const installments = ((row.payment_plan_installments || []) as any[])
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))
    .map((installment) => {
      const paidAmount = payments
        .filter((payment) => payment.installment_id === installment.id)
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
      const amount = Number(installment.amount) || 0
      return {
        id: installment.id as string,
        sequence: Number(installment.sequence),
        dueAt: installment.due_at as string,
        amount,
        paidAmount,
        status: paidAmount >= amount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
      } as PaymentPlanView['installments'][number]
    })
  const status = installments.length > 0 && installments.every((item) => item.status === 'paid') ? 'completed' : row.status || 'active'
  return {
    id: row.id as string,
    visitId: (row.visit_id as string | null) ?? null,
    totalAmount: Number(row.total_amount) || 0,
    installmentCount: Number(row.installment_count) || installments.length,
    intervalDays: Number(row.interval_days) || 30,
    status,
    note: (row.note as string | null) ?? null,
    installments,
  }
}

export async function getPaymentPlans(patientId: string): Promise<PaymentPlanView[]> {
  const supabase = await createClient()
  const [{ data: plans, error }, { data: payments }] = await Promise.all([
    supabase.from('payment_plans').select('id, visit_id, total_amount, installment_count, interval_days, status, note, payment_plan_installments(id, sequence, due_at, amount)').eq('patient_id', patientId).order('created_at', { ascending: false }),
    supabase.from('payments').select('installment_id, amount').eq('patient_id', patientId).not('installment_id', 'is', null),
  ])
  if (error || !plans) return []
  return (plans as any[]).map((plan) => cleanPlan(plan, payments || []))
}

export async function createPaymentPlan(input: {
  patientId: string
  visitId?: string | null
  totalAmount: number | string
  installmentCount: number | string
  intervalDays: number | string
  firstDueAt?: string | null
  note?: string | null
}): Promise<{ ok: boolean; message: string }> {
  if (!(await canHandleMoney())) return { ok: false, message: 'Only the front desk and the owner can create payment plans' }
  const total = Math.round(Number(input.totalAmount) * 100) / 100
  const count = Number(input.installmentCount)
  const interval = Number(input.intervalDays)
  if (!Number.isFinite(total) || total <= 0) return { ok: false, message: 'Enter a valid plan total' }
  if (!Number.isInteger(count) || count < 2 || count > 24) return { ok: false, message: 'Choose between 2 and 24 installments' }
  if (!Number.isInteger(interval) || interval < 7 || interval > 365) return { ok: false, message: 'Choose an interval between 7 and 365 days' }
  const firstDue = input.firstDueAt ? new Date(`${input.firstDueAt}T09:00:00Z`) : new Date()
  if (Number.isNaN(firstDue.getTime())) return { ok: false, message: 'Choose a valid first due date' }
  if (!input.visitId) return { ok: false, message: 'Choose a visit before creating a payment plan' }

  const supabase = await createClient()
  const [{ data: visit }, { data: paidRows }, { data: existingPlans }] = await Promise.all([
    supabase.from('visits').select('fee_charged').eq('id', input.visitId).eq('patient_id', input.patientId).single(),
    supabase.from('payments').select('amount').eq('patient_id', input.patientId).eq('visit_id', input.visitId),
    supabase.from('payment_plans').select('id').eq('patient_id', input.patientId).eq('visit_id', input.visitId).eq('status', 'active'),
  ])
  if (!visit) return { ok: false, message: 'That visit could not be found' }
  if (existingPlans?.length) return { ok: false, message: 'This visit already has an active payment plan' }
  const paidToVisit = (paidRows || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const due = Math.max(0, (Number(visit.fee_charged) || 0) - paidToVisit)
  if (due <= 0) return { ok: false, message: 'This visit has no remaining balance to schedule' }
  if (total > due) return { ok: false, message: `The plan cannot exceed the remaining visit balance of EGP ${due.toLocaleString()}` }
  const { data: plan, error: planError } = await supabase.from('payment_plans').insert({
    patient_id: input.patientId,
    visit_id: input.visitId || null,
    total_amount: total,
    installment_count: count,
    interval_days: interval,
    note: input.note?.trim() || null,
  }).select('id').single()
  if (planError || !plan) return { ok: false, message: planError?.message || 'Could not create the payment plan' }

  const cents = Math.round(total * 100)
  const baseCents = Math.floor(cents / count)
  const installments = Array.from({ length: count }, (_, index) => {
    const amountCents = index === count - 1 ? cents - baseCents * (count - 1) : baseCents
    const due = new Date(firstDue.getTime() + index * interval * 24 * 60 * 60 * 1000)
    return { plan_id: plan.id, sequence: index + 1, due_at: due.toISOString(), amount: amountCents / 100 }
  })
  const { error: installmentError } = await supabase.from('payment_plan_installments').insert(installments)
  if (installmentError) return { ok: false, message: installmentError.message }
  await refresh(input.patientId)
  return { ok: true, message: 'Payment plan created' }
}

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
  installmentId?: string | null
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

  let installmentId = input.installmentId || null
  let paymentPlanId: string | null = null
  let visitId = input.visitId || null
  if (installmentId) {
    const { data: installment } = await supabase.from('payment_plan_installments').select('id, plan_id, amount').eq('id', installmentId).single()
    if (!installment) return { ok: false, message: 'That installment could not be found' }
    const { data: plan } = await supabase.from('payment_plans').select('id, patient_id, visit_id').eq('id', installment.plan_id).single()
    if (!plan || plan.patient_id !== input.patientId) return { ok: false, message: 'That installment does not belong to this patient' }
    const { data: priorPayments } = await supabase.from('payments').select('amount').eq('installment_id', installmentId)
    const alreadyPaid = (priorPayments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    const installmentDue = Math.max(0, Number(installment.amount) - alreadyPaid)
    if (amount > installmentDue) return { ok: false, message: `This installment has EGP ${installmentDue.toLocaleString()} remaining` }
    if (amount <= 0 || installmentDue <= 0) return { ok: false, message: 'This installment is already paid' }
    paymentPlanId = plan.id as string
    visitId = visitId || (plan.visit_id as string | null)
  }
  visitId = visitId || (await visitToPay(supabase, input.patientId))
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === input.method)?.label ?? 'Other'
  const note = input.note?.trim() || null

  const row = {
    patient_id: input.patientId,
    visit_id: visitId,
    ...(installmentId ? { payment_plan_id: paymentPlanId, installment_id: installmentId } : {}),
    amount,
    method: input.method,
    note,
    paid_at: new Date().toISOString(),
  }
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

  if (installmentId) {
    const { data: installment } = await supabase.from('payment_plan_installments').select('amount, plan_id').eq('id', installmentId).single()
    if (installment) {
      const { data: paidRows } = await supabase.from('payments').select('amount').eq('installment_id', installmentId)
      const paidAmount = (paidRows || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      await supabase.from('payment_plan_installments').update({ paid_amount: paidAmount, status: paidAmount >= Number(installment.amount) ? 'paid' : 'partial' }).eq('id', installmentId)
      const { data: remaining } = await supabase.from('payment_plan_installments').select('status').eq('plan_id', installment.plan_id)
      if (remaining?.length && remaining.every((item) => item.status === 'paid')) await supabase.from('payment_plans').update({ status: 'completed' }).eq('id', installment.plan_id)
    }
  }

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
