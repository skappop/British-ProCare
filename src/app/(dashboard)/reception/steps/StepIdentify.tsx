'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, UserPlus, CalendarClock, Phone, Hash, CheckCircle2, Wallet } from 'lucide-react'
import type { ReceptionPatient, TodayAppointment } from '../types'
import { searchWalkInPatients, quickCreatePatient } from '../receptionActions'
import { StepCard, PrimaryButton, GhostButton, Field, inputClass, inputMonoClass, SectionLabel } from '../ui'
import PendingRegistrations from './PendingRegistrations'
import { needsReception, payLabel } from '@/lib/payState'

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function StepIdentify({
  todayAppointments,
  onPick,
}: {
  todayAppointments: TodayAppointment[]
  // appointmentId is passed when the patient was chosen from today's schedule
  onPick: (patient: ReceptionPatient, appointmentId: string | null, note?: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ReceptionPatient[]>([])
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState<'search' | 'new'>('search')

  // new-patient fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [fileNumber, setFileNumber] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [isOrtho, setIsOrtho] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (mode !== 'search') return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      searchWalkInPatients(q).then((res) => {
        setHits(res)
        setSearching(false)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [query, mode])

  const today = todayAppointments.filter(
    (a) => a.patient && a.status !== 'cancelled' && a.status !== 'no_show'
  )
  // Still needing something today: seen-but-unpaid first, then everyone else.
  // Seen and paid fold away under "Done today"; the whole list starts fresh
  // each clinic day.
  const toPay = today.filter((a) => a.status === 'completed' && needsReception(a.pay_state))
  const done = today.filter((a) => a.status === 'completed' && !needsReception(a.pay_state))
  const waiting = [...toPay, ...today.filter((a) => a.status !== 'completed')]

  function handleCreate() {
    setError(null)
    if (!fullName.trim()) {
      setError('Enter the patient’s name to continue')
      return
    }
    startTransition(async () => {
      const res = await quickCreatePatient({
        full_name: fullName,
        phone,
        file_number: fileNumber,
        date_of_birth: dob,
        gender,
        is_ortho: isOrtho,
      })
      if (res.ok && res.patient) {
        onPick(res.patient, null)
      } else {
        setError(res.message || 'Could not create the patient')
      }
    })
  }

  return (
    <StepCard title="Who's here?" subtitle="Tap a booked patient, search, or register a new one.">
      {mode === 'search' && (
        <div className="space-y-6">
          <PendingRegistrations onPick={(p, reason) => onPick(p, null, reason)} />

          {waiting.length > 0 && (
            <div className="space-y-2.5">
              <SectionLabel>Today</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {waiting.map((a) =>
                  a.status === 'completed' && a.patient ? (
                    // Seen by the doctor: the only thing left is payment.
                    <Link
                      key={a.id}
                      href={`/patients/${a.patient.id}/billing`}
                      className="flex items-center gap-3 rounded-control border border-success/40 border-l-4 border-l-success bg-success/[0.07] px-3.5 py-3 text-left hover:bg-success/[0.12] transition-colors"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
                        <CheckCircle2 size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink-strong font-medium truncate">{a.patient.full_name}</span>
                        <span className="flex items-center gap-1 text-xs text-gold-deep font-medium">
                          <Wallet size={12} />{' '}
                          {a.pay_state === 'price_missing'
                            ? 'Seen · set the price, then take payment'
                            : a.pay_state === 'unknown'
                              ? 'Seen · check payment'
                              : `Seen · take payment · EGP ${Math.round(a.balance_due ?? 0).toLocaleString()}`}
                        </span>
                      </span>
                    </Link>
                  ) : (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => a.patient && onPick(a.patient, a.id)}
                    className="group flex items-center gap-3 rounded-control border border-ink/10 bg-marble/40 px-3.5 py-3 text-left hover:border-teal hover:bg-teal/[0.04] transition-colors"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
                      <CalendarClock size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-strong font-medium truncate">
                        {a.patient?.full_name}
                        {a.patient?.is_ortho && (
                          <span className="ml-2 text-[10px] text-gold-deep uppercase tracking-wider">Ortho</span>
                        )}
                      </span>
                      <span className="block text-xs text-ink/45 font-mono">
                        {timeOf(a.scheduled_at)}
                        {a.status === 'arrived' || a.status === 'in_chair' ? ' · here' : ''}
                      </span>
                    </span>
                  </button>
                  )
                )}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <details className="group rounded-control border border-ink/10">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm text-ink/60">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-success" /> Done today · {done.length} seen and settled
                </span>
                <span className="text-xs text-teal-deep group-open:hidden">Show</span>
              </summary>
              <div className="divide-y divide-ink/5 border-t border-ink/10">
                {done.map((a) => (
                  <Link key={a.id} href={`/patients/${a.patient!.id}/billing`} className="flex items-center justify-between px-3.5 py-2 text-sm hover:bg-marble/60">
                    <span className="text-ink-strong">{a.patient!.full_name}</span>
                    <span className="text-xs text-ink/45">{payLabel(a.pay_state, a.balance_due)}</span>
                  </Link>
                ))}
              </div>
            </details>
          )}

          <div className="space-y-2">
            <SectionLabel>Find a patient</SectionLabel>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, phone, or file number…"
                className={`${inputClass} pl-9`}
              />
            </div>

            {query.trim().length >= 2 && (
              <div className="rounded-control border border-ink/10 divide-y divide-ink/5 overflow-hidden">
                {searching && <p className="px-3.5 py-3 text-sm text-ink/40">Searching…</p>}
                {!searching &&
                  hits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPick(p, null)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-marble/60 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-ink-strong font-medium truncate">
                          {p.full_name}
                          {p.is_ortho && (
                            <span className="ml-2 text-[10px] text-gold-deep uppercase tracking-wider">Ortho</span>
                          )}
                        </span>
                        <span className="flex gap-3 text-xs text-ink/45 font-mono mt-0.5">
                          {p.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} /> {p.phone}
                            </span>
                          )}
                          {p.file_number && (
                            <span className="inline-flex items-center gap-1">
                              <Hash size={11} /> {p.file_number}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="text-xs text-teal-deep shrink-0">Select →</span>
                    </button>
                  ))}
                {!searching && hits.length === 0 && (
                  <p className="px-3.5 py-3 text-sm text-ink/40">No match. Register them as new below.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                setMode('new')
                setFullName(query.trim())
              }}
              className="inline-flex items-center gap-2 text-sm text-gold-deep hover:text-gold border border-gold/40 hover:bg-gold/10 rounded-control px-4 py-2 transition-colors"
            >
              <UserPlus size={15} />
              Register new patient
            </button>
          </div>
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-4">
          {error && (
            <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control">{error}</div>
          )}

          <Field label="Full name *">
            <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputMonoClass} />
            </Field>
            <Field label="File number">
              <input value={fileNumber} onChange={(e) => setFileNumber(e.target.value)} className={inputMonoClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of birth">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputMonoClass} />
            </Field>
            <Field label="Gender">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={isOrtho} onChange={(e) => setIsOrtho(e.target.checked)} className="rounded" />
            This patient is an orthodontic case
          </label>

          <div className="flex items-center justify-between pt-2">
            <GhostButton onClick={() => setMode('search')}>← Back to search</GhostButton>
            <PrimaryButton onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating…' : 'Create & continue →'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </StepCard>
  )
}
