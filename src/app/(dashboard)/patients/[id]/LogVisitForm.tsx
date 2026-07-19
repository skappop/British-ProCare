'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
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

export default function LogVisitForm({
  patientId,
  procedures,
  isOrtho,
}: {
  patientId: string
  procedures: Procedure[]
  isOrtho: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lastQuickLog, setLastQuickLog] = useState<Partial<QuickLogData> | null>(null)
  const [quickLogData, setQuickLogData] = useState<QuickLogData | null>(null)
  const [bomPreview, setBomPreview] = useState<BomLine[]>([])
  const [fee, setFee] = useState('')
  const [feeTouched, setFeeTouched] = useState(false)
  const [hasLastVisit, setHasLastVisit] = useState(false)

  useEffect(() => {
    if (isOrtho) getLastQuickLog(patientId).then(setLastQuickLog)
    getLastVisitSetup(patientId).then((s) => setHasLastVisit(!!s && s.procedureIds.length > 0))
  }, [patientId, isOrtho])

  const groupedProcedures = useMemo(() => groupByCategory(procedures), [procedures])

  // Auto-fee: sum of selected procedures' base fees, unless user typed their own
  const autoFee = useMemo(
    () =>
      selectedIds.reduce((sum, id) => {
        const p = procedures.find((x) => x.id === id)
        return sum + (Number(p?.base_fee) || 0)
      }, 0),
    [selectedIds, procedures]
  )

  useEffect(() => {
    if (!feeTouched) setFee(autoFee > 0 ? String(autoFee) : '')
  }, [autoFee, feeTouched])

  // Live BOM preview whenever selection changes
  useEffect(() => {
    getBomPreview(selectedIds).then(setBomPreview)
  }, [selectedIds])

  const stockProblem = bomPreview.some((b) => b.qty > b.stock)

  function toggleProcedure(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function repeatLastVisit() {
    startTransition(async () => {
      const setup = await getLastVisitSetup(patientId)
      if (!setup) return
      setSelectedIds(setup.procedureIds)
      if (setup.fee) {
        setFee(String(setup.fee))
        setFeeTouched(true)
      }
      if (setup.quickLog) setLastQuickLog(setup.quickLog)
    })
  }

  function handleSubmit(formData: FormData) {
    selectedIds.forEach((id) => formData.append('procedure_ids', id))
    formData.set('patient_id', patientId)
    formData.set('fee', fee)
    if (quickLogData) formData.set('quick_log', JSON.stringify(quickLogData))

    startTransition(async () => {
      const res = await logVisit(formData)
      setResult(res)
      if (res.ok) {
        setSelectedIds([])
        setFee('')
        setFeeTouched(false)
        const form = document.getElementById('log-visit-form') as HTMLFormElement
        form?.reset()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-ink-strong">Log Visit</h2>
        {hasLastVisit && (
          <button
            type="button"
            onClick={repeatLastVisit}
            className="text-xs px-3 py-1.5 rounded-control border border-gold/40 text-gold-deep hover:bg-gold/10 transition-colors font-mono"
          >
            ↺ Same as last visit
          </button>
        )}
      </div>

      {result && (
        <div className={`text-sm px-4 py-3 rounded-control mb-4 ${result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </div>
      )}

      <form id="log-visit-form" action={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <label className="text-sm text-ink/70">Procedures</label>
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
                    onClick={() => toggleProcedure(proc.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedIds.includes(proc.id)
                        ? 'bg-teal text-white border-teal'
                        : 'bg-white text-ink/70 border-ink/15 hover:border-teal'
                    }`}
                  >
                    {proc.name}
                    {proc.base_fee ? <span className="opacity-60 ml-1">· {proc.base_fee}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groupedProcedures.length === 0 && (
            <p className="text-xs text-ink/40">No active procedures yet.</p>
          )}
        </div>

        {/* Live BOM preview */}
        {bomPreview.length > 0 && (
          <div className={`rounded-control px-4 py-3 text-xs font-mono space-y-1 ${stockProblem ? 'bg-danger/10' : 'bg-sage/15'}`}>
            <p className={`uppercase tracking-wider text-[10px] ${stockProblem ? 'text-danger' : 'text-ink/50'}`}>
              Will deduct from stock
            </p>
            {bomPreview.map((b) => (
              <div key={b.name} className="flex justify-between">
                <span className={b.qty > b.stock ? 'text-danger' : 'text-ink/80'}>{b.name}</span>
                <span className={b.qty > b.stock ? 'text-danger font-semibold' : 'text-ink/60'}>
                  −{b.qty} {b.unit} {b.qty > b.stock ? `(only ${b.stock} left!)` : `(${b.stock} in stock)`}
                </span>
              </div>
            ))}
          </div>
        )}

        {isOrtho && (
          <div className="space-y-2">
            <label className="text-sm text-ink/70">Ortho Quick-Log</label>
            <OrthoQuickLog key={JSON.stringify(lastQuickLog)} initial={lastQuickLog} onChange={setQuickLogData} />
          </div>
        )}

        <div className="flex gap-4 items-end">
          <div className="space-y-1 flex-1">
            <label className="text-sm text-ink/70">Notes</label>
            <input
              name="notes"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1 w-36">
            <label className="text-sm text-ink/70">
              Fee (EGP) {!feeTouched && autoFee > 0 && <span className="text-gold-deep text-xs">auto</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={fee}
              onChange={(e) => {
                setFee(e.target.value)
                setFeeTouched(true)
              }}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || selectedIds.length === 0 || stockProblem}
          className="bg-teal hover:bg-teal-deep disabled:bg-ink/20 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-control transition-colors"
        >
          {isPending ? 'Saving...' : stockProblem ? 'Insufficient Stock' : 'Save Visit'}
        </button>
      </form>
    </div>
  )
}