'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil } from 'lucide-react'
import { updateVisitFee } from '../actions'

type Visit = { id: string; visit_date: string; fee_charged: number | null; procedures: string[] }

/** Each visit and what it costs, editable for discounts and corrections. */
export default function VisitFees({ patientId, visits }: { patientId: string; visits: Visit[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(visitId: string) {
    setError(null)
    startTransition(async () => {
      const res = await updateVisitFee(visitId, patientId, value)
      if (res.ok) setEditing(null)
      else setError(res.message || 'Could not save')
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-display text-lg text-ink-strong">Visits</h2>
        <p className="text-xs text-ink/50 mt-0.5">
          Fees are filled in from the procedures the doctor logged. Adjust one here for a discount
          or correction.
        </p>
      </div>
      {error && <div className="mx-5 mb-3 bg-danger/10 text-danger text-sm px-3 py-2 rounded-control">{error}</div>}

      <div className="divide-y divide-ink/5">
        {visits.map((v) => (
          <div key={v.id} className="px-5 py-3 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-mono text-ink/70">
                {new Date(v.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-ink/50 truncate">{v.procedures.join(', ') || 'No procedures recorded'}</p>
            </div>

            {editing === v.id ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') save(v.id)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  className="w-28 rounded-control border border-ink/15 px-2 py-1 text-sm font-mono text-right"
                />
                <button
                  type="button"
                  onClick={() => save(v.id)}
                  disabled={isPending}
                  aria-label="Save fee"
                  className="h-7 w-7 flex items-center justify-center rounded-control bg-teal text-white disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(v.id)
                  setValue(v.fee_charged != null ? String(v.fee_charged) : '')
                }}
                className="group inline-flex items-center gap-2 text-sm font-mono text-ink-strong"
              >
                {v.fee_charged != null ? `EGP ${Number(v.fee_charged).toLocaleString()}` : <span className="text-ink/35">No fee</span>}
                <Pencil size={12} className="text-ink/25 group-hover:text-teal-deep" />
              </button>
            )}

            <a
              href={`/receipts/${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-deep hover:underline"
            >
              Receipt
            </a>
          </div>
        ))}
        {visits.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink/40">No visits yet.</p>}
      </div>
    </div>
  )
}
