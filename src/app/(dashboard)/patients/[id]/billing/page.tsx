import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canHandleMoney } from '@/lib/auth/role'
import LiveRefresh from '@/components/LiveRefresh'
import BillingDesk, { type HistoryItem } from './BillingDesk'
import { getPaymentPlans } from './billingActions'

/**
 * Taking payment for one patient: what they owe, the payment, a receipt, and
 * the history. Kept off the patient page — that is the doctor's chairside
 * view, where the patient can see the screen.
 */
export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await canHandleMoney())) redirect(`/patients/${id}`)

  const supabase = await createClient()
  const { data: patient } = await supabase.from('patients').select('full_name, file_number, phone').eq('id', id).maybeSingle()
  if (!patient) notFound()

  const [{ data: visits }, { data: payments }, plans] = await Promise.all([
      supabase
      .from('visits')
      .select('id, visit_date, fee_charged, gross_fee, discount_type, discount_value, discount_amount, discount_note, visit_procedures(procedures(name, base_fee))')
      .eq('patient_id', id)
      .order('visit_date', { ascending: false }),
    supabase.from('payments').select('id, amount, method, note, paid_at').eq('patient_id', id).order('paid_at', { ascending: false }),
    getPaymentPlans(id),
  ])

  type VisitRow = {
    id: string
    visit_date: string
    fee_charged: number | null
    gross_fee: number | null
    discount_type: string | null
    discount_value: number | null
    discount_amount: number | null
    discount_note: string | null
    visit_procedures: { procedures: { name: string; base_fee: number | null } | { name: string; base_fee: number | null }[] | null }[] | null
  }
  const history: HistoryItem[] = [
    ...((visits ?? []) as unknown as VisitRow[]).map((v) => ({
      kind: 'visit' as const,
      id: v.id,
      at: v.visit_date,
      amount: v.fee_charged !== null && v.fee_charged !== undefined
        ? Number(v.fee_charged) || 0
        : (v.visit_procedures ?? []).reduce((sum, vp) => {
            const procedure = Array.isArray(vp.procedures) ? vp.procedures[0] : vp.procedures
            return sum + (Number(procedure?.base_fee) || 0)
          }, 0),
      priced: true,
      grossAmount: v.gross_fee !== null && v.gross_fee !== undefined ? Number(v.gross_fee) || 0 : undefined,
      discountAmount: Number(v.discount_amount) || 0,
      discountLabel: v.discount_amount ? `${v.discount_type === 'percent' ? `${v.discount_value}%` : 'Discount'}${v.discount_note ? ` · ${v.discount_note}` : ''}` : '',
      what: (v.visit_procedures ?? [])
        .map((vp) => (Array.isArray(vp.procedures) ? vp.procedures[0]?.name : vp.procedures?.name))
        .filter((n): n is string => !!n)
        .join(', '),
    })),
    ...(payments ?? []).map((p) => ({
      kind: 'payment' as const,
      id: p.id as string,
      at: p.paid_at as string,
      amount: Number(p.amount) || 0,
      method: p.method as string,
      what: (p.note as string | null) ?? '',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const charged = history.filter((h) => h.kind === 'visit').reduce((s, h) => s + h.amount, 0)
  const paid = history.filter((h) => h.kind === 'payment').reduce((s, h) => s + h.amount, 0)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/patients/${id}`} className="text-sm text-teal-deep hover:underline">
          ← {patient.full_name}
        </Link>
        <LiveRefresh tables={['visits', 'payments']} />
      </div>
      <BillingDesk
        patientId={id}
        name={patient.full_name}
        fileNumber={patient.file_number}
        balance={Math.round((charged - paid) * 100) / 100}
        history={history}
        plans={plans}
      />
    </div>
  )
}
