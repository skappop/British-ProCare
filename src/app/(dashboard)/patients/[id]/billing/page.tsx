import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canHandleMoney } from '@/lib/auth/role'
import LiveRefresh from '@/components/LiveRefresh'
import BillingDesk, { type HistoryItem } from './BillingDesk'

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

  const [{ data: visits }, { data: payments }] = await Promise.all([
    supabase
      .from('visits')
      .select('id, visit_date, fee_charged, visit_procedures(procedures(name))')
      .eq('patient_id', id)
      .order('visit_date', { ascending: false }),
    supabase.from('payments').select('id, amount, method, note, paid_at').eq('patient_id', id).order('paid_at', { ascending: false }),
  ])

  type VisitRow = {
    id: string
    visit_date: string
    fee_charged: number | null
    visit_procedures: { procedures: { name: string } | { name: string }[] | null }[] | null
  }
  const history: HistoryItem[] = [
    ...((visits ?? []) as unknown as VisitRow[]).map((v) => ({
      kind: 'visit' as const,
      id: v.id,
      at: v.visit_date,
      amount: Number(v.fee_charged) || 0,
      priced: v.fee_charged !== null && v.fee_charged !== undefined,
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
      />
    </div>
  )
}
