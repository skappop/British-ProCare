'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateAppointmentStatus, deleteAppointment } from './actions'

type Appointment = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  patients: { full_name: string; phone: string | null; is_ortho: boolean } | null
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-teal/10 text-teal-deep',
  completed: 'bg-success/10 text-success',
  no_show: 'bg-danger/10 text-danger',
  cancelled: 'bg-ink/10 text-ink/40',
}

function groupByDay(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const a of appointments) {
    const key = new Date(a.scheduled_at).toISOString().slice(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  return groups
}

function AppointmentRow({ appt }: { appt: Appointment }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function setStatus(status: string) {
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, status)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm('Delete this appointment?')) return
    startTransition(async () => {
      await deleteAppointment(appt.id)
      router.refresh()
    })
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink/50 w-14 shrink-0">
          {new Date(appt.scheduled_at).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <div>
          <p className="text-sm text-ink-strong font-medium">
            {appt.patients?.full_name || 'Unknown patient'}
            {appt.patients?.is_ortho && (
              <span className="text-gold-deep text-xs ml-1.5">· Ortho</span>
            )}
          </p>
          {appt.notes && <p className="text-xs text-ink/40 mt-0.5">{appt.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[appt.status]}`}
        >
          {appt.status.replace('_', ' ')}
        </span>
        {appt.status === 'scheduled' && (
          <div className="flex gap-1">
            <button
              disabled={isPending}
              onClick={() => setStatus('completed')}
              className="text-[10px] px-2 py-1 rounded-control bg-success/10 text-success hover:bg-success/20"
            >
              done
            </button>
            <button
              disabled={isPending}
              onClick={() => setStatus('no_show')}
              className="text-[10px] px-2 py-1 rounded-control bg-danger/10 text-danger hover:bg-danger/20"
            >
              no-show
            </button>
            <button
              disabled={isPending}
              onClick={() => setStatus('cancelled')}
              className="text-[10px] px-2 py-1 rounded-control bg-ink/5 text-ink/50 hover:bg-ink/10"
            >
              cancel
            </button>
          </div>
        )}
        <button disabled={isPending} onClick={remove} className="text-[10px] text-danger/50 hover:text-danger">
          ✕
        </button>
      </div>
    </div>
  )
}

export default function AppointmentList({
  view,
  rangeStart,
  appointments,
}: {
  view: 'day' | 'week'
  rangeStart: string
  appointments: Appointment[]
}) {
  if (view === 'day') {
    return (
      <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
        {appointments.map((a) => (
          <AppointmentRow key={a.id} appt={a} />
        ))}
        {appointments.length === 0 && (
          <div className="px-4 py-10 text-center text-ink/40 text-sm">No appointments scheduled.</div>
        )}
      </div>
    )
  }

  const grouped = groupByDay(appointments)
  const start = new Date(rangeStart)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10)
        const dayAppts = grouped[key] || []
        const isToday = key === todayKey
        return (
          <div
            key={key}
            className={`bg-white rounded-card shadow-soft overflow-hidden ${
              isToday ? 'ring-2 ring-gold/50' : ''
            }`}
          >
            <div className="px-2 py-2 border-b border-ink/8 text-center">
              <p className="text-[10px] uppercase tracking-wider text-ink/40">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </p>
              <p className="text-sm font-mono text-ink-strong">{d.getDate()}</p>
            </div>
            <div className="divide-y divide-ink/5 max-h-80 overflow-y-auto">
              {dayAppts.map((a) => (
                <div key={a.id} className="px-2 py-1.5">
                  <p className="text-[10px] font-mono text-ink/50">
                    {new Date(a.scheduled_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-ink-strong truncate">{a.patients?.full_name}</p>
                </div>
              ))}
              {dayAppts.length === 0 && (
                <p className="px-2 py-4 text-center text-[10px] text-ink/30">—</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
