import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BookingForm from './BookingForm'
import AppointmentList from './AppointmentList'
import DayBoard, { type BoardAppointment } from './DayBoard'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  return x
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const { view: viewParam, date: dateParam } = await searchParams
  const view = viewParam === 'week' ? 'week' : 'day'
  const anchor = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()

  const supabase = await createClient()

  const rangeStart = view === 'week' ? startOfWeek(anchor) : startOfDay(anchor)
  const rangeEnd = view === 'week' ? addDays(rangeStart, 7) : addDays(rangeStart, 1)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, scheduled_at, duration_minutes, status, notes, arrived_at, seated_at, patients(id, full_name, phone, is_ortho)'
    )
    .gte('scheduled_at', rangeStart.toISOString())
    .lt('scheduled_at', rangeEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  const list = (appointments as any[]) || []
  const dayAppts: BoardAppointment[] = list.map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    notes: a.notes,
    arrived_at: a.arrived_at,
    seated_at: a.seated_at,
    patients: a.patients
      ? {
          id: a.patients.id,
          full_name: a.patients.full_name,
          phone: a.patients.phone,
          is_ortho: !!a.patients.is_ortho,
        }
      : null,
  }))

  const count = (s: string) => dayAppts.filter((a) => a.status === s).length
  const summary = [
    { label: 'Booked', value: count('scheduled'), cls: 'text-ink/60' },
    { label: 'Waiting', value: count('arrived'), cls: 'text-gold-deep' },
    { label: 'In chair', value: count('in_chair'), cls: 'text-teal-deep' },
    { label: 'Done', value: count('completed'), cls: 'text-success' },
  ]

  const prevDate = toDateStr(addDays(anchor, view === 'week' ? -7 : -1))
  const nextDate = toDateStr(addDays(anchor, view === 'week' ? 7 : 1))
  const todayStr = toDateStr(new Date())
  const isToday = toDateStr(anchor) === todayStr

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Schedule</p>
          <h1 className="font-display text-2xl text-ink-strong mt-1">Appointments</h1>
        </div>
        <div className="flex rounded-control border border-ink/15 overflow-hidden">
          <Link
            href={`/appointments?view=day&date=${dateParam || todayStr}`}
            className={`px-3 py-1.5 text-xs ${view === 'day' ? 'bg-teal text-white' : 'bg-white text-ink/60 hover:bg-marble/60'}`}
          >
            Day tracker
          </Link>
          <Link
            href={`/appointments?view=week&date=${dateParam || todayStr}`}
            className={`px-3 py-1.5 text-xs ${view === 'week' ? 'bg-teal text-white' : 'bg-white text-ink/60 hover:bg-marble/60'}`}
          >
            Week
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/appointments?view=${view}&date=${prevDate}`}
            className="px-3 py-1.5 rounded-control border border-ink/15 text-xs text-ink/60 hover:bg-marble/60"
          >
            ← Prev
          </Link>
          <Link
            href={`/appointments?view=${view}&date=${todayStr}`}
            className="px-3 py-1.5 rounded-control border border-gold/40 text-xs text-gold-deep hover:bg-gold/10"
          >
            Today
          </Link>
          <Link
            href={`/appointments?view=${view}&date=${nextDate}`}
            className="px-3 py-1.5 rounded-control border border-ink/15 text-xs text-ink/60 hover:bg-marble/60"
          >
            Next →
          </Link>
        </div>
        <span className="text-sm text-ink/50 font-mono">
          {view === 'week'
            ? `${rangeStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${addDays(
                rangeStart,
                6
              ).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
            : anchor.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
        </span>
      </div>

      {view === 'day' ? (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.map((s) => (
              <div key={s.label} className="bg-white rounded-card shadow-soft px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">{s.label}</p>
                <p className={`text-2xl font-mono mt-0.5 ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {dayAppts.length === 0 ? (
            <div className="bg-white rounded-card shadow-soft px-4 py-12 text-center text-ink/40 text-sm">
              {isToday ? 'No one booked today yet.' : 'No appointments on this day.'}
            </div>
          ) : (
            <DayBoard appointments={dayAppts} />
          )}

          {/* Booking */}
          <div className="max-w-md">
            <BookingForm defaultDate={toDateStr(anchor)} />
          </div>
        </>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AppointmentList
              view="week"
              rangeStart={rangeStart.toISOString()}
              appointments={list as any[]}
            />
          </div>
          <div>
            <BookingForm defaultDate={toDateStr(anchor)} />
          </div>
        </div>
      )}
    </div>
  )
}
