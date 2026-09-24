import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BookingForm from './BookingForm'
import AppointmentList from './AppointmentList'
import DayBoard, { type BoardAppointment } from './DayBoard'
import ClinicSwitcher from '@/components/ClinicSwitcher'
import LiveRefresh from '@/components/LiveRefresh'
import { getClinics } from '@/lib/clinics'
import { canHandleMoney } from '@/lib/auth/role'
import { getPayStates } from '@/lib/payStatus'
import { needsReception } from '@/lib/payState'

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
  searchParams: Promise<{ view?: string; date?: string; clinic?: string }>
}) {
  const { view: viewParam, date: dateParam } = await searchParams
  const view = viewParam === 'week' ? 'week' : 'day'
  const anchor = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()

  const supabase = await createClient()
  const clinics = await getClinics()

  // Every clinic is always listed; the board puts this computer's clinic first.

  const rangeStart = view === 'week' ? startOfWeek(anchor) : startOfDay(anchor)
  const rangeEnd = view === 'week' ? addDays(rangeStart, 7) : addDays(rangeStart, 1)

  const BASE_COLUMNS =
    'id, scheduled_at, duration_minutes, status, notes, arrived_at, seated_at, patients(id, full_name, phone, is_ortho)'

  async function fetchAppointments(withClinic: boolean) {
    const query = supabase
      .from('appointments')
      .select(withClinic ? `${BASE_COLUMNS}, clinic_id` : BASE_COLUMNS)
      .gte('scheduled_at', rangeStart.toISOString())
      .lt('scheduled_at', rangeEnd.toISOString())

    return query.order('scheduled_at', { ascending: true })
  }

  // Until migration 13 is run there is no clinic_id column, and asking for it
  // would fail the whole query and blank the board. Fall back to the un-tagged
  // shape rather than showing an empty day.
  const first = await fetchAppointments(clinics.length > 0)
  const appointments = first.error ? (await fetchAppointments(false)).data : first.data

  const list = (appointments as any[]) || []
  const dayAppts: BoardAppointment[] = list.map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    notes: a.notes,
    arrived_at: a.arrived_at,
    seated_at: a.seated_at,
    clinic_id: a.clinic_id ?? null,
    clinic_name: clinics.find((c) => c.id === a.clinic_id)?.short_name
      ?? clinics.find((c) => c.id === a.clinic_id)?.name
      ?? null,
    patients: a.patients
      ? {
          id: a.patients.id,
          full_name: a.patients.full_name,
          phone: a.patients.phone,
          is_ortho: !!a.patients.is_ortho,
        }
      : null,
  }))

  // Seen patients get their outstanding balance, so reception can tell at a
  // glance who still has to pay. Money figures only for staff who take money.
  const canTakePayment = await canHandleMoney()
  const seenIds = [...new Set(dayAppts.filter((a) => a.status === 'completed' && a.patients).map((a) => a.patients!.id))]
  if (canTakePayment && seenIds.length > 0) {
    const pay = await getPayStates(supabase, seenIds, rangeStart, rangeEnd)
    for (const a of dayAppts) {
      if (a.status === 'completed' && a.patients) {
        const p = pay.get(a.patients.id)
        a.balance_due = p?.due ?? 0
        a.pay_state = p?.state ?? 'unknown'
      }
    }
  }

  const count = (...statuses: string[]) => dayAppts.filter((a) => statuses.includes(a.status)).length
  const summary = [
    { label: 'Booked', value: count('scheduled'), cls: 'text-ink/60' },
    { label: 'Here', value: count('arrived', 'in_chair'), cls: 'text-gold-deep' },
    { label: 'Seen', value: count('completed'), cls: 'text-success' },
    ...(canTakePayment
      ? [{ label: 'To pay', value: dayAppts.filter((a) => a.status === 'completed' && needsReception(a.pay_state)).length, cls: 'text-danger' }]
      : []),
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
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-display text-2xl text-ink-strong">Appointments</h1>
            <LiveRefresh tables={['appointments', 'visits', 'payments']} />
          </div>
        </div>
        <ClinicSwitcher clinics={clinics} />
        <div className="hidden" />
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
          <div className={`grid grid-cols-2 gap-3 ${summary.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
            <DayBoard appointments={dayAppts} canTakePayment={canTakePayment} />
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
