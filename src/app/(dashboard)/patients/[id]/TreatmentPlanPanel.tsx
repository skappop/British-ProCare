'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTreatmentPlan, addPhase, advancePhase, assignVisitToPhase } from './treatmentPlanActions'

type Phase = {
  id: string
  name: string
  order_index: number
  planned_weeks: number | null
  actual_start_date: string | null
  actual_end_date: string | null
  status: 'pending' | 'active' | 'completed'
}

type Plan = {
  id: string
  status: string
  started_at: string
} | null

type UnassignedVisit = { id: string; visit_date: string }

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-ink/5 text-ink/40',
  active: 'bg-teal/10 text-teal-deep',
  completed: 'bg-success/10 text-success',
}

export default function TreatmentPlanPanel({
  patientId,
  initialPlan,
  initialPhases,
  unassignedVisits,
}: {
  patientId: string
  initialPlan: Plan
  initialPhases: Phase[]
  unassignedVisits: UnassignedVisit[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showAddPhase, setShowAddPhase] = useState(false)

  function handleCreate(useDefaults: boolean) {
    startTransition(async () => {
      const res = await createTreatmentPlan(patientId, useDefaults)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  function handleAdvance(phaseId: string) {
    startTransition(async () => {
      const res = await advancePhase(phaseId, patientId)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  function handleAddPhase(formData: FormData) {
    formData.set('treatment_plan_id', initialPlan!.id)
    formData.set('patient_id', patientId)
    startTransition(async () => {
      const res = await addPhase(formData)
      setResult(res)
      if (res.ok) {
        setShowAddPhase(false)
        router.refresh()
      }
    })
  }

  function handleAssign(visitId: string, phaseId: string) {
    startTransition(async () => {
      const res = await assignVisitToPhase(visitId, phaseId, patientId)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  const activePhase = initialPhases.find((p) => p.status === 'active')

  if (!initialPlan) {
    return (
      <div className="bg-white rounded-card shadow-soft p-6">
        <h2 className="font-display text-lg text-ink-strong mb-3">Ortho Treatment Plan</h2>
        <p className="text-sm text-ink/50 mb-4">
          No treatment plan yet. Start one to track phases (leveling → working → finishing).
        </p>
        {result && !result.ok && (
          <div className="text-xs px-3 py-2 rounded-control bg-danger/10 text-danger mb-3">
            {result.message}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleCreate(true)}
            className="text-sm px-4 py-2 rounded-control bg-teal hover:bg-teal-deep text-white transition-colors"
          >
            Start with Standard Phases
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleCreate(false)}
            className="text-sm px-4 py-2 rounded-control border border-ink/15 text-ink/60 hover:bg-marble/60 transition-colors"
          >
            Start Blank Plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg text-ink-strong">Ortho Treatment Plan</h2>
        <span
          className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${
            initialPlan.status === 'completed' ? 'bg-success/10 text-success' : 'bg-teal/10 text-teal-deep'
          }`}
        >
          {initialPlan.status}
        </span>
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

      <div className="space-y-2 mb-4">
        {initialPhases.map((phase) => (
          <div
            key={phase.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-control ${
              phase.status === 'active' ? 'bg-teal/5 border border-teal/20' : 'bg-marble/40'
            }`}
          >
            <div>
              <p className="text-sm text-ink-strong font-medium">{phase.name}</p>
              <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                {phase.planned_weeks ? `planned ${phase.planned_weeks} wks` : 'ongoing'}
                {phase.actual_start_date &&
                  ` · started ${new Date(phase.actual_start_date).toLocaleDateString('en-GB')}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[phase.status]}`}>
                {phase.status}
              </span>
              {phase.status === 'active' && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAdvance(phase.id)}
                  className="text-[10px] px-2 py-1 rounded-control bg-teal hover:bg-teal-deep text-white transition-colors"
                >
                  Complete →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddPhase ? (
        <form action={handleAddPhase} className="flex gap-2 mb-2">
          <input
            name="name"
            required
            placeholder="Phase name"
            className="flex-1 rounded-control border border-ink/15 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <input
            name="planned_weeks"
            type="number"
            placeholder="Weeks"
            className="w-20 rounded-control border border-ink/15 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button type="submit" className="text-xs px-3 py-1.5 rounded-control bg-teal text-white">
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddPhase(true)}
          className="text-xs text-teal-deep hover:underline mb-2"
        >
          + Add custom phase
        </button>
      )}

      {activePhase && unassignedVisits.length > 0 && (
        <div className="border-t border-ink/8 pt-3 mt-3">
          <p className="text-[10px] uppercase tracking-wider text-ink/40 mb-2">
            Unlinked visits — assign to &quot;{activePhase.name}&quot;
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedVisits.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={isPending}
                onClick={() => handleAssign(v.id, activePhase.id)}
                className="text-[10px] px-2 py-1 rounded-full bg-marble/60 hover:bg-marble text-ink/60 font-mono transition-colors"
              >
                {new Date(v.visit_date).toLocaleDateString('en-GB')} +
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
