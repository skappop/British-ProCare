import { CalendarClock, CheckCircle2, Clock3, Stethoscope } from 'lucide-react'
import type { BoardAppointment } from './DayBoard'

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusText(status: string) {
  if (status === 'completed') return 'Seen'
  if (status === 'arrived' || status === 'in_chair') return 'Here'
  if (status === 'no_show') return 'No-show'
  return 'Booked'
}

export default function DayTimeline({ appointments }: { appointments: BoardAppointment[] }) {
  const ordered = [...appointments].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  if (!ordered.length) return null

  return (
    <section className="rounded-card border border-ink/8 bg-white px-4 py-4 shadow-soft sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-teal-deep" />
          <h2 className="text-sm font-medium text-ink-strong">Today&apos;s timeline</h2>
        </div>
        <span className="text-[11px] text-ink/40">{ordered.length} patient{ordered.length === 1 ? '' : 's'}</span>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max items-start">
          {ordered.map((appointment, index) => {
            const seen = appointment.status === 'completed'
            const here = appointment.status === 'arrived' || appointment.status === 'in_chair'
            return (
              <div key={appointment.id} className="relative flex w-44 shrink-0 flex-col pr-4 sm:w-52">
                {index < ordered.length - 1 && <span aria-hidden className="absolute left-5 right-0 top-5 h-px bg-ink/10" />}
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${seen ? 'bg-success text-white' : here ? 'bg-gold text-white' : 'bg-teal/10 text-teal-deep'}`}>
                  {seen ? <CheckCircle2 size={16} /> : here ? <Stethoscope size={16} /> : <Clock3 size={16} />}
                </div>
                <p className="mt-2 font-mono text-xs text-ink/55">{time(appointment.scheduled_at)}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink-strong">{appointment.patients?.full_name || 'Unknown patient'}</p>
                <p className={`mt-0.5 text-[11px] ${seen ? 'text-success' : here ? 'text-gold-deep' : 'text-ink/45'}`}>
                  {statusText(appointment.status)}{appointment.clinic_name ? ` · ${appointment.clinic_name}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
