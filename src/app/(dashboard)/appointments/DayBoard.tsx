'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LogIn,
  CheckCircle2,
  Stethoscope,
  UserRound,
  Clock,
  Undo2,
  X,
  CalendarClock,
  Wallet,
} from 'lucide-react'
import { updateAppointmentStatus, deleteAppointment } from './actions'

export type BoardAppointment = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  arrived_at: string | null
  seated_at: string | null
  clinic_id?: string | null
  clinic_name?: string | null
  /** Seen patients only, for staff who take money: what the patient still owes overall. */
  balance_due?: number | null
  patients: { id: string; full_name: string; phone: string | null; is_ortho: boolean } | null
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function minsSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000))
}

// No separate "in chair" lane: a patient is booked, here, or seen. Saving the
// treatment on the patient's page is what moves them to Seen. Older rows
// marked in_chair simply sit with the others who are here.
type LaneKey = 'scheduled' | 'here' | 'completed'

const LANES: { key: LaneKey; label: string; statuses: string[]; tint: string; head: string }[] = [
  { key: 'scheduled', label: 'Booked', statuses: ['scheduled'], tint: 'bg-ink/[0.03]', head: 'text-ink/55' },
  { key: 'here', label: 'Here', statuses: ['arrived', 'in_chair'], tint: 'bg-gold/[0.06]', head: 'text-gold-deep' },
  { key: 'completed', label: 'Seen', statuses: ['completed'], tint: 'bg-success/[0.08]', head: 'text-success' },
]

function money(n: number) {
  return `EGP ${Math.round(n).toLocaleString()}`
}

function Card({
  appt,
  nowMs,
  canTakePayment,
  onStatus,
  onRemove,
  pending,
}: {
  appt: BoardAppointment
  nowMs: number
  canTakePayment: boolean
  onStatus: (id: string, status: string) => void
  onRemove: (id: string) => void
  pending: boolean
}) {
  const name = appt.patients?.full_name || 'Unknown patient'
  const wait =
    appt.status === 'arrived' || appt.status === 'in_chair' ? minsSince(appt.arrived_at ?? appt.seated_at, nowMs) : null
  const seen = appt.status === 'completed'
  const due = appt.balance_due ?? null
  const settled = due !== null && due <= 0
  // Reception's next step for a seen patient is payment, so the name goes there.
  const nameHref = appt.patients
    ? seen && canTakePayment
      ? `/patients/${appt.patients.id}/billing`
      : `/patients/${appt.patients.id}`
    : null

  return (
    <div
      className={`rounded-control border shadow-soft px-3 py-2.5 space-y-2 ${
        seen
          ? `bg-success/[0.07] border-success/40 border-l-4 border-l-success ${settled ? 'opacity-70' : ''}`
          : 'bg-white border-ink/8'
      }`}
    >
      {seen && (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-success text-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
            <CheckCircle2 size={12} /> Seen
          </span>
          {canTakePayment && due !== null && (
            <span
              className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                due > 0 ? 'bg-gold/20 text-gold-deep' : 'bg-success/15 text-success'
              }`}
            >
              {due > 0 ? `To pay · ${money(due)}` : 'Paid ✓'}
            </span>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-ink/50">{hhmm(appt.scheduled_at)}</span>
            {appt.clinic_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal/10 text-teal-deep font-medium">
                {appt.clinic_name}
              </span>
            )}
            {appt.patients?.is_ortho && <span className="text-[10px] text-gold-deep">· Ortho</span>}
          </div>
          {nameHref ? (
            <Link
              href={nameHref}
              title={seen && canTakePayment ? 'Open billing to record the payment' : undefined}
              className="block text-sm text-ink-strong font-medium truncate hover:text-teal-deep"
            >
              {name}
            </Link>
          ) : (
            <span className="block text-sm text-ink-strong font-medium truncate">{name}</span>
          )}
          {appt.patients?.phone && (
            <p className="text-[11px] text-ink/40 font-mono truncate">{appt.patients.phone}</p>
          )}
        </div>
        {wait !== null && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
              wait >= 20 ? 'bg-danger/10 text-danger' : 'bg-ink/5 text-ink/50'
            }`}
            title="Minutes since check-in"
          >
            <Clock size={10} />
            {wait}m
          </span>
        )}
      </div>

      {appt.notes && <p className="text-[11px] text-ink/45 line-clamp-2">{appt.notes}</p>}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {appt.status === 'scheduled' && (
          <>
            <ActionBtn onClick={() => onStatus(appt.id, 'arrived')} disabled={pending} tone="gold">
              <LogIn size={12} /> Check in
            </ActionBtn>
            <ActionBtn onClick={() => onStatus(appt.id, 'no_show')} disabled={pending} tone="muted">
              No-show
            </ActionBtn>
          </>
        )}
        {(appt.status === 'arrived' || appt.status === 'in_chair') && (
          <>
            {appt.patients && <StartVisit patientId={appt.patients.id} />}
            <ActionBtn onClick={() => onStatus(appt.id, 'completed')} disabled={pending} tone="success">
              <CheckCircle2 size={12} /> Mark seen
            </ActionBtn>
          </>
        )}
        {(appt.status === 'scheduled' || appt.status === 'arrived' || appt.status === 'in_chair') && (
          <IconBtn
            onClick={() => onRemove(appt.id)}
            disabled={pending}
            title="Remove from the board (keeps the patient's record)"
          >
            <X size={13} />
          </IconBtn>
        )}
        {seen && (
          <>
            {appt.patients && canTakePayment && (
              <Link
                href={`/patients/${appt.patients.id}/billing`}
                className={
                  settled
                    ? 'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-control text-ink/55 hover:text-teal-deep hover:bg-marble transition-colors'
                    : 'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-control bg-gold text-white hover:bg-gold-deep font-medium transition-colors'
                }
              >
                <Wallet size={13} /> {settled ? 'Billing' : 'Take payment'}
              </Link>
            )}
            {appt.patients && (
              <Link
                href={`/patients/${appt.patients.id}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-control text-ink/55 hover:text-teal-deep hover:bg-marble transition-colors"
              >
                <UserRound size={12} /> Profile
              </Link>
            )}
            <ActionBtn onClick={() => onStatus(appt.id, 'arrived')} disabled={pending} tone="muted">
              <Undo2 size={12} /> Not done
            </ActionBtn>
          </>
        )}
      </div>
    </div>
  )
}

function StartVisit({ patientId }: { patientId: string }) {
  return (
    <Link
      href={`/patients/${patientId}`}
      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-control bg-teal text-white hover:bg-teal-deep transition-colors"
    >
      <Stethoscope size={12} /> Start visit
    </Link>
  )
}

function ActionBtn({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone: 'gold' | 'teal' | 'success' | 'muted'
}) {
  const tones: Record<string, string> = {
    gold: 'bg-gold/10 text-gold-deep hover:bg-gold/20',
    teal: 'bg-teal/10 text-teal-deep hover:bg-teal/20',
    success: 'bg-success/10 text-success hover:bg-success/20',
    muted: 'bg-ink/5 text-ink/50 hover:bg-ink/10',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-control transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center h-6 w-6 rounded-control text-ink/35 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export default function DayBoard({
  appointments,
  canTakePayment = false,
}: {
  appointments: BoardAppointment[]
  canTakePayment?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  function setStatus(id: string, status: string) {
    setErr(null)
    startTransition(async () => {
      const res = await updateAppointmentStatus(id, status)
      if (!res?.ok) {
        setErr(
          (res?.message || 'Update failed') +
            (status === 'arrived'
              ? ' — run migration 07_appointments_workflow.sql to enable check-in.'
              : '')
        )
        return
      }
      router.refresh()
    })
  }
  function remove(id: string) {
    const appt = appointments.find((a) => a.id === id)
    const name = appt?.patients?.full_name || 'this patient'
    if (
      !confirm(
        `Remove ${name} from today's board?\n\n` +
          "Their patient record, history and images are not affected \u2014 " +
          'this only takes them off the list.'
      )
    )
      return
    startTransition(async () => {
      await deleteAppointment(id)
      router.refresh()
    })
  }

  const inLane = (statuses: string[]) => appointments.filter((a) => statuses.includes(a.status))
  const offRamp = appointments.filter((a) => a.status === 'no_show' || a.status === 'cancelled')

  return (
    <div className="space-y-4">
      {err && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-2.5 rounded-control">{err}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {LANES.map((lane) => {
          const items = inLane(lane.statuses)
          return (
            <div key={lane.key} className={`rounded-card ${lane.tint} p-3 min-h-[8rem]`}>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <span className={`text-[11px] uppercase tracking-wider font-mono ${lane.head}`}>
                  {lane.label}
                </span>
                <span className={`text-xs font-mono ${lane.head}`}>{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((a) => (
                  <Card
                    key={a.id}
                    appt={a}
                    nowMs={nowMs}
                    canTakePayment={canTakePayment}
                    onStatus={setStatus}
                    onRemove={remove}
                    pending={isPending}
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-[11px] text-ink/30 text-center py-6">
                    {lane.key === 'scheduled' ? 'Nothing booked' : '—'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {offRamp.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/45">
          <CalendarClock size={13} />
          <span className="font-mono uppercase tracking-wider text-[10px]">Not seen:</span>
          {offRamp.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 bg-ink/5 rounded-full px-2.5 py-1">
              {a.patients?.full_name || 'Unknown'}
              <span className="text-ink/35">· {a.status.replace('_', ' ')}</span>
              <button
                type="button"
                onClick={() => setStatus(a.id, 'scheduled')}
                className="text-teal-deep hover:underline"
                title="Restore to scheduled"
              >
                undo
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
