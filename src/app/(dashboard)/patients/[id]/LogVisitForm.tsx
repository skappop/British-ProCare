'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { useStoredValue } from '@/lib/useStoredValue'
import { logVisit, getLastClinicalLogs, getBomPreview, getLastVisitSetup } from './actions'
import OrthoQuickLog, { QuickLogData } from './OrthoQuickLog'
import StructuredTreatmentLog, { type LogCategory, type StructuredClinicalLog } from './TreatmentLogs'
import { CONSERVATIVE_FINDING_CODES, CONSERVATIVE_TREATMENTS, findingLabel, findingsOf, palmer, type OdontogramData, type ToothCompletion } from '@/components/dental/charting'
import { TASK_CATEGORY_LABELS, taskIsOpen, type ClinicalTask } from '@/lib/clinicalTasks'

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
const LOG_CATEGORIES: LogCategory[] = ['restorative', 'endo', 'surgical', 'prosthetic']
const LOG_LABELS: Record<LogCategory, string> = { restorative: 'Restorative log', endo: 'Endodontic log', surgical: 'Surgical log', prosthetic: 'Prosthetic log' }
type ClinicalLogs = Partial<Record<LogCategory | 'ortho', StructuredClinicalLog | Partial<QuickLogData>>>

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
  canUseOrthoLog: boolean
  finishesVisit: boolean
  selectedIds: string[]
  toggle: (id: string) => void
  setSelectedIds: (ids: string[]) => void
  notes: string
  setNotes: (v: string) => void
  lastQuickLog: Partial<QuickLogData> | null
  setLastQuickLog: (v: Partial<QuickLogData> | null) => void
  setQuickLogData: (v: QuickLogData | null) => void
  clinicalLogs: ClinicalLogs
  setClinicalLog: (category: LogCategory, value: StructuredClinicalLog) => void
  setClinicalLogs: (value: ClinicalLogs) => void
  odontogram: OdontogramData
  completedTeeth: ToothCompletion[]
  setCompletedTeeth: (value: ToothCompletion[]) => void
  clinicalTasks: ClinicalTask[]
  completedTaskIds: string[]
  setCompletedTaskIds: (value: string[]) => void
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
  canUseOrthoLog,
  initialOdontogram,
  initialTasks,
  finishesVisit = false,
  children,
}: {
  patientId: string
  procedures: Procedure[]
  isOrtho: boolean
  canUseOrthoLog: boolean
  initialOdontogram: OdontogramData
  initialTasks?: ClinicalTask[]
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
  const [clinicalLogs, setClinicalLogs] = useState<ClinicalLogs>({})
  const [completedTeeth, setCompletedTeeth] = useState<ToothCompletion[]>([])
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([])
  const [clinicalTasks] = useState<ClinicalTask[]>(initialTasks || [])
  const [odontogram] = useState<OdontogramData>(initialOdontogram || {})
  const [bomPreview, setBomPreview] = useState<BomLine[]>([])

  useEffect(() => {
    getLastClinicalLogs(patientId).then((value) => {
      setClinicalLogs(value.logs as ClinicalLogs)
      const ortho = value.ortho as Partial<QuickLogData> | null
      setLastQuickLog(ortho)
      if (ortho) setQuickLogData(ortho as QuickLogData)
    })
  }, [patientId])

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
    const selectedCategories = new Set(procedures.filter((p) => selectedIds.includes(p.id)).map((p) => p.category))
    const logsForVisit: Record<string, unknown> = Object.fromEntries(Object.entries(clinicalLogs).filter(([category]) => category === 'ortho' ? selectedCategories.has('ortho') : selectedCategories.has(category)))
    if (quickLogData && selectedCategories.has('ortho')) {
      formData.set('quick_log', JSON.stringify(quickLogData))
      logsForVisit.ortho = quickLogData
    }
    if (Object.keys(logsForVisit).length > 0) formData.set('clinical_logs', JSON.stringify(logsForVisit))
    if (completedTeeth.length > 0) formData.set('completed_teeth', JSON.stringify(completedTeeth))
    if (completedTaskIds.length > 0) formData.set('completed_task_ids', JSON.stringify(completedTaskIds))
    // A current appointment goes back to the day's board after saving. A
    // standalone patient record stays open so the updated chart is visible.
    if (finishesVisit) formData.set('then', 'appointments')

    startTransition(async () => {
      const res = await logVisit(formData)
      if (!res) return // on the way to the board
      setResult(res)
      if (res.ok) {
        setSelectedIds([])
        setNotes('')
        if (finishesVisit) router.push('/appointments')
        else router.refresh()
      }
    })
  }

  const value: Draft = {
    patientId,
    procedures,
    isOrtho,
    canUseOrthoLog,
    finishesVisit,
    selectedIds,
    toggle: (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])),
    setSelectedIds,
    notes,
    setNotes,
    lastQuickLog,
    setLastQuickLog,
    setQuickLogData,
    clinicalLogs,
    setClinicalLog: (category, value) => setClinicalLogs((previous) => ({ ...previous, [category]: value })),
    setClinicalLogs,
    odontogram,
    completedTeeth,
    setCompletedTeeth,
    clinicalTasks,
    completedTaskIds,
    setCompletedTaskIds,
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
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({})
  const [loadingLast, startLoading] = useTransition()
  const groupedProcedures = useMemo(() => groupByCategory(d.procedures), [d.procedures])
  const activeLogCategories = useMemo(() => {
    const selected = new Set(d.procedures.filter((p) => d.selectedIds.includes(p.id)).map((p) => p.category))
    return LOG_CATEGORIES.filter((category) => selected.has(category))
  }, [d.procedures, d.selectedIds])
  const showOrthoLog = d.procedures.some((p) => p.category === 'ortho' && d.selectedIds.includes(p.id))
  const restorativeSelected = d.procedures.some((p) => p.category === 'restorative' && d.selectedIds.includes(p.id))
  const conservativeTeeth = useMemo(() => Object.entries(d.odontogram)
    .filter(([fdi, tooth]) => !d.completedTeeth.some((item) => item.fdi === fdi) && findingsOf(tooth).some((finding) => CONSERVATIVE_FINDING_CODES.has(finding.code)))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })), [d.odontogram, d.completedTeeth])
  const [activeTooth, setActiveTooth] = useState<string | null>(null)
  const [completionId, setCompletionId] = useState(CONSERVATIVE_TREATMENTS[0].treatment)
  const activeCompletion = CONSERVATIVE_TREATMENTS.find((item) => item.treatment === completionId) || CONSERVATIVE_TREATMENTS[0]
  const openTasks = useMemo(() => d.clinicalTasks.filter((task) => taskIsOpen(task) && !d.completedTaskIds.includes(task.id)), [d.clinicalTasks, d.completedTaskIds])
  useEffect(() => {
    setOpenLogs((previous) => {
      const next = { ...previous }
      for (const category of activeLogCategories) if (!(category in next)) next[category] = true
      if (showOrthoLog && !('ortho' in next)) next.ortho = true
      return next
    })
  }, [activeLogCategories, showOrthoLog])

  function repeatLastVisit() {
    startLoading(async () => {
      const setup = await getLastVisitSetup(d.patientId)
      if (!setup) return
      d.setSelectedIds(setup.procedureIds)
      d.setClinicalLogs((setup.clinicalLogs as ClinicalLogs | null) || {})
      if (setup.quickLog) {
        d.setLastQuickLog(setup.quickLog)
        d.setQuickLogData(setup.quickLog as QuickLogData)
      }
    })
  }

  function markToothTreated() {
    if (!activeTooth) return
    d.setCompletedTeeth([...d.completedTeeth, { ...activeCompletion, fdi: activeTooth }])
    const current = (d.clinicalLogs.restorative || {}) as StructuredClinicalLog
    const teeth = Array.isArray(current.tooth) ? current.tooth : current.tooth ? [current.tooth] : []
    d.setClinicalLog('restorative', { ...current, tooth: Array.from(new Set([...teeth, activeTooth])) })
    setActiveTooth(null)
  }

  function toggleTask(taskId: string) {
    d.setCompletedTaskIds(d.completedTaskIds.includes(taskId) ? d.completedTaskIds.filter((id) => id !== taskId) : [...d.completedTaskIds, taskId])
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
          {groupedProcedures.map(({ category, items }) => {
            const selectedCategory = items.some((p) => d.selectedIds.includes(p.id))
            const logCategory = LOG_CATEGORIES.includes(category as LogCategory) ? category as LogCategory : null
            const orthoSelected = category === 'ortho' && selectedCategory
            return (
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
              {openTasks.filter((task) => task.category === category).length > 0 && (
                <div className="mt-2 rounded-control border border-gold/25 bg-gold/[0.05] p-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gold-deep">Open work for this category</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {openTasks.filter((task) => task.category === category).map((task) => {
                      const chosen = d.completedTaskIds.includes(task.id)
                      return <button key={task.id} type="button" onClick={() => toggleTask(task.id)} className={`rounded-full border px-3 py-1.5 text-xs ${chosen ? 'border-success bg-success text-white' : 'border-gold/40 bg-white text-gold-deep hover:bg-gold/10'}`}>
                        {chosen ? '✓ ' : ''}{task.tooth_fdi ? `${palmer(task.tooth_fdi)} · ` : ''}{task.title}
                      </button>
                    })}
                  </div>
                  {d.completedTaskIds.some((id) => openTasks.some((task) => task.id === id && task.category === category)) && <p className="mt-2 text-xs text-success">Selected work will be completed when this visit is saved.</p>}
                </div>
              )}
              {logCategory && selectedCategory && (
                <div className="mt-3 overflow-hidden rounded-card border border-teal/25 bg-teal/[0.03]">
                  <button type="button" onClick={() => setOpenLogs((current) => ({ ...current, [logCategory]: !current[logCategory] }))} aria-expanded={!!openLogs[logCategory]} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-teal/[0.06]">
                    <span><span className="block text-sm font-medium text-teal-deep">{LOG_LABELS[logCategory]}</span><span className="mt-0.5 block text-xs text-ink/55">Clinical details for the selected {CATEGORY_LABELS[category].toLowerCase()} treatment.</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-teal-deep">{openLogs[logCategory] ? 'Hide' : 'Open'}{openLogs[logCategory] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                  </button>
                  {openLogs[logCategory] && <div className="border-t border-teal/15">
                    {logCategory === 'restorative' && restorativeSelected && <div className="space-y-3 border-b border-teal/15 bg-gold/[0.05] p-4">
                      <div>
                        <p className="text-sm font-medium text-ink-strong">Unfinished teeth from the chart</p>
                        <p className="mt-0.5 text-xs text-ink/55">Choose a tooth diagnosed with caries or planned filling, then record what was completed today.</p>
                      </div>
                      {conservativeTeeth.length > 0 ? <>
                        <div className="flex flex-wrap gap-2">
                          {conservativeTeeth.map(([fdi, tooth]) => <button key={fdi} type="button" onClick={() => setActiveTooth(activeTooth === fdi ? null : fdi)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${activeTooth === fdi ? 'border-gold bg-gold text-white' : 'border-gold/40 bg-white text-gold-deep hover:bg-gold/10'}`}><span className="font-mono font-semibold">{palmer(fdi)}</span><span className="ml-1.5 opacity-75">{findingsOf(tooth).filter((finding) => CONSERVATIVE_FINDING_CODES.has(finding.code)).map(findingLabel).join(', ')}</span></button>)}
                        </div>
                        {activeTooth && <div className="rounded-control border border-gold/30 bg-white p-3">
                          <p className="text-xs font-medium text-ink-strong">What was completed on {palmer(activeTooth)}?</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">{CONSERVATIVE_TREATMENTS.map((item) => <button key={item.treatment} type="button" onClick={() => setCompletionId(item.treatment)} className={`rounded-full border px-2.5 py-1.5 text-xs ${completionId === item.treatment ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/65 hover:border-teal'}`}>{item.detail}</button>)}</div>
                          <button type="button" onClick={markToothTreated} className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-teal px-3 py-2 text-xs font-medium text-white hover:bg-teal-deep"><CheckCircle2 size={14} /> Mark treated today</button>
                        </div>}
                      </> : <p className="text-xs text-ink/50">No unfinished conservative teeth are currently marked. You can still enter restorative details below.</p>}
                      {d.completedTeeth.length > 0 && <p className="text-xs text-success">Will update the chart when this visit is saved: {d.completedTeeth.map((item) => `${palmer(item.fdi)} · ${item.detail}`).join(', ')}</p>}
                    </div>}
                    <StructuredTreatmentLog category={logCategory} initial={d.clinicalLogs[logCategory] as StructuredClinicalLog | undefined} onChange={(value) => d.setClinicalLog(logCategory, value)} />
                  </div>}
                </div>
              )}
              {orthoSelected && (
                <div className="mt-3 overflow-hidden rounded-card border border-gold/30 bg-gold/[0.04]">
                  <button type="button" onClick={() => setOpenLogs((current) => ({ ...current, ortho: !current.ortho }))} aria-expanded={!!openLogs.ortho} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gold/[0.08]">
                    <span><span className="block text-sm font-medium text-gold-deep">Orthodontic log</span><span className="mt-0.5 block text-xs text-ink/55">Clinical details for the selected orthodontic treatment.</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gold-deep">{openLogs.ortho ? 'Hide' : 'Open'}{openLogs.ortho ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                  </button>
                  {openLogs.ortho && <div className="border-t border-gold/20"><OrthoQuickLog key={JSON.stringify(d.lastQuickLog)} initial={d.lastQuickLog} onChange={d.setQuickLogData} /></div>}
                </div>
              )}
            </div>
            )
          })}
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

        <div className="space-y-1">
          <label htmlFor="visit-notes" className="space-y-0.5 text-sm text-ink/70"><span className="block">Today&apos;s visit note</span><span className="block text-xs text-ink/40">Short note about this visit; it appears in treatment history.</span></label>
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
