'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { RotateCcw, Stethoscope, ChevronDown } from 'lucide-react'
import type { Procedure, ReceptionPatient, SavedVisit } from '../types'
import {
  logVisit,
  getBomPreview,
  getLastVisitSetup,
  getLastQuickLog,
} from '../../patients/[id]/actions'
import { saveTeeth } from '../../patients/[id]/odontogramActions'
import OrthoQuickLog, { type QuickLogData } from '../../patients/[id]/OrthoQuickLog'
import { getLatestVisit, getOdontogram } from '../receptionActions'
import DentalChart, { type OdontogramData } from '@/components/dental/DentalChart'
import { StepCard, PrimaryButton, SectionLabel, Field, inputClass, inputMonoClass } from '../ui'

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
    ;(groups[key] ||= []).push(p)
  }
  const keys = [
    ...CATEGORY_ORDER.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !CATEGORY_ORDER.includes(k)),
  ]
  return keys.map((key) => ({ category: key, items: groups[key] }))
}

export default function StepVisit({
  patient,
  procedures,
  onBack,
  onSaved,
}: {
  patient: ReceptionPatient
  procedures: Procedure[]
  onBack: () => void
  onSaved: (visit: SavedVisit, nextVisitWeeks: number | null) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [fee, setFee] = useState('')
  const [feeTouched, setFeeTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [bomPreview, setBomPreview] = useState<BomLine[]>([])
  const [lastQuickLog, setLastQuickLog] = useState<Partial<QuickLogData> | null>(null)
  const [quickLogData, setQuickLogData] = useState<QuickLogData | null>(null)
  const [hasLastVisit, setHasLastVisit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [showChart, setShowChart] = useState(false)
  const [chartData, setChartData] = useState<OdontogramData | null>(null)

  function toggleChart() {
    setShowChart((v) => !v)
    if (chartData === null) {
      getOdontogram(patient.id).then((d) => setChartData((d as OdontogramData) || {}))
    }
  }

  const grouped = useMemo(() => groupByCategory(procedures), [procedures])

  useEffect(() => {
    if (patient.is_ortho) getLastQuickLog(patient.id).then(setLastQuickLog)
    getLastVisitSetup(patient.id).then((s) => setHasLastVisit(!!s && s.procedureIds.length > 0))
  }, [patient.id, patient.is_ortho])

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

  useEffect(() => {
    getBomPreview(selectedIds).then(setBomPreview)
  }, [selectedIds])

  const stockProblem = bomPreview.some((b) => b.qty > b.stock)

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function repeatLastVisit() {
    startTransition(async () => {
      const setup = await getLastVisitSetup(patient.id)
      if (!setup) return
      setSelectedIds(setup.procedureIds)
      if (setup.fee) {
        setFee(String(setup.fee))
        setFeeTouched(true)
      }
      if (setup.quickLog) setLastQuickLog(setup.quickLog)
    })
  }

  function save() {
    setError(null)
    if (selectedIds.length === 0) {
      setError('Select at least one procedure')
      return
    }

    const fd = new FormData()
    fd.set('patient_id', patient.id)
    selectedIds.forEach((id) => fd.append('procedure_ids', id))
    fd.set('notes', notes)
    fd.set('fee', fee)
    if (quickLogData) fd.set('quick_log', JSON.stringify(quickLogData))

    startTransition(async () => {
      const res = await logVisit(fd)
      if (!res.ok) {
        setError(res.message)
        return
      }
      const latest = await getLatestVisit(patient.id)
      const procedureNames = selectedIds
        .map((id) => procedures.find((p) => p.id === id)?.name)
        .filter((n): n is string => !!n)

      onSaved(
        {
          id: latest?.id || '',
          fee: latest?.fee_charged ?? (fee ? parseFloat(fee) : null),
          procedures: procedureNames,
        },
        quickLogData?.next_visit_weeks ?? null
      )
    })
  }

  return (
    <StepCard
      title="Today's treatment"
      subtitle={patient.full_name}
      onBack={onBack}
    >
      {error && <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">{error}</div>}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Procedures</SectionLabel>
          {hasLastVisit && (
            <button
              type="button"
              onClick={repeatLastVisit}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-control border border-gold/40 text-gold-deep hover:bg-gold/10 transition-colors font-mono"
            >
              <RotateCcw size={12} /> Same as last visit
            </button>
          )}
        </div>

        <div className="space-y-4">
          {grouped.map(({ category, items }) => (
            <div key={category} className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">
                {CATEGORY_LABELS[category] || category}
              </span>
              <div className="flex flex-wrap gap-2">
                {items.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => toggle(proc.id)}
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
          {grouped.length === 0 && (
            <p className="text-xs text-ink/40">
              No active procedures yet. Add them under Procedures first.
            </p>
          )}
        </div>

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

        <div className="rounded-control border border-ink/10 overflow-hidden">
          <button
            type="button"
            onClick={toggleChart}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-marble/60 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-sm text-ink-strong">
              <SectionLabel>Dental chart</SectionLabel>
              <span className="text-ink/40 text-xs font-normal normal-case tracking-normal">tap a tooth to mark work</span>
            </span>
            <ChevronDown
              size={16}
              className={`text-ink/40 transition-transform ${showChart ? 'rotate-180' : ''}`}
            />
          </button>
          {showChart && (
            <div className="px-3 pb-4 pt-1 border-t border-ink/8">
              {chartData === null ? (
                <p className="text-xs text-ink/40 py-6 text-center">Loading chart…</p>
              ) : (
                <DentalChart
                  compact
                  initial={chartData}
                  onSave={(changes) => saveTeeth(patient.id, changes)}
                />
              )}
            </div>
          )}
        </div>

        {patient.is_ortho && (
          <div className="space-y-2">
            <SectionLabel>Ortho quick-log</SectionLabel>
            <OrthoQuickLog key={JSON.stringify(lastQuickLog)} initial={lastQuickLog} onChange={setQuickLogData} />
          </div>
        )}

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="w-36">
            <label className="block space-y-1">
              <span className="text-sm text-ink/70">
                Fee (EGP) {!feeTouched && autoFee > 0 && <span className="text-gold-deep text-xs">auto</span>}
              </span>
              <input
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => {
                  setFee(e.target.value)
                  setFeeTouched(true)
                }}
                className={inputMonoClass}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        <PrimaryButton onClick={save} disabled={isPending || selectedIds.length === 0 || stockProblem}>
          <span className="inline-flex items-center gap-1.5">
            <Stethoscope size={15} />
            {isPending ? 'Saving…' : stockProblem ? 'Insufficient stock' : 'Save visit →'}
          </span>
        </PrimaryButton>
      </div>
    </StepCard>
  )
}
