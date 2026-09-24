'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CheckCircle2, Clock, Stethoscope } from 'lucide-react'
import { createAppointment, updateAppointmentStatus } from '../../appointments/actions'
import { localDateTimeToIso } from '@/lib/utils'

export type CurrentVisit = {
  id: string
  status: 'scheduled' | 'arrived' | 'in_chair'
  scheduled_at: string
  arrived_at: string | null
  seated_at: string | null
  clinic: string | null
  notes: string | null
}

export type SeenVisit = { id: string; clinic: string | null }

export type Upcoming = { id: string; scheduled_at: string; clinic: string | null; duration_minutes: number }

function mins(since: string | null, now: number) {
  return since ? Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000)) : 0
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Today's visit and the next one, on the patient's page. There is no seating
 * step: the patient is either here or seen, and saving the treatment at the
 * bottom of the page is what marks them seen. The follow-up is booked here too.
 */
export default function VisitPanel({
  patientId,
  current,
  seenToday,
  upcoming,
  clinics,
  defaultClinicId,
  suggestedWeeks,
}: {
  patientId: string
  current: CurrentVisit | null
  seenToday: SeenVisit | null
  upcoming: Upcoming[]
  clinics: { id: string; name: string }[]
  defaultClinicId: string | null
  suggestedWeeks: number | null
}) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [booking, setBooking] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('30')
  const [clinicId, setClinicId] = useState(defaultClinicId ?? clinics[0]?.id ?? '')
  const [note, setNote] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // For a visit with nothing to record (a consultation, a check): the usual
  // way to finish is saving the treatment at the bottom of the page.
  function markSeen() {
    if (!current) return
    if (!confirm('Mark as seen without saving any treatment?\n\nReception will see them as ready for payment.')) return
    setMessage(null)
    startTransition(async () => {
      const res = await updateAppointmentStatus(current.id, 'completed')
      if (!res?.ok) setMessage({ ok: false, text: res?.message || 'Could not update the visit' })
      router.refresh()
    })
  }

  function inWeeks(weeks: number) {
    const d = new Date()
    d.setDate(d.getDate() + weeks * 7)
    setDate(isoDate(d))
  }

  function book() {
    setMessage(null)
    const iso = localDateTimeToIso(date, time)
    if (!iso) {
      setMessage({ ok: false, text: 'Pick a date and time' })
      return
    }
    const fd = new FormData()
    fd.set('patient_id', patientId)
    fd.set('date', date)
    fd.set('time', time)
    fd.set('scheduled_at', iso)
    fd.set('duration', duration)
    if (clinicId) fd.set('clinic_id', clinicId)
    if (note.trim()) fd.set('notes', note.trim())
    startTransition(async () => {
      const res = await createAppointment(fd)
      setMessage({ ok: res.ok, text: res.ok ? `Booked for ${when(iso)}` : res.message })
      if (res.ok) {
        setBooking(false)
        setNote('')
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-5 space-y-4">
      {current && current.status !== 'scheduled' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                current.status === 'in_chair' ? 'bg-teal/10 text-teal-deep' : 'bg-gold/15 text-gold-deep'
              }`}
            >
              {current.status === 'in_chair' ? <Stethoscope size={13} /> : <Clock size={13} />}
              {current.status === 'in_chair'
                ? `With the doctor · ${mins(current.seated_at ?? current.arrived_at, now)} min`
                : `Here · waiting ${mins(current.arrived_at, now)} min`}
            </span>
            {current.clinic && <span className="text-xs text-ink/45">{current.clinic}</span>}
          </div>
          <div className="flex items-center gap-3">
            <a href="#treatment" className="text-sm text-teal-deep hover:underline">
              Record treatment ↓
            </a>
            <button
              type="button"
              onClick={markSeen}
              disabled={isPending}
              className="text-xs text-ink/45 hover:text-ink-strong disabled:opacity-50"
            >
              Mark seen, nothing to record
            </button>
          </div>
          {current.notes && <p className="basis-full text-sm text-ink/60">{current.notes}</p>}
        </div>
      ) : current ? (
        <p className="text-sm text-ink/60">
          Booked today at{' '}
          <span className="font-medium text-ink-strong">
            {new Date(current.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {current.clinic ? ` · ${current.clinic}` : ''} — not checked in yet.
        </p>
      ) : seenToday ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1 text-xs font-semibold">
            <CheckCircle2 size={14} /> Seen today
          </span>
          <span className="text-sm text-ink/50">
            {seenToday.clinic ? `${seenToday.clinic} · ` : ''}with reception for payment
          </span>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-ink-strong">Next visit</h3>
          {!booking && (
            <button
              type="button"
              onClick={() => {
                setBooking(true)
                if (!date) inWeeks(suggestedWeeks ?? 2)
              }}
              className="inline-flex items-center gap-1.5 text-sm text-teal-deep hover:underline"
            >
              <CalendarPlus size={15} /> Book next visit
            </button>
          )}
        </div>

        {upcoming.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {upcoming.map((u) => (
              <li key={u.id} className="text-sm text-ink/70">
                {when(u.scheduled_at)}
                <span className="text-ink/40">
                  {' '}
                  · {u.duration_minutes} min{u.clinic ? ` · ${u.clinic}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          !booking && <p className="mt-1 text-sm text-ink/40">Nothing booked.</p>
        )}

        {booking && (
          <div className="mt-3 space-y-3 rounded-control bg-marble/60 p-3">
            <div className="flex flex-wrap gap-1.5">
              {suggestedWeeks && (
                <Chip onClick={() => inWeeks(suggestedWeeks)}>In {suggestedWeeks} weeks (ortho plan)</Chip>
              )}
              <Chip onClick={() => inWeeks(1)}>1 week</Chip>
              <Chip onClick={() => inWeeks(2)}>2 weeks</Chip>
              <Chip onClick={() => inWeeks(4)}>1 month</Chip>
              <Chip onClick={() => inWeeks(26)}>6 months</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-control border border-ink/15 bg-white px-2 py-1.5 text-sm" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-control border border-ink/15 bg-white px-2 py-1.5 text-sm" />
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-control border border-ink/15 bg-white px-2 py-1.5 text-sm">
                {['15', '30', '45', '60', '90'].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
              {clinics.length > 1 && (
                <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className="rounded-control border border-ink/15 bg-white px-2 py-1.5 text-sm">
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional) — e.g. continue root canal"
              className="w-full rounded-control border border-ink/15 bg-white px-2 py-1.5 text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={book}
                disabled={isPending}
                className="rounded-control bg-teal hover:bg-teal-deep text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Book
              </button>
              <button type="button" onClick={() => setBooking(false)} className="text-sm text-ink/50 hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>
      )}
    </div>
  )
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs text-ink/70 hover:border-teal hover:text-teal-deep"
    >
      {children}
    </button>
  )
}
