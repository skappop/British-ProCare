'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLabCase, updateLabCaseStatus } from '../../lab-cases/actions'

const CASE_TYPES = [
  { value: 'crown', label: 'Crown' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'denture', label: 'Denture' },
  { value: 'night_guard', label: 'Night Guard' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

type LabCase = {
  id: string
  case_type: string
  lab_name: string | null
  sent_at: string
  due_at: string | null
  status: string
}

export default function PatientLabCases({
  patientId,
  initialCases,
  showLabFee = false,
}: {
  patientId: string
  initialCases: LabCase[]
  /** The lab's charge is a clinic cost: owner only, never on a chairside screen by default. */
  showLabFee?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleSubmit(formData: FormData) {
    formData.set('patient_id', patientId)
    startTransition(async () => {
      const res = await createLabCase(formData)
      setResult(res)
      if (res.ok) {
        setShowForm(false)
        router.refresh()
      }
    })
  }

  function markReceived(id: string) {
    startTransition(async () => {
      await updateLabCaseStatus(id, 'received', patientId)
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg text-ink-strong">Lab Cases</h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs px-3 py-1.5 rounded-control bg-teal hover:bg-teal-deep text-white transition-colors"
        >
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>
      <div className="gold-hairline mb-4" />

      {result && (
        <div
          className={`text-xs px-3 py-2 rounded-control mb-3 ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      {showForm && (
        <form action={handleSubmit} className="space-y-2 mb-4 bg-marble/40 rounded-control p-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              name="case_type"
              required
              className="rounded-control border border-ink/15 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {CASE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              name="lab_name"
              placeholder="Lab name"
              className="rounded-control border border-ink/15 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className={`grid gap-2 ${showLabFee ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <input
              name="due_at"
              type="date"
              className="rounded-control border border-ink/15 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
            {showLabFee && (
              <input
                name="lab_fee"
                type="number"
                step="0.01"
                placeholder="Lab fee EGP"
                className="rounded-control border border-ink/15 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
              />
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-control transition-colors"
          >
            {isPending ? 'Saving…' : 'Create'}
          </button>
        </form>
      )}

      <div className="divide-y divide-ink/5">
        {initialCases.map((c) => (
          <div key={c.id} className="py-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-strong">{CASE_TYPES.find((t) => t.value === c.case_type)?.label || c.case_type}</p>
              <p className="text-[10px] text-ink/40 font-mono">
                {c.lab_name && `${c.lab_name} · `}sent {new Date(c.sent_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            {c.status !== 'received' && c.status !== 'cancelled' ? (
              <button
                disabled={isPending}
                onClick={() => markReceived(c.id)}
                className="text-[10px] px-2 py-1 rounded-control bg-success/10 text-success hover:bg-success/20"
              >
                Mark Received
              </button>
            ) : (
              <span className="text-[10px] text-ink/40 uppercase tracking-wider">{c.status}</span>
            )}
          </div>
        ))}
        {initialCases.length === 0 && (
          <p className="py-4 text-center text-xs text-ink/40">No lab cases for this patient.</p>
        )}
      </div>
    </div>
  )
}
