'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Printer, CalendarPlus, UserRound, RefreshCw, Check } from 'lucide-react'
import type { PaymentSummary, ReceptionPatient, SavedVisit } from '../types'
import { createAppointment } from '../../appointments/actions'
import { localDateTimeToIso } from '@/lib/utils'
import PatientReportButton from '@/components/PatientReportButton'
import { StepCard, PrimaryButton, GhostButton, SectionLabel, inputMonoClass } from '../ui'

function dateInWeeks(weeks: number | null): string {
  const d = new Date()
  if (weeks && weeks > 0) d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export default function StepDone({
  patient,
  visit,
  payment,
  nextVisitWeeks,
  onRestart,
}: {
  patient: ReceptionPatient
  visit: SavedVisit
  payment: PaymentSummary | null
  nextVisitWeeks: number | null
  onRestart: () => void
}) {
  const charged = Number(visit.fee) || 0
  const paid = payment?.amount || 0
  const balance = charged - paid

  const [booking, setBooking] = useState(false)
  const [date, setDate] = useState(dateInWeeks(nextVisitWeeks))
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('30')
  const [bookResult, setBookResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function book() {
    setBookResult(null)
    if (!date || !time) {
      setBookResult({ ok: false, message: 'Pick a date and time' })
      return
    }
    const fd = new FormData()
    fd.set('patient_id', patient.id)
    fd.set('date', date)
    fd.set('time', time)
    fd.set('duration', duration)
    const iso = localDateTimeToIso(date, time)
    if (iso) fd.set('scheduled_at', iso)

    startTransition(async () => {
      const res = await createAppointment(fd)
      setBookResult(res)
      if (res.ok) setBooking(false)
    })
  }

  return (
    <StepCard title="All set" subtitle={patient.full_name}>
      <div className="space-y-6">
        {/* Summary */}
        <div className="rounded-control border border-ink/10 overflow-hidden">
          <div className="px-4 py-3 bg-marble/60 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
              <Check size={14} />
            </span>
            <p className="text-sm text-ink-strong font-medium">Visit recorded</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {visit.procedures.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visit.procedures.map((name, i) => (
                  <span key={i} className="bg-teal/10 text-teal-deep text-xs px-2 py-1 rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div>
                <SectionLabel>Charged</SectionLabel>
                <p className="font-mono text-lg text-ink-strong mt-1">EGP {charged.toLocaleString()}</p>
              </div>
              <div>
                <SectionLabel>Paid</SectionLabel>
                <p className="font-mono text-lg text-success mt-1">EGP {paid.toLocaleString()}</p>
              </div>
              <div>
                <SectionLabel>Balance</SectionLabel>
                <p className={`font-mono text-lg mt-1 ${balance > 0 ? 'text-danger' : 'text-ink-strong'}`}>
                  EGP {balance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 gap-2.5">
          {payment?.paymentId && (
            <a
              href={`/receipts/payment/${payment.paymentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
                <Printer size={16} />
              </span>
              <span className="text-sm text-ink-strong font-medium">Print receipt</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setBooking((b) => !b)}
            className="flex items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
              <CalendarPlus size={16} />
            </span>
            <span>
              <span className="block text-sm text-ink-strong font-medium">Book next visit</span>
              {nextVisitWeeks && (
                <span className="block text-xs text-ink/45 font-mono">suggested in {nextVisitWeeks} wks</span>
              )}
            </span>
          </button>

          <PatientReportButton patientId={patient.id} variant="tile" label="Patient report (PDF)" />

          <Link
            href={`/patients/${patient.id}`}
            className="flex items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/20 text-ink-strong">
              <UserRound size={16} />
            </span>
            <span className="text-sm text-ink-strong font-medium">Open full profile</span>
          </Link>

          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marquina text-gold-light">
              <RefreshCw size={16} />
            </span>
            <span className="text-sm text-ink-strong font-medium">Next walk-in</span>
          </button>
        </div>

        {/* Inline booking */}
        {booking && (
          <div className="rounded-control bg-cream/50 p-4 space-y-3">
            {bookResult && (
              <div
                className={`text-xs px-3 py-2 rounded-control ${
                  bookResult.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}
              >
                {bookResult.message}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-ink/60">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputMonoClass} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink/60">Time</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputMonoClass} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink/60">Duration</span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setBooking(false)}>Cancel</GhostButton>
              <PrimaryButton onClick={book} disabled={isPending}>
                {isPending ? 'Booking…' : 'Book appointment'}
              </PrimaryButton>
            </div>
          </div>
        )}

        {bookResult?.ok && !booking && (
          <div className="bg-success/10 text-success text-sm px-4 py-3 rounded-control">
            Next appointment booked ✦
          </div>
        )}
      </div>
    </StepCard>
  )
}
