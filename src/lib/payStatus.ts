import type { SupabaseClient } from '@supabase/supabase-js'
import type { PayState } from './payState'

/**
 * Payment state of seen patients, judged by their visits and payments in the
 * given period (usually today) as well as their overall balance. A zero
 * balance alone is not "paid": a visit saved without a price also leaves
 * nothing owed, and that is exactly the patient reception still has to see.
 */
export async function getPayStates(
  supabase: SupabaseClient,
  patientIds: string[],
  from: Date,
  to: Date
): Promise<Map<string, { state: PayState; due: number }>> {
  const out = new Map<string, { state: PayState; due: number }>()
  const ids = [...new Set(patientIds)]
  if (!ids.length) return out

  const [balances, visits, payments] = await Promise.all([
    supabase.from('patient_balances').select('patient_id, balance').in('patient_id', ids),
    supabase
      .from('visits')
      .select('patient_id, fee_charged')
      .in('patient_id', ids)
      .gte('visit_date', from.toISOString())
      .lt('visit_date', to.toISOString()),
    supabase
      .from('payments')
      .select('patient_id')
      .in('patient_id', ids)
      .gte('paid_at', from.toISOString())
      .lt('paid_at', to.toISOString()),
  ])

  if (balances.error || visits.error || payments.error) {
    for (const id of ids) out.set(id, { state: 'unknown', due: 0 })
    return out
  }

  const balance = new Map((balances.data ?? []).map((b) => [b.patient_id as string, Number(b.balance) || 0]))
  const paidIn = new Set((payments.data ?? []).map((p) => p.patient_id as string))
  const fees = new Map<string, (number | null)[]>()
  for (const v of visits.data ?? []) {
    const list = fees.get(v.patient_id as string) ?? []
    list.push(v.fee_charged == null ? null : Number(v.fee_charged))
    fees.set(v.patient_id as string, list)
  }

  for (const id of ids) {
    const due = balance.get(id) ?? 0
    const theirs = fees.get(id) ?? []
    let state: PayState
    if (due > 0) state = 'owes'
    else if (theirs.some((f) => f === null) && !paidIn.has(id)) state = 'price_missing'
    else if (paidIn.has(id)) state = 'paid'
    else if (theirs.every((f) => !f)) state = 'no_charge' // price 0, or nothing recorded
    else state = 'paid' // charged, covered by credit from before
    out.set(id, { state, due: Math.max(due, 0) })
  }
  return out
}
