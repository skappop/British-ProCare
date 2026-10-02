import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { guardPage } from '@/lib/auth/role'
import PrintButton from '../../PrintButton'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `EGP ${(Math.round(n * 100) / 100).toLocaleString()}`

/**
 * A visit invoice showing what was done and what was charged. Can be printed
 * even if no payment has been taken yet (unlike payment receipts which require
 * a payment record). Signed-in staff only.
 */
export default async function VisitInvoice({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params
  await guardPage('/receipts')
  const supabase = await createClient()

  const { data: visit } = await supabase
    .from('visits')
    .select('id, patient_id, visit_date, fee_charged, gross_fee, discount_type, discount_value, discount_amount, discount_note, notes, visit_procedures(procedures(name, code)), patients(full_name, file_number, phone)')
    .eq('id', visitId)
    .maybeSingle()

  if (!visit) notFound()

  // Get payments made for this visit and overall balance
  const [{ data: payments }, { data: allVisits }, { data: allPayments }] = await Promise.all([
    supabase.from('payments').select('amount, method, paid_at').eq('visit_id', visitId),
    supabase.from('visits').select('fee_charged').eq('patient_id', visit.patient_id),
    supabase.from('payments').select('amount').eq('patient_id', visit.patient_id),
  ])

  type Joined<T> = T | T[] | null
  const one = <T,>(v: Joined<T>) => (Array.isArray(v) ? v[0] ?? null : v)
  const patient = one(visit.patients as Joined<{ full_name: string; file_number: string | null; phone: string | null }>)

  const procedures = ((visit.visit_procedures ?? []) as { procedures: Joined<{ name: string; code: string | null }> }[])
    .map((vp) => one(vp.procedures))
    .filter((p): p is { name: string; code: string | null } => p !== null)

  const totalCharged = (allVisits ?? []).reduce((s, v) => s + (Number(v.fee_charged) || 0), 0)
  const totalPaid = (allPayments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = totalCharged - totalPaid

  const visitDate = new Date(visit.visit_date)
  const fee = visit.fee_charged !== null ? Number(visit.fee_charged) : null
  const grossFee = visit.gross_fee !== null && visit.gross_fee !== undefined ? Number(visit.gross_fee) : fee
  const discountAmount = Number(visit.discount_amount) || 0
  const paidForThisVisit = (payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)

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
            <p className="text-xs text-gray-500">Visit invoice</p>
          </div>
          <p className="text-right font-mono text-xs text-gray-500">No. {visit.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Patient</p>
            <p className="font-medium">{patient?.full_name}</p>
            {patient?.file_number && <p className="text-xs text-gray-500">File #{patient.file_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">Visit Date</p>
            <p className="font-medium">
              {visitDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="mb-5 space-y-2 border-t border-gray-200 pt-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Treatment</p>
          {procedures.length > 0 ? (
            <ul className="space-y-1">
              {procedures.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400">•</span>
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Dental treatment</p>
          )}
        </div>

        {visit.notes && (
          <div className="mb-5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Notes</p>
            {visit.notes}
          </div>
        )}

        <div className="mb-4 space-y-2 border-t border-gray-200 pt-4">
          {grossFee !== null && discountAmount > 0 && <div className="flex justify-between text-sm"><span>Price before discount</span><span className="font-mono">{egp(grossFee)}</span></div>}
          {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Discount{visit.discount_note ? ` · ${visit.discount_note}` : ''}</span><span className="font-mono">− {egp(discountAmount)}</span></div>}
          <div className="flex justify-between text-sm"><span>Fee for this visit</span><span className="font-mono font-medium">{fee !== null ? egp(fee) : <span className="text-gray-400">Not set</span>}</span></div>
          {paidForThisVisit > 0 && fee !== null && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Paid for this visit</span>
                <span className="font-mono">− {egp(paidForThisVisit)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Remaining for this visit</span>
                <span className="font-mono">{egp(Math.max(0, fee - paidForThisVisit))}</span>
              </div>
            </>
          )}
        </div>

        {fee !== null && (
          <div className="flex justify-between border-t border-gray-200 pt-3 text-sm font-medium">
            <span>Overall account balance</span>
            <span className="font-mono">{balance > 0 ? egp(balance) : 'Fully paid'}</span>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-gray-400">Thank you for choosing British ProCare Dental Clinics</p>
      </div>
    </div>
  )
}
