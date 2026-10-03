'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check, ClipboardPlus, Clock3, Plus, X } from 'lucide-react'
import { createClinicalTask, updateClinicalTask } from './clinicalTaskActions'
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_ORDER, TASK_STATUS_LABELS, taskIsOpen, type ClinicalTask, type ClinicalTaskCategory } from '@/lib/clinicalTasks'
import { palmer } from '@/components/dental/charting'

const OPTIONS: Record<ClinicalTaskCategory, string[]> = {
  general: ['Review / check-up', 'Preventive advice', 'Follow-up examination'],
  restorative: ['Filling', 'Caries treatment', 'Fracture repair', 'Preventive restoration'],
  endo: ['Root canal treatment', 'Endodontic review', 'Retreatment'],
  surgical: ['Extraction', 'Surgical extraction', 'Biopsy', 'Incision and drainage'],
  prosthetic: ['Crown', 'Bridge', 'Veneer', 'Denture', 'Try-in / delivery'],
  ortho: ['Initial consultation', 'Adjustment', 'Bracket / appliance visit', 'Retainer review'],
}

export default function ClinicalTaskPanel({
  patientId,
  initialTasks,
  plannedTooth,
  plannedCategory,
  onClearPlannedTooth,
}: {
  patientId: string
  initialTasks: ClinicalTask[]
  plannedTooth?: string | null
  plannedCategory?: ClinicalTaskCategory
  onClearPlannedTooth?: () => void
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [category, setCategory] = useState<ClinicalTaskCategory>('restorative')
  const [title, setTitle] = useState('')
  const [site, setSite] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [open, setOpen] = useState(!!plannedTooth)
  const [showClosed, setShowClosed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const openTasks = useMemo(() => tasks.filter(taskIsOpen), [tasks])
  const grouped = useMemo(() => TASK_CATEGORY_ORDER.map((key) => ({ category: key, tasks: openTasks.filter((task) => task.category === key) })).filter((group) => group.tasks.length), [openTasks])
  const closedTasks = tasks.filter((task) => !taskIsOpen(task))

  useEffect(() => {
    if (plannedTooth) setOpen(true)
    if (plannedCategory) setCategory(plannedCategory)
  }, [plannedTooth, plannedCategory])

  function plan() {
    setMessage(null)
    startTransition(async () => {
      const result = await createClinicalTask(patientId, {
        category,
        title: title || OPTIONS[category][0],
        toothFdi: plannedTooth || null,
        site,
        priority,
      })
      if (!result.ok || !result.task) return setMessage(result.message || 'Could not create the task')
      setTasks((current) => [result.task!, ...current])
      setTitle('')
      setSite('')
      setOpen(false)
      onClearPlannedTooth?.()
    })
  }

  function deferTask(task: ClinicalTask) {
    startTransition(async () => {
      const result = await updateClinicalTask(patientId, task.id, { status: 'deferred' })
      if (!result.ok) return setMessage(result.message || 'Could not update the task')
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'deferred', completed_at: null } : item))
    })
  }

  return (
    <section className="rounded-card border border-gold/25 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
        <div className="flex items-center gap-2"><ClipboardPlus size={17} className="text-gold-deep" /><div><h2 className="font-display text-lg text-ink-strong">Open clinical work</h2><p className="text-xs text-ink/50">Plan once, then complete it from the next visit.</p></div></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-control border border-gold/35 px-3 py-2 text-xs font-medium text-gold-deep hover:bg-gold/10"><Plus size={14} /> Plan treatment</button>
      </div>

      {open && <div className="space-y-3 border-b border-ink/8 bg-gold/[0.04] p-4">
        <div className="flex flex-wrap gap-1.5">{TASK_CATEGORY_ORDER.map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full border px-3 py-1.5 text-xs ${category === value ? 'border-teal bg-teal text-white' : 'border-ink/15 bg-white text-ink/65 hover:border-teal'}`}>{TASK_CATEGORY_LABELS[value]}</button>)}</div>
        <div className="flex flex-wrap gap-1.5">{OPTIONS[category].map((value) => <button key={value} type="button" onClick={() => setTitle(value)} className={`rounded-full border px-3 py-1.5 text-xs ${title === value ? 'border-teal bg-teal text-white' : 'border-ink/15 bg-white text-ink/65 hover:border-teal'}`}>{value}</button>)}</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Treatment to plan" className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          <input value={plannedTooth ? `${palmer(plannedTooth)} · tooth ${plannedTooth}` : site} onChange={(event) => { if (!plannedTooth) setSite(event.target.value) }} readOnly={!!plannedTooth} placeholder="Tooth or site" className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal read-only:bg-marble/60" />
          <select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className="rounded-control border border-ink/15 bg-white px-3 py-2 text-sm"><option value="normal">Normal priority</option><option value="high">High priority</option><option value="low">Low priority</option></select>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={pending} onClick={plan} className="inline-flex items-center gap-1.5 rounded-control bg-teal px-3 py-2 text-xs font-medium text-white hover:bg-teal-deep disabled:opacity-50"><Plus size={14} /> Add open task</button>{plannedTooth && <button type="button" onClick={onClearPlannedTooth} className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-xs text-ink/50 hover:bg-marble"><X size={14} /> Clear selected tooth</button>}</div>
        {message && <p className="text-xs text-danger">{message}</p>}
      </div>}

      <div className="divide-y divide-ink/7">
        {grouped.map((group) => <div key={group.category} className="px-5 py-3"><p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-ink/40">{TASK_CATEGORY_LABELS[group.category]}</p><div className="flex flex-wrap gap-2">{group.tasks.map((task) => <div key={task.id} className={`inline-flex max-w-full items-center gap-2 rounded-control border px-3 py-2 text-xs ${task.priority === 'high' ? 'border-danger/35 bg-danger/[0.04]' : 'border-ink/12 bg-marble/35'}`}><span className="min-w-0 truncate text-ink-strong">{task.tooth_fdi ? <span className="mr-1.5 font-mono font-semibold text-teal-deep">{palmer(task.tooth_fdi)}</span> : null}{task.title}</span><span className="hidden text-ink/40 sm:inline">{TASK_STATUS_LABELS[task.status]}</span><button type="button" disabled={pending} onClick={() => deferTask(task)} title="Defer task" className="rounded-full p-1 text-ink/35 hover:bg-marble"><Clock3 size={13} /></button></div>)}</div></div>)}
        {!grouped.length && <div className="px-5 py-8 text-center text-sm text-ink/45">No open treatment tasks yet. Select a tooth in the chart and plan the next action.</div>}
      </div>
      {closedTasks.length > 0 && <button type="button" onClick={() => setShowClosed((value) => !value)} className="w-full border-t border-ink/8 px-5 py-3 text-left text-xs text-teal-deep hover:bg-marble/50">{showClosed ? 'Hide completed task history' : 'Show completed task history'}</button>}
      {showClosed && <div className="divide-y divide-ink/7 border-t border-ink/8">{closedTasks.map((task) => <div key={task.id} className="flex items-center gap-2 px-5 py-3 text-xs text-ink/55"><Check size={14} className="text-success" /><span className="flex-1">{task.tooth_fdi ? `${palmer(task.tooth_fdi)} · ` : ''}{task.title}</span><span>{TASK_STATUS_LABELS[task.status]}</span></div>)}</div>}
    </section>
  )
}
