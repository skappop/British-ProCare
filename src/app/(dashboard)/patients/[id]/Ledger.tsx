'use client'

import { useState, useTransition } from 'react'
import { recordPayment, deletePayment } from './paymentActions'

type Payment = {
  id: string
  amount: number
  method: string
  note: string | null
  paid_at: string
  visit_id: string | null
}

type Balance = {
  total_charged: number
  total_paid: number
  balance: number
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  instapay: 'InstaPay',
  other: 'Other',
}

export default function Ledger({
  patientId,
  initialBalance,
  initialPayments,
}: {
  patientId: string
  initialBalance: Balance
  initialPayments: Payment[]
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [balance, setBalance] = useState(initialBalance)
  const [payments, setPayments] = useState(initialPayments)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await recordPayment(formData)
      setResult(res)
      if (res.ok) {
        const paidAmount = parseFloat(formData.get('amount') as string)
        setBalance((b) => ({
          total_charged: b.total_charged,
          total_paid: b.total_paid + paidAmount,
          balance: b.balance - paidAmount,
        }))
        setPayments((p) => [
          {
            id: crypto.randomUUID(),
            amount: paidAmount,
            method: formData.get('method') as string,
            note: (formData.get('note') as string) || null,
            paid_at: new Date().toISOString(),
            visit_id: null,
          },
          ...p,
        ])
        setAmount('')
        setNote('')
      }
    })
  }

  function handleDelete(paymentId: string, paymentAmount: number) {
    if (!confirm('Remove this payment record?')) return
    startTransition(async () => {
      const res = await deletePayment(paymentId, patientId)
      if (res.ok) {
        setBalance((b) => ({
          total_charged: b.total_charged,
          total_paid: b.total_paid - paymentAmount,
          balance: b.balance + paymentAmount,
        }))
        setPayments((p) => p.filter((pay) => pay.id !== paymentId))
      }
      setResult(res)
    })
  }

  const owesMoney = balance.balance > 0.01
  const overpaid = balance.balance < -0.01

  return (
    <div className="bg-white rounded-card shadow-soft p-6">
      <h2 className="font-display text-lg text-ink-strong mb-1">Balance & Payments</h2>
      <div className="gold-hairline mb-4" />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-marble/60 rounded-control px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-ink/40">Charged</p>
          <p className="font-mono text-sm text-ink-strong mt-0.5">
            EGP {balance.total_charged.toLocaleString()}
          </p>
        </div>
        <div className="bg-marble/60 rounded-control px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-ink/40">Paid</p>
          <p className="font-mono text-sm text-teal-deep mt-0.5">
            EGP {balance.total_paid.toLocaleString()}
          </p>
        </div>
        <div
          className={`rounded-control px-3 py-2.5 ${
            owesMoney ? 'bg-danger/10' : overpaid ? 'bg-success/10' : 'bg-sage/15'
          }`}
        >
          <p className="text-[10px] uppercase tracking-wider text-ink/40">
            {overpaid ? 'Credit' : 'Balance Due'}
          </p>
          <p
            className={`font-mono text-sm mt-0.5 ${
              owesMoney ? 'text-danger font-semibold' : overpaid ? 'text-success' : 'text-ink-strong'
            }`}
          >
            EGP {Math.abs(balance.balance).toLocaleString()}
          </p>
        </div>
      </div>

      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-control mb-4 ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <form action={handleSubmit} className="flex gap-3 items-end mb-5">
        <input type="hidden" name="patient_id" value={patientId} />
        <div className="space-y-1 w-32">
          <label className="text-sm text-ink/70">Amount</label>
          <input
            type="number"
            name="amount"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1 w-36">
          <label className="text-sm text-ink/70">Method</label>
          <select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="instapay">InstaPay</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1 flex-1">
          <label className="text-sm text-ink/70">Note</label>
          <input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Installment 2 of 6"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !amount}
          className="bg-teal hover:bg-teal-deep disabled:bg-ink/20 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-control transition-colors"
        >
          {isPending ? 'Saving...' : 'Record Payment'}
        </button>
      </form>

      <div className="divide-y divide-ink/5">
        {payments.map((p) => (
          <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="font-mono text-ink-strong">EGP {p.amount.toLocaleString()}</span>
              <span className="text-xs bg-teal/10 text-teal-deep px-2 py-0.5 rounded-full">
                {METHOD_LABELS[p.method] || p.method}
              </span>
              {p.note && <span className="text-ink/50 text-xs">{p.note}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40 font-mono">
                {new Date(p.paid_at).toLocaleDateString('en-GB')}
              </span>
              <button
                onClick={() => handleDelete(p.id, p.amount)}
                className="text-xs text-danger/60 hover:text-danger"
              >
                remove
              </button>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <p className="py-6 text-center text-sm text-ink/40">No payments recorded yet.</p>
        )}
      </div>
    </div>
  )
}
