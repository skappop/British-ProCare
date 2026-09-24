'use client'

import { useState, useTransition } from 'react'
import { Wallet } from 'lucide-react'
import type { PaymentSummary, ReceptionPatient, SavedVisit } from '../types'
import { PAYMENT_METHODS } from '../../patients/[id]/billing/methods'
import { takePayment } from '../../patients/[id]/billing/billingActions'
import { StepCard, PrimaryButton, GhostButton, SectionLabel, inputMonoClass } from '../ui'

export default function StepPayment({
  patient,
  visit,
  onBack,
  onDone,
  onSkip,
}: {
  patient: ReceptionPatient
  visit: SavedVisit
  onBack: () => void
  onDone: (summary: PaymentSummary) => void
  onSkip: () => void
}) {
  const due = Number(visit.fee) || 0
  const [amount, setAmount] = useState(due > 0 ? String(due) : '')
  const [method, setMethod] = useState('cash')
  const [paymentNote, setPaymentNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [duplicate, setDuplicate] = useState<string | null>(null)

  function record(confirmDuplicate = false) {
    setError(null)
    setDuplicate(null)
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      setError('Enter a valid payment amount')
      return
    }

    startTransition(async () => {
      const res = await takePayment({
        patientId: patient.id,
        amount: value,
        method,
        note: paymentNote,
        visitId: visit.id || null,
        confirmDuplicate,
      })
      if (res.duplicate) {
        setDuplicate(res.message)
      } else if (res.ok) {
        onDone({ amount: value, method, paymentId: res.paymentId })
      } else {
        setError(res.message)
      }
    })
  }

  return (
    <StepCard title="Payment" subtitle={patient.full_name} onBack={onBack}>
      {error && <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">{error}</div>}
      {duplicate && (
        <div className="mb-4 space-y-2 rounded-control bg-gold/10 px-4 py-3 text-sm text-ink-strong">
          <p>{duplicate}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onSkip} className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm">
              No — same money, don’t record
            </button>
            <button type="button" onClick={() => record(true)} disabled={isPending} className="rounded-control bg-teal px-3 py-2 text-sm text-white">
              Yes, record it
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-control bg-marquina text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Charged today</p>
            <p className="font-mono text-2xl text-gold-light mt-1">EGP {due.toLocaleString()}</p>
          </div>
          {due > 0 && parseFloat(amount || '0') !== due && (
            <button
              type="button"
              onClick={() => setAmount(String(due))}
              className="text-xs px-3 py-1.5 rounded-control border border-gold/40 text-gold-light hover:bg-white/5 transition-colors font-mono"
            >
              Pay in full
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-sm text-ink/70">Amount received (EGP)</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputMonoClass}
            />
          </label>
          <div className="space-y-1.5">
            <SectionLabel>Method</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    method === m.value
                      ? 'bg-teal text-white border-teal'
                      : 'bg-white text-ink/70 border-ink/15 hover:border-teal'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-ink/70">Note (optional)</span>
          <input
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="e.g. Installment 3 of 8"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </label>
      </div>

      <div className="flex items-center justify-between mt-6">
        <GhostButton onClick={onSkip}>Pay later</GhostButton>
        <PrimaryButton onClick={() => record()} disabled={isPending || !!duplicate}>
          <span className="inline-flex items-center gap-1.5">
            <Wallet size={15} />
            {isPending ? 'Saving…' : 'Record payment →'}
          </span>
        </PrimaryButton>
      </div>
    </StepCard>
  )
}
