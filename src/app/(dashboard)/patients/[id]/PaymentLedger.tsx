'use client'

import { useState, useTransition } from 'react'
import { recordPayment, deletePayment } from './actions'
import DeleteButton from '@/components/DeleteButton'

type Payment = {
  id: string
  amount: number
  method: string
  paid_at: string
  note: string | null
  visit_id: string | null
}

type VisitOption = { id: string; label: string }

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  installment: 'Installment',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}

export default function PaymentLedger({
  patientId,
  totalCharged,
  totalPaid,
  balance,
  payments,
  visitOptions,
}: {
  patientId: string
  totalCharged: number
  totalPaid: number
  balance: number
  payments: Payment[]
  visitOptions: VisitOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleSubmit(formData: FormData) {
    formData.set('patient_id', patientId)
    startTransition(async () => {
      const res = await recordPayment(formData)
      setResult(res)
      if (res.ok) {
        const form = document.getElementById('payment-form') as HTMLFormElement
        form?.reset()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-6 space-y-6">
      <div>
        <h2 className="font-display text-lg text-ink-strong mb-1">Ledger</h2>
        <div className="gold-hairline mb-4" />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">Charged</p>
            <p className="font-mono text-lg text-ink-strong mt-1">EGP {totalCharged.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">Paid</p>
            <p className="font-mono text-lg text-success mt-1">EGP {totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">Balance</p>
            <p className={`font-mono text-lg mt-1 ${balance > 0 ? 'text-danger' : 'text-ink-strong'}`}>
              EGP {balance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-control ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <form id="payment-form" action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Amount (EGP) *</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Method</label>
            <select
              name="method"
              defaultValue="cash"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Date</label>
            <input
              name="paid_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Linked Visit (optional)</label>
            <select
              name="visit_id"
              defaultValue=""
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="">— General payment —</option>
              {visitOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Notes</label>
          <input
            name="notes"
            placeholder="e.g. Installment 3 of 8"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-teal hover:bg-teal-deep disabled:bg-ink/20 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-control transition-colors"
        >
          {isPending ? 'Saving...' : 'Record Payment'}
        </button>
      </form>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono mb-2">Payment History</p>
        <div className="divide-y divide-ink/5">
          {payments.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-ink-strong">EGP {Number(p.amount).toLocaleString()}</span>
                  <span className="text-xs bg-sage/20 text-ink-strong px-2 py-0.5 rounded-full">
                    {METHOD_LABELS[p.method] || p.method}
                  </span>
                </div>
                <p className="text-xs text-ink/40 font-mono mt-0.5">
                  {new Date(p.paid_at).toLocaleDateString('en-GB')}
                  {p.note ? ` · ${p.note}` : ''}
                </p>
              </div>
              <DeleteButton action={deletePayment.bind(null, p.id, patientId)} label="Delete" warning="Confirm?" />
            </div>
          ))}
          {payments.length === 0 && (
            <p className="py-6 text-center text-sm text-ink/40">No payments recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
