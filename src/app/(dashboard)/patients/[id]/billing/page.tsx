import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canHandleMoney } from '@/lib/auth/role'
import LiveRefresh from '@/components/LiveRefresh'
import PaymentLedger from '../PaymentLedger'
import VisitFees from './VisitFees'
import { getPatientLedger } from '../actions'

/**
 * Everything money-related for one patient, kept off the patient page — that
 * page is the doctor's chairside view, where the patient can see the screen.
 * The front desk comes here from the board's "Take payment" or the patient list.
 */
export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!(await canHandleMoney())) redirect(`/patients/${id}`)

  const supabase = await createClient()
  const { data: patient } = await supabase
    .from('patients')
    .select('full_name, file_number, phone')
    .eq('id', id)
    .maybeSingle()

  if (!patient) notFound()

  const { data: visits } = await supabase
    .from('visits')
    .select('id, visit_date, fee_charged, visit_procedures(procedures(name))')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })

  const ledger = await getPatientLedger(id)

  type Row = { id: string; visit_date: string; fee_charged: number | null; visit_procedures: { procedures: { name: string } | { name: string }[] | null }[] | null }
  const rows = ((visits ?? []) as unknown as Row[]).map((v) => ({
    id: v.id,
    visit_date: v.visit_date,
    fee_charged: v.fee_charged,
    procedures: (v.visit_procedures ?? [])
      .map((vp) => (Array.isArray(vp.procedures) ? vp.procedures[0]?.name : vp.procedures?.name))
      .filter((n): n is string => !!n),
  }))

  const visitOptions = rows.map((v) => ({
    id: v.id,
    label: `${new Date(v.visit_date).toLocaleDateString('en-GB')} — EGP ${v.fee_charged ?? 0}`,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/patients/${id}`} className="text-sm text-teal-deep hover:underline">
            ← {patient.full_name}
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="font-display text-2xl text-ink-strong">Billing</h1>
            <LiveRefresh tables={['visits', 'payments']} />
          </div>
          <p className="text-sm text-ink/50 font-mono mt-1">
            {[patient.file_number && `File ${patient.file_number}`, patient.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink/45 uppercase tracking-wider">Balance due</p>
          <p className={`font-display text-2xl ${ledger.balance > 0 ? 'text-danger' : 'text-success'}`}>
            EGP {ledger.balance.toLocaleString()}
          </p>
        </div>
      </div>

      <PaymentLedger
        patientId={id}
        totalCharged={ledger.totalCharged}
        totalPaid={ledger.totalPaid}
        balance={ledger.balance}
        payments={ledger.payments}
        visitOptions={visitOptions}
      />

      <VisitFees patientId={id} visits={rows} />
    </div>
  )
}
