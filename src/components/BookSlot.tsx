'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { getBookingsBetween, type DayBooking } from '@/app/(dashboard)/appointments/actions'
import { localDateTimeToIso } from '@/lib/utils'
import { useStoredValue } from '@/lib/useStoredValue'

export type Slot = {
  iso: string
  date: string
  time: string
  duration: number
  notes: string
  /** null: decide which clinic when the patient arrives. */
  clinicId: string | null
  /** "Tue 24 Sep, 14:30 · Clinic 1" — for confirmations. */
  label: string
}

type BookResult = { ok: boolean; message?: string; duplicate?: boolean }

const REASONS = ['Check-up', 'Consultation', 'Follow-up', 'Treatment', 'Ortho adjustment']
const LATER = 'later'

function isoDay(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Booking a time, the same everywhere: the day (with what is already booked
 * on it, so a free time is easy to pick), the time, what it is for, and the
 * clinic — or "decide when they arrive", chosen at check-in.
 */
export default function BookSlot({
  clinics,
  defaultDate,
  defaultNotes,
  submitLabel = 'Book',
  onBook,
  onCancel,
}: {
  clinics: { id: string; name: string }[]
  defaultDate?: string
  defaultNotes?: string | null
  submitLabel?: string
  /** Books it. `allowSecond` is set after the person confirmed a second booking the same day. */
  onBook: (slot: Slot, allowSecond: boolean) => Promise<BookResult>
  onCancel?: () => void
}) {
  const [date, setDate] = useState(defaultDate || isoDay(0))
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState(defaultNotes ?? '')
  const [myClinic] = useStoredValue('procare.clinic')
  const [clinic, setClinic] = useState<string>(LATER)
  const [day, setDay] = useState<{ date: string; items: DayBooking[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSecond, setConfirmSecond] = useState<string | null>(null)
  const [openedAt] = useState(() => Date.now())

  // What is already booked on the chosen day.
  useEffect(() => {
    if (!date) return
    let live = true
    const from = new Date(`${date}T00:00`)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    if (Number.isNaN(from.getTime())) return
    getBookingsBetween(from.toISOString(), to.toISOString()).then((items) => {
      if (live) setDay({ date, items })
    })
    return () => {
      live = false
    }
  }, [date])

  const iso = localDateTimeToIso(date, time)
  const clinicId = clinic === LATER ? null : clinic
  const clinicName = clinicId ? clinics.find((c) => c.id === clinicId)?.name ?? null : null
  const items = day?.date === date ? day.items : null
  // Someone already at (about) that time in the same clinic, or either clinic when undecided.
  const clash = iso
    ? items?.filter(
        (b) =>
          Math.abs(new Date(b.at).getTime() - new Date(iso).getTime()) < 15 * 60_000 &&
          (!clinicId || !b.clinic_id || b.clinic_id === clinicId)
      ) ?? []
    : []
  const inPast = iso ? new Date(iso).getTime() < openedAt - 5 * 60_000 : false

  const whenLabel = iso
    ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  async function book(allowSecond = false) {
    if (!iso) return setError('Pick a day and a time')
    setError(null)
    setBusy(true)
    const slot: Slot = {
      iso,
      date,
      time,
      duration,
      notes: notes.trim(),
      clinicId,
      label: `${whenLabel} · ${clinicName ?? 'clinic decided on arrival'}`,
    }
    try {
      const res = await onBook(slot, allowSecond)
      if (res.duplicate) setConfirmSecond(res.message || 'Already booked that day. Book another one?')
      else if (!res.ok) setError(res.message || 'Could not book')
      else setConfirmSecond(null)
    } catch {
      setError('Could not book — check the connection and try again')
    } finally {
      setBusy(false)
    }
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/70 hover:border-teal'}`
  const field =
    'rounded-control border border-ink/15 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal'

  return (
    <div className="space-y-3">
      {/* When */}
      <div className="space-y-1.5">
        <p className="text-xs text-ink/60">When</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'Today', value: isoDay(0) },
            { label: 'Tomorrow', value: isoDay(1) },
          ].map((d) => (
            <button key={d.label} type="button" onClick={() => setDate(d.value)} className={chip(date === d.value)}>
              {d.label}
            </button>
          ))}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} font-mono`} aria-label="Day" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} font-mono`} aria-label="Time" step={300} />
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field} aria-label="Length">
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        {/* The day so far */}
        <div className="rounded-control bg-marble/60 px-2.5 py-2 text-xs text-ink/60">
          <span className="mr-1.5 inline-flex items-center gap-1 font-medium text-ink/70">
            <CalendarClock size={12} /> Booked that day:
          </span>
          {items === null ? (
            'loading…'
          ) : items.length === 0 ? (
            'nothing yet'
          ) : (
            items.map((b, i) => (
              <span key={i} className="mr-2 inline-block whitespace-nowrap">
                <span className="font-mono">{hhmm(b.at)}</span> {b.name.split(' ')[0]}
                {clinics.length > 1 && <span className="text-ink/40"> ({b.clinic ?? 'on arrival'})</span>}
              </span>
            ))
          )}
        </div>
        {clash.length > 0 && (
          <p className="text-xs text-gold-deep">
            Heads up: {clash.map((b) => `${b.name.split(' ')[0]} at ${hhmm(b.at)}`).join(', ')} {clash.length === 1 ? 'is' : 'are'} already booked around then.
          </p>
        )}
        {inPast && <p className="text-xs text-danger">That time has already passed.</p>}
      </div>

      {/* What for */}
      <div className="space-y-1.5">
        <p className="text-xs text-ink/60">What for</p>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setNotes(notes === r ? '' : r)} className={chip(notes === r)}>
              {r}
            </button>
          ))}
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Or type it: e.g. pain upper right, bracket rebond"
          className={`${field} w-full`}
          aria-label="What the appointment is for"
        />
      </div>

      {/* Where */}
      {clinics.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-ink/60">Clinic</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setClinic(LATER)} className={chip(clinic === LATER)}>
              Decide when they arrive
            </button>
            {clinics.map((c) => (
              <button key={c.id} type="button" onClick={() => setClinic(c.id)} className={chip(clinic === c.id)}>
                {c.name}
                {c.id === myClinic ? ' (this computer)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {confirmSecond && (
        <div className="space-y-2 rounded-control bg-gold/10 px-3 py-2 text-sm text-ink-strong">
          <p>{confirmSecond}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmSecond(null)} className="rounded-control border border-ink/15 bg-white px-3 py-1.5 text-xs">
              No
            </button>
            <button type="button" disabled={busy} onClick={() => book(true)} className="rounded-control bg-teal px-3 py-1.5 text-xs text-white">
              Yes, book this one too
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !iso || !!confirmSecond}
          onClick={() => book(false)}
          className="flex-1 rounded-control bg-teal px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-deep disabled:bg-ink/20"
        >
          {busy ? 'Booking…' : iso ? `${submitLabel} · ${whenLabel}` : 'Pick a time'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2.5 text-sm text-ink/50 hover:text-ink-strong">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/** A booking made from a Slot, via the one server action. */
export function slotForm(patientId: string, slot: Slot, allowSecond: boolean) {
  const fd = new FormData()
  fd.set('patient_id', patientId)
  fd.set('date', slot.date)
  fd.set('time', slot.time)
  fd.set('scheduled_at', slot.iso)
  fd.set('duration', String(slot.duration))
  if (slot.notes) fd.set('notes', slot.notes)
  if (slot.clinicId) fd.set('clinic_id', slot.clinicId)
  if (allowSecond) fd.set('allow_second', '1')
  return fd
}
