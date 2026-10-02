'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, FileText, Pencil, Printer, X } from 'lucide-react'
import { takePayment, removePayment } from './billingActions'
import { PAYMENT_METHODS, methodLabel } from './methods'
import { updateVisitFee } from '../actions'

export type HistoryItem =
  | { kind: 'visit'; id: string; at: string; amount: number; priced: boolean; what: string }
  | { kind: 'payment'; id: string; at: string; amount: number; method: string; what: string }

const egp = (n: number) => `EGP ${Math.round(n).toLocaleString()}`
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function BillingDesk({
  patientId,
  name,
  fileNumber,
  balance,
  history,
}: {
  patientId: string
  name: string
  fileNumber: string | null
  balance: number
  history: HistoryItem[]
}) {
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : '')
  const [method, setMethod] = useState<string>('cash')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [done, setDone] = useState<{ message: string; paymentId?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState('10')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const value = Number(amount)
  const label = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? ''
  const latestVisit = useMemo(() => history.find((h): h is Extract<HistoryItem, { kind: 'visit' }> => h.kind === 'visit' && h.amount > 0), [history])
  const discount = Number(discountValue) || 0
  const discountAmount = latestVisit
    ? Math.min(latestVisit.amount, discountMode === 'percent' ? latestVisit.amount * Math.min(discount, 100) / 100 : Math.max(discount, 0))
    : 0
  const adjustedVisitTotal = latestVisit ? Math.max(0, latestVisit.amount - discountAmount) : 0

  const [duplicate, setDuplicate] = useState<string | null>(null)

  function pay(confirmDuplicate = false) {
    setError(null)
    setDuplicate(null)
    startTransition(async () => {
      const res = await takePayment({ patientId, amount, method, note, confirmDuplicate })
      if (res.duplicate) return setDuplicate(res.message)
      if (!res.ok) return setError(res.message)
      setDone({ message: res.message, paymentId: res.paymentId })
      setAmount('')
      setNote('')
      setShowNote(false)
    })
  }

  function savePrice(visitId: string, value: string = price) {
    setError(null)
    startTransition(async () => {
      const res = await updateVisitFee(visitId, patientId, value)
      if (!res.ok) return setError(res.message || 'Could not change the price')
      setEditing(null)
      router.refresh()
    })
  }

  function remove(paymentId: string, amountPaid: number) {
    if (!confirm(`Remove the payment of ${egp(amountPaid)}? Only do this if it was entered by mistake.`)) return
    startTransition(async () => {
      const res = await removePayment(paymentId, patientId)
      if (!res.ok) setError(res.message || 'Could not remove it')
    })
  }

  return (
    <div className="space-y-5">
      {/* 1. Where they stand */}
      <div className={`rounded-card px-6 py-5 ${balance > 0 ? 'bg-marquina text-white' : 'bg-success/10'}`}>
        <p className={`text-sm ${balance > 0 ? 'text-white/60' : 'text-ink/55'}`}>
          {name}
          {fileNumber ? ` · File #${fileNumber}` : ''}
        </p>
        {balance > 0 ? (
          <p className="mt-1 font-display text-3xl text-gold-light">Owes {egp(balance)}</p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-2 font-display text-3xl text-success">
            <CheckCircle2 size={26} /> All paid
            {balance < 0 && <span className="text-base text-ink/55">({egp(-balance)} in credit)</span>}
          </p>
        )}
      </div>

      {/* 2. Take the payment */}
      <div className="space-y-4 rounded-card bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg text-ink-strong">Take payment</h2>

        {done && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-success/10 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 size={16} /> {done.message}
            </span>
            {done.paymentId && (
              <a
                href={`/receipts/payment/${done.paymentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-control bg-white px-3 py-1.5 text-sm text-ink-strong shadow-soft hover:bg-marble"
              >
                <Printer size={14} /> Print receipt
              </a>
            )}
          </div>
        )}
        {error && <div className="rounded-control bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
        {duplicate && (
          <div className="space-y-2 rounded-control bg-gold/10 px-4 py-3 text-sm text-ink-strong">
            <p>{duplicate}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDuplicate(null)} className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm">
                No — same money, don’t record
              </button>
              <button type="button" onClick={() => pay(true)} disabled={isPending} className="rounded-control bg-teal px-3 py-2 text-sm text-white">
                Yes, record it
              </button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-sm text-ink/60">Amount received</span>
          <div className="mt-1 flex items-center rounded-control border border-ink/15 focus-within:ring-2 focus-within:ring-teal">
            <span className="pl-3 text-sm text-ink/45">EGP</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-xl text-ink-strong focus:outline-none"
            />
            {balance > 0 && value !== balance && <button type="button" onClick={() => setAmount(String(balance))} className="mr-2 rounded-control px-2 py-1 text-xs text-teal-deep hover:bg-teal/10">Full {egp(balance)}</button>}
          </div>
        </label>

        {balance > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink/45">Installment:</span>
            {[25, 50].map((percent) => <button key={percent} type="button" onClick={() => setAmount(String(Math.round(balance * percent / 100)))} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/65 hover:border-teal hover:text-teal-deep">{percent}% · {egp(balance * percent / 100)}</button>)}
            <button type="button" onClick={() => setAmount(String(balance))} className="rounded-full border border-teal/30 bg-teal/5 px-3 py-1.5 text-teal-deep">Full</button>
          </div>
        )}

        {latestVisit && (
          <div className="border-t border-ink/8 pt-3">
            <button type="button" onClick={() => setDiscountOpen((open) => !open)} className="text-sm text-teal-deep hover:underline">
              {discountOpen ? 'Hide discount' : 'Apply a discount'}
            </button>
            {discountOpen && (
              <div className="mt-3 space-y-3 rounded-control bg-gold/10 p-3">
                <p className="text-xs text-ink/55">Adjust the latest visit ({egp(latestVisit.amount)}). The new total is calculated for you.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setDiscountMode('percent')} className={`rounded-control border px-3 py-1.5 text-xs ${discountMode === 'percent' ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/65'}`}>Percentage</button>
                  <button type="button" onClick={() => setDiscountMode('fixed')} className={`rounded-control border px-3 py-1.5 text-xs ${discountMode === 'fixed' ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/65'}`}>Fixed amount</button>
                  <input inputMode="decimal" aria-label="Discount" value={discountValue} onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d.]/g, ''))} className="w-24 rounded-control border border-ink/15 bg-white px-3 py-1.5 text-right font-mono text-sm" />
                  <span className="self-center text-xs text-ink/45">{discountMode === 'percent' ? '%' : 'EGP'}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-ink/60">New visit total <strong className="font-mono text-ink-strong">{egp(adjustedVisitTotal)}</strong></span><button type="button" disabled={isPending || discountAmount <= 0} onClick={() => savePrice(latestVisit.id, String(adjustedVisitTotal))} className="rounded-control bg-teal px-3 py-2 text-xs font-medium text-white disabled:bg-ink/20">Apply discount</button></div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`rounded-control border py-2.5 text-sm transition-colors ${
                method === m.value ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/70 hover:border-teal'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {showNote ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note — e.g. installment 2 of 6"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="text-sm text-teal-deep hover:underline">
            + Add a note
          </button>
        )}

        <button
          type="button"
          onClick={() => pay()}
          disabled={isPending || !(value > 0) || !!duplicate}
          className="w-full rounded-control bg-teal py-3 text-base font-medium text-white hover:bg-teal-deep disabled:bg-ink/20"
        >
          {isPending ? 'Saving…' : value > 0 ? `Record ${egp(value)} · ${label}` : 'Enter the amount'}
        </button>
      </div>

      {/* 3. History: visits add to what they owe, payments take it off */}
      <div className="rounded-card bg-white shadow-soft">
        <h2 className="px-6 pb-2 pt-5 font-display text-lg text-ink-strong">History</h2>
        <div className="divide-y divide-ink/5">
          {history.map((h) => (
            <div key={`${h.kind}-${h.id}`} className="flex items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-strong">
                  {h.kind === 'visit' ? 'Visit' : `Paid · ${methodLabel(h.method, h.what)}`}
                  <span className="ml-2 text-xs text-ink/40">{day(h.at)}</span>
                </p>
                {h.what && <p className="truncate text-xs text-ink/50">{h.what}</p>}
              </div>

              {h.kind === 'visit' && editing === h.id ? (
                <span className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePrice(h.id)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    className="w-24 rounded-control border border-ink/15 px-2 py-1 text-right font-mono text-sm"
                  />
                  <button type="button" onClick={() => savePrice(h.id)} disabled={isPending} className="rounded-control bg-teal px-2 py-1 text-xs text-white">
                    Save
                  </button>
                </span>
              ) : h.kind === 'visit' ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(h.id)
                      setPrice(String(h.amount || ''))
                    }}
                    title="Change the price (discount or correction)"
                    className="group inline-flex items-center gap-1.5 font-mono text-sm text-ink-strong"
                  >
                    {h.amount === 0 ? 'No charge' : egp(h.amount)}
                    <Pencil size={12} className="text-ink/25 group-hover:text-teal-deep" />
                  </button>
                  <a
                    href={`/receipts/visit/${h.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Print visit invoice"
                    className="p-1 text-ink/35 hover:text-teal-deep"
                  >
                    <FileText size={14} />
                  </a>
                  <Link
                    href={`/patients/${patientId}/visits/${h.id}/edit`}
                    title="Edit this visit (procedures, notes, fee)"
                    className="p-1 text-ink/25 hover:text-teal-deep"
                  >
                    <Pencil size={14} />
                  </Link>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm text-success">− {egp(h.amount)}</span>
                  <a href={`/receipts/payment/${h.id}`} target="_blank" rel="noopener noreferrer" title="Print receipt" className="p-1 text-ink/35 hover:text-teal-deep">
                    <Printer size={14} />
                  </a>
                  <button type="button" onClick={() => remove(h.id, h.amount)} title="Remove (entered by mistake)" className="p-1 text-ink/25 hover:text-danger">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          ))}
          {history.length === 0 && <p className="px-6 py-8 text-center text-sm text-ink/40">Nothing yet.</p>}
        </div>
      </div>
    </div>
  )
}
