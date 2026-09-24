import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { methodLabel } from '@/app/(dashboard)/patients/[id]/billing/methods'
import PrintButton from '../../PrintButton'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `EGP ${(Math.round(n * 100) / 100).toLocaleString()}`

/**
 * A receipt for money received. The figures are the payment itself and the
 * patient's balance across all visits, so it is right however the payment was
 * split between visits. Signed-in staff only (row security returns nothing
 * to anyone else).
 */
export default async function PaymentReceipt({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, patient_id, visit_id, amount, method, note, paid_at, patients(full_name, file_number, phone)')
    .eq('id', paymentId)
    .maybeSingle()
  if (!payment) notFound()

  const [{ data: visit }, { data: visits }, { data: payments }] = await Promise.all([
    payment.visit_id
      ? supabase.from('visits').select('visit_date, fee_charged, visit_procedures(procedures(name))').eq('id', payment.visit_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('visits').select('fee_charged').eq('patient_id', payment.patient_id),
    supabase.from('payments').select('amount').eq('patient_id', payment.patient_id),
  ])

  type Joined<T> = T | T[] | null
  const one = <T,>(v: Joined<T>) => (Array.isArray(v) ? v[0] ?? null : v)
  const patient = one(payment.patients as Joined<{ full_name: string; file_number: string | null; phone: string | null }>)
  const procedures = ((visit?.visit_procedures ?? []) as { procedures: Joined<{ name: string }> }[])
    .map((vp) => one(vp.procedures)?.name)
    .filter(Boolean)
  const balance =
    (visits ?? []).reduce((s, v) => s + (Number(v.fee_charged) || 0), 0) -
    (payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const paidAt = new Date(payment.paid_at as string)
  const method = methodLabel(payment.method as string, payment.note as string | null)
  const note = (payment.note as string | null)?.replace(new RegExp(`^${method}( — )?`), '') || null

  return (
    <div className="mx-auto max-w-md p-6 font-sans text-gray-900">
      <style>{`@media print { .no-print { display: none } body { background: #fff } }`}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-12 w-12 object-contain" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">British ProCare Dental Clinics</h1>
            <p className="text-xs text-gray-500">Payment receipt</p>
          </div>
          <p className="text-right font-mono text-xs text-gray-500">No. {payment.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Patient</p>
            <p className="font-medium">{patient?.full_name}</p>
            {patient?.file_number && <p className="text-xs text-gray-500">File #{patient.file_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">Date</p>
            <p className="font-medium">{paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="mb-5 rounded-md bg-gray-50 px-4 py-4 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-400">Amount received</p>
          <p className="mt-1 text-3xl font-semibold">{egp(Number(payment.amount))}</p>
          <p className="mt-1 text-sm text-gray-500">by {method}</p>
        </div>

        {visit && (
          <div className="mb-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-gray-400">For the visit of {new Date(visit.visit_date).toLocaleDateString('en-GB')}</p>
            <p className="mt-0.5">{procedures.length ? procedures.join(', ') : 'Dental treatment'}</p>
          </div>
        )}
        {note && <p className="mb-4 text-sm text-gray-600">Note: {note}</p>}

        <div className="flex justify-between border-t border-gray-200 pt-3 text-sm font-medium">
          <span>{balance > 0 ? 'Remaining balance' : 'Balance'}</span>
          <span className="font-mono">{balance > 0 ? egp(balance) : 'Fully paid'}</span>
        </div>

        <p className="mt-8 text-center text-[11px] text-gray-400">Thank you for choosing British ProCare Dental Clinics</p>
      </div>
    </div>
  )
}
