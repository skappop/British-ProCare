'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import { useStoredValue } from '@/lib/useStoredValue'
import { logVisit, getLastQuickLog, getBomPreview, getLastVisitSetup } from './actions'
import OrthoQuickLog, { QuickLogData } from './OrthoQuickLog'

type Procedure = { id: string; code: string; name: string; base_fee: number | null; category: string }
type BomLine = { name: string; unit: string; stock: number; qty: number }

const CATEGORY_ORDER = ['general', 'restorative', 'endo', 'surgical', 'prosthetic', 'ortho']
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  restorative: 'Restorative',
  endo: 'Endo',
  surgical: 'Surgical',
  prosthetic: 'Prosthetic',
  ortho: 'Ortho',
}

function groupByCategory(procedures: Procedure[]) {
  const groups: Record<string, Procedure[]> = {}
  for (const p of procedures) {
    const key = p.category || 'general'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !CATEGORY_ORDER.includes(k)),
  ]
  return orderedKeys.map((key) => ({ category: key, items: groups[key] }))
}

// ---------------------------------------------------------------------------
// Today's visit is filled in at the top of the patient page and completed at
// the bottom, so the two halves share one draft.
// ---------------------------------------------------------------------------

type Draft = {
  patientId: string
  procedures: Procedure[]
  isOrtho: boolean
  finishesVisit: boolean
  selectedIds: string[]
  toggle: (id: string) => void
  setSelectedIds: (ids: string[]) => void
  notes: string
  setNotes: (v: string) => void
  lastQuickLog: Partial<QuickLogData> | null
  setLastQuickLog: (v: Partial<QuickLogData> | null) => void
  setQuickLogData: (v: QuickLogData | null) => void
  bomPreview: BomLine[]
  stockProblem: boolean
  isPending: boolean
  result: { ok: boolean; message: string } | null
  save: () => void
}

const DraftContext = createContext<Draft | null>(null)

function useDraft(): Draft {
  const draft = useContext(DraftContext)
  if (!draft) throw new Error('Visit sections must sit inside <VisitDraft>')
  return draft
}

export function VisitDraft({
  patientId,
  procedures,
  isOrtho,
  finishesVisit = false,
  children,
}: {
  patientId: string
  procedures: Procedure[]
  isOrtho: boolean
  /** The patient is on today's list, so saving also marks them seen. */
  finishesVisit?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  // The clinic this device works in, for a walk-in with no booking.
  const [clinic] = useStoredValue('procare.clinic')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [lastQuickLog, setLastQuickLog] = useState<Partial<QuickLogData> | null>(null)
  const [quickLogData, setQuickLogData] = useState<QuickLogData | null>(null)
  const [bomPreview, setBomPreview] = useState<BomLine[]>([])

  useEffect(() => {
    if (isOrtho) getLastQuickLog(patientId).then(setLastQuickLog)
  }, [patientId, isOrtho])

  // Live stock preview whenever the selection changes.
  useEffect(() => {
    getBomPreview(selectedIds).then(setBomPreview)
  }, [selectedIds])

  const stockProblem = bomPreview.some((b) => b.qty > b.stock)

  function save() {
    // No fees here: this screen is used in front of the patient. The server
    // charges standard prices and the front desk adjusts on Billing.
    const formData = new FormData()
    selectedIds.forEach((id) => formData.append('procedure_ids', id))
    formData.set('patient_id', patientId)
    formData.set('notes', notes)
    if (clinic) formData.set('clinic_id', clinic)
    if (quickLogData) formData.set('quick_log', JSON.stringify(quickLogData))

    startTransition(async () => {
      const res = await logVisit(formData)
      setResult(res)
      if (res.ok) {
        setSelectedIds([])
        setNotes('')
        // Visit done: back to the day's board, where the patient now shows as seen.
        router.push('/appointments')
      }
    })
  }

  const value: Draft = {
    patientId,
    procedures,
    isOrtho,
    finishesVisit,
    selectedIds,
    toggle: (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])),
    setSelectedIds,
    notes,
    setNotes,
    lastQuickLog,
    setLastQuickLog,
    setQuickLogData,
    bomPreview,
    stockProblem,
    isPending,
    result,
    save,
  }

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

/** Top of the page: what is being done today. */
export function TreatmentPicker({ lastVisit }: { lastVisit: { date: string; procedures: string[] } | null }) {
  const d = useDraft()
  const [loadingLast, startLoading] = useTransition()
  const groupedProcedures = useMemo(() => groupByCategory(d.procedures), [d.procedures])

  function repeatLastVisit() {
    startLoading(async () => {
      const setup = await getLastVisitSetup(d.patientId)
      if (!setup) return
      d.setSelectedIds(setup.procedureIds)
      if (setup.quickLog) d.setLastQuickLog(setup.quickLog)
    })
  }

  return (
    <div id="treatment" className="bg-white rounded-card shadow-soft p-6 scroll-mt-6 border-t-4 border-teal">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg text-ink-strong">Today&apos;s treatment</h2>
          {lastVisit && (
            <p className="text-xs text-ink/50 mt-0.5">
              Last visit {new Date(lastVisit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {lastVisit.procedures.length > 0 && <>: {lastVisit.procedures.join(', ')}</>}
            </p>
          )}
        </div>
        {lastVisit && lastVisit.procedures.length > 0 && (
          <button
            type="button"
            onClick={repeatLastVisit}
            disabled={loadingLast}
            className="text-xs px-3 py-1.5 rounded-control border border-gold/40 text-gold-deep hover:bg-gold/10 transition-colors font-mono disabled:opacity-50"
          >
            ↺ Same as last visit
          </button>
        )}
      </div>

      <div className="space-y-5">
        <div className="space-y-4">
          {groupedProcedures.map(({ category, items }) => (
            <div key={category} className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">
                {CATEGORY_LABELS[category] || category}
              </span>
              <div className="flex flex-wrap gap-2">
                {items.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => d.toggle(proc.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      d.selectedIds.includes(proc.id)
                        ? 'bg-teal text-white border-teal'
                        : 'bg-white text-ink/70 border-ink/15 hover:border-teal'
                    }`}
                  >
                    {proc.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groupedProcedures.length === 0 && <p className="text-xs text-ink/40">No active procedures yet.</p>}
        </div>

        {d.bomPreview.length > 0 && (
          <div className={`rounded-control px-4 py-3 text-xs font-mono space-y-1 ${d.stockProblem ? 'bg-danger/10' : 'bg-sage/15'}`}>
            <p className={`uppercase tracking-wider text-[10px] ${d.stockProblem ? 'text-danger' : 'text-ink/50'}`}>
              Will deduct from stock
            </p>
            {d.bomPreview.map((b) => (
              <div key={b.name} className="flex justify-between">
                <span className={b.qty > b.stock ? 'text-danger' : 'text-ink/80'}>{b.name}</span>
                <span className={b.qty > b.stock ? 'text-danger font-semibold' : 'text-ink/60'}>
                  −{b.qty} {b.unit} {b.qty > b.stock ? `(only ${b.stock} left!)` : `(${b.stock} in stock)`}
                </span>
              </div>
            ))}
          </div>
        )}

        {d.isOrtho && (
          <div className="space-y-2">
            <label className="text-sm text-ink/70">Ortho Quick-Log</label>
            <OrthoQuickLog key={JSON.stringify(d.lastQuickLog)} initial={d.lastQuickLog} onChange={d.setQuickLogData} />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="visit-notes" className="text-sm text-ink/70">Notes</label>
          <input
            id="visit-notes"
            value={d.notes}
            onChange={(e) => d.setNotes(e.target.value)}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
      </div>
    </div>
  )
}

/** Bottom of the page: check what was done and complete the visit. */
export function FinishVisit({ children }: { children?: React.ReactNode }) {
  const d = useDraft()
  const chosen = d.procedures.filter((p) => d.selectedIds.includes(p.id))

  return (
    <div className="bg-white rounded-card shadow-soft p-6 border-t-4 border-success space-y-5">
      <div>
        <h2 className="font-display text-lg text-ink-strong">Treatment completed</h2>
        <p className="text-xs text-ink/50 mt-0.5">
          Saving records today&apos;s treatment, marks the patient as seen and sends them to reception for payment.
        </p>
      </div>

      <div className="rounded-control bg-marble/60 px-4 py-3 space-y-2">
        {chosen.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((p) => (
              <span key={p.id} className="bg-teal/10 text-teal-deep text-xs px-2.5 py-1 rounded-full">
                {p.name}
              </span>
            ))}
          </div>
        ) : (
          <a href="#treatment" className="inline-flex items-center gap-1.5 text-sm text-teal-deep hover:underline">
            <ClipboardList size={14} /> Pick today&apos;s procedures at the top first
          </a>
        )}
        {d.notes && <p className="text-sm text-ink/60">{d.notes}</p>}
      </div>

      {d.result && (
        <div className={`text-sm px-4 py-3 rounded-control ${d.result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {d.result.message}
        </div>
      )}

      <button
        type="button"
        onClick={d.save}
        disabled={d.isPending || chosen.length === 0 || d.stockProblem}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-success hover:brightness-95 disabled:bg-ink/20 disabled:cursor-not-allowed text-white text-base font-medium px-6 py-3 rounded-control transition"
      >
        <CheckCircle2 size={18} />
        {d.isPending
          ? 'Saving…'
          : d.stockProblem
            ? 'Not enough stock for this treatment'
            : d.finishesVisit
              ? 'Save & finish visit'
              : 'Save visit'}
      </button>

      {children}
    </div>
  )
}
