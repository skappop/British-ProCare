'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { updateVisit } from './actions'

type Procedure = {
  id: string
  code: string
  name: string
  base_fee: number | null
  category: string | null
}

type Visit = {
  id: string
  date: string
  fee: number | null
  notes: string
  procedureIds: string[]
}

export default function EditVisitForm({
  patientId,
  visit,
  procedures,
}: {
  patientId: string
  visit: Visit
  procedures: Procedure[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(visit.procedureIds))
  const [fee, setFee] = useState(visit.fee !== null ? String(visit.fee) : '')
  const [notes, setNotes] = useState(visit.notes)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Auto-calculate fee from selected procedures if not manually set
  const selectedProcs = procedures.filter((p) => selected.has(p.id))
  const autoFee = selectedProcs.reduce((sum, p) => sum + (Number(p.base_fee) || 0), 0)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
    // If fee hasn't been manually changed, update it
    if (fee === '' || Number(fee) === autoFee) {
      const newAuto = procedures
        .filter((p) => next.has(p.id))
        .reduce((sum, p) => sum + (Number(p.base_fee) || 0), 0)
      setFee(newAuto > 0 ? String(newAuto) : '')
    }
  }

  function save() {
    if (selected.size === 0) return setError('Select at least one procedure')
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await updateVisit({
        visitId: visit.id,
        patientId,
        procedureIds: Array.from(selected),
        fee: fee.trim() === '' ? null : Number(fee),
        notes: notes.trim(),
      })
      if (!res.ok) return setError(res.message || 'Could not save')
      setSuccess(true)
      setTimeout(() => router.push(`/patients/${patientId}/billing`), 1500)
    })
  }

  const byCategory = procedures.reduce((acc, p) => {
    const cat = p.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Procedure[]>)

  return (
    <div className="space-y-5">
      {/* Procedures */}
      <div className="rounded-card bg-white shadow-soft p-6 space-y-4">
        <h2 className="font-display text-lg text-ink-strong">Procedures</h2>
        {Object.entries(byCategory).map(([cat, procs]) => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-wider text-ink/45 mb-2">{cat}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {procs.map((p) => {
                const on = selected.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`text-left rounded-control border px-3 py-2.5 text-sm transition-colors ${
                      on
                        ? 'border-teal bg-teal text-white'
                        : 'border-ink/15 text-ink-strong hover:border-teal'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.base_fee && (
                      <span className={`ml-2 font-mono text-xs ${on ? 'text-white/80' : 'text-ink/50'}`}>
                        EGP {Number(p.base_fee).toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Fee */}
      <div className="rounded-card bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display text-lg text-ink-strong">Fee</h2>
        <div className="flex items-center rounded-control border border-ink/15 focus-within:ring-2 focus-within:ring-teal">
          <span className="pl-3 text-sm text-ink/45">EGP</span>
          <input
            type="text"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-xl text-ink-strong focus:outline-none"
          />
          {autoFee > 0 && Number(fee) !== autoFee && (
            <button
              type="button"
              onClick={() => setFee(String(autoFee))}
              className="mr-2 rounded-control px-2 py-1 text-xs text-teal-deep hover:bg-teal/10"
            >
              Standard {autoFee.toLocaleString()}
            </button>
          )}
        </div>
        <p className="text-xs text-ink/50">
          Leave blank or set to 0 for no charge. The standard total for the selected procedures is EGP{' '}
          {autoFee.toLocaleString()}.
        </p>
      </div>

      {/* Notes */}
      <div className="rounded-card bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display text-lg text-ink-strong">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes about this visit…"
          className="w-full rounded-control border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      {/* Actions */}
      {error && <div className="rounded-control bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {success && (
        <div className="rounded-control bg-success/10 px-4 py-3 text-sm text-success flex items-center gap-2">
          <CheckCircle2 size={16} /> Visit updated — returning to billing…
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || selected.size === 0 || success}
          className="flex-1 rounded-control bg-teal px-6 py-3 text-base font-medium text-white hover:bg-teal-deep disabled:bg-ink/20 inline-flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="rounded-control border border-ink/15 px-6 py-3 text-base text-ink/70 hover:bg-marble disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
