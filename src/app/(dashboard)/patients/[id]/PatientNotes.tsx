'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, LockKeyhole, Loader2, NotebookPen } from 'lucide-react'
import { updatePatientNotes } from './actions'

export default function PatientNotes({ patientId, initialReport, initialPrivate, canSeePrivate }: { patientId: string; initialReport: string; initialPrivate: string; canSeePrivate: boolean }) {
  const [report, setReport] = useState(initialReport)
  const [privateNotes, setPrivateNotes] = useState(initialPrivate)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pending, startTransition] = useTransition()
  const saved = useRef({ report: initialReport, privateNotes: initialPrivate })

  useEffect(() => {
    const timer = setTimeout(() => {
      if (report === saved.current.report && (!canSeePrivate || privateNotes === saved.current.privateNotes)) return
      setState('saving')
      startTransition(async () => {
        const result = await updatePatientNotes(patientId, report, privateNotes)
        if (result.ok) saved.current = { report, privateNotes }
        setState(result.ok ? 'saved' : 'error')
      })
    }, 700)
    return () => clearTimeout(timer)
  }, [report, privateNotes, patientId, initialReport, initialPrivate, canSeePrivate])

  return <section className="rounded-card border border-gold/20 bg-white shadow-soft">
    <div className="flex items-center gap-2 border-b border-ink/5 px-5 py-4"><NotebookPen size={17} className="text-gold-deep" /><div><h2 className="font-display text-lg text-ink-strong">Patient-level notes</h2><p className="text-xs text-ink/45">Long-term context kept with the patient record.</p></div><span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink/40">{state === 'saving' || pending ? <><Loader2 size={12} className="animate-spin" /> Saving</> : state === 'saved' ? <><Check size={12} /> Saved</> : state === 'error' ? 'Not saved' : 'Autosaves'}</span></div>
    <div className="grid items-start gap-5 p-5 sm:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor="report-notes" className="flex min-h-5 items-baseline gap-2 text-sm text-ink/70">
          <span>Patient report note</span><span className="text-xs text-ink/35">included in PDF</span>
        </label>
        <textarea id="report-notes" value={report} onChange={(e) => setReport(e.target.value)} rows={5} placeholder="What another dentist or the patient should see…" className="block min-h-32 w-full resize-y rounded-control border border-ink/15 px-3 py-2.5 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-teal" />
      </div>
      {canSeePrivate ? (
        <details className="group overflow-hidden rounded-control border border-ink/10">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm text-ink/70">
            <LockKeyhole size={14} className="text-ink/45" /> Clinician-only note
            <span className="ml-auto text-xs text-ink/35 group-open:hidden">Open</span><span className="ml-auto hidden text-xs text-ink/35 group-open:inline">Close</span>
          </summary>
          <div className="border-t border-ink/5 p-3">
            <textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={5} placeholder="Never printed or shown to reception…" className="block min-h-32 w-full resize-y rounded-control border border-ink/15 px-3 py-2.5 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
        </details>
      ) : <div className="min-h-10 rounded-control bg-marble/60 px-3 py-2.5 text-sm text-ink/50">Private doctor notes are hidden for reception.</div>}
    </div>
  </section>
}
