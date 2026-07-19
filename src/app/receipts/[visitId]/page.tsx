import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ visitId: string }>
}) {
  const { visitId } = await params
  const supabase = await createClient()

  const { data: visit } = await supabase
    .from('visits')
    .select('*, patients(full_name, phone, file_number), visit_procedures(procedures(name, code, base_fee))')
    .eq('id', visitId)
    .single()

  if (!visit) notFound()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('visit_id', visitId)
    .order('paid_at', { ascending: true })

  const totalPaid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
  const balance = (Number(visit.fee_charged) || 0) - totalPaid

  return (
    <div className="max-w-lg mx-auto p-8 font-sans">
      <style>{`
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
        }
      `}</style>

      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      <div className="border border-gray-200 rounded-lg p-8">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-semibold">Procare Clinic</h1>
            <p className="text-sm text-gray-500 mt-1">Dental &amp; Orthodontic Care</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Receipt</p>
            <p className="font-mono">{visit.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Patient</p>
            <p className="font-medium">{visit.patients?.full_name}</p>
            {visit.patients?.file_number && (
              <p className="text-gray-500 text-xs">File #{visit.patients.file_number}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Date</p>
            <p className="font-medium">{new Date(visit.visit_date).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-400 text-xs uppercase">
              <th className="pb-2 font-medium">Procedure</th>
              <th className="pb-2 font-medium text-right">Fee</th>
            </tr>
          </thead>
          <tbody>
            {(visit.visit_procedures as any[])?.map((vp, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{vp.procedures?.name}</td>
                <td className="py-2 text-right font-mono">
                  {vp.procedures?.base_fee ? `EGP ${vp.procedures.base_fee}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1.5 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Charged</span>
            <span className="font-mono">EGP {(Number(visit.fee_charged) || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Paid</span>
            <span className="font-mono text-green-700">EGP {totalPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1.5 border-t border-gray-200">
            <span>Balance Due</span>
            <span className="font-mono">EGP {balance.toLocaleString()}</span>
          </div>
        </div>

        {payments && payments.length > 0 && (
          <div className="text-xs text-gray-500 space-y-1 mb-6">
            <p className="uppercase tracking-wide text-[10px] text-gray-400">Payment History</p>
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>{new Date(p.paid_at).toLocaleDateString('en-GB')} · {p.method}</span>
                <span className="font-mono">EGP {Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {visit.notes && (
          <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
            <p className="uppercase tracking-wide text-[10px] text-gray-400 mb-1">Notes</p>
            <p>{visit.notes}</p>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-300 mt-8">
          Thank you for choosing Procare Clinic
        </p>
      </div>
    </div>
  )
}
