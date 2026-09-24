'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Stethoscope, Wallet } from 'lucide-react'
import { useStoredValue } from '@/lib/useStoredValue'
import type { WaitingRow } from './waiting'

/**
 * Who is here, at the top of the patient list — the doctor's way into today's
 * patients without the appointments board. For reception it also lists who has
 * been seen and still has to pay; tapping one opens their billing.
 * Follows the clinic chosen on the board, if one was chosen on this device.
 */
export default function WaitingNow({ rows }: { rows: WaitingRow[] }) {
  const [clinic, setClinic] = useStoredValue('procare.clinic')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const followed = clinic && rows.some((r) => r.clinic_id === clinic) ? clinic : null
  const shown = followed ? rows.filter((r) => r.clinic_id === followed || !r.clinic_id) : rows
  const here = shown.filter((r) => r.status !== 'completed')
  const seen = shown.filter((r) => r.status === 'completed')
  if (rows.length === 0) return null

  const mins = (since: string | null) =>
    since ? Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000)) : 0

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-[0.2em] text-gold-deep font-mono">Now</h2>
        {followed && (
          <button type="button" onClick={() => setClinic(null)} className="text-xs text-ink/45 hover:text-teal-deep">
            Show all clinics
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {here.map((r) => (
          <Link
            key={r.appointment_id}
            href={`/patients/${r.patient_id}`}
            className="rounded-card border border-gold/30 bg-gold/[0.05] px-4 py-3 transition-colors hover:border-teal"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink-strong truncate">{r.name}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs ${
                  r.status === 'in_chair' ? 'text-teal-deep' : mins(r.since) >= 20 ? 'text-danger' : 'text-gold-deep'
                }`}
              >
                {r.status === 'in_chair' ? <Stethoscope size={12} /> : <Clock size={12} />}
                {r.status === 'in_chair' ? 'With doctor' : 'Waiting'} · {mins(r.since)}m
              </span>
            </div>
            {(r.clinic || r.note) && (
              <p className="text-xs text-ink/50 mt-1 truncate">{[r.clinic, r.note].filter(Boolean).join(' · ')}</p>
            )}
          </Link>
        ))}
        {seen.map((r) => (
          <Link
            key={r.appointment_id}
            href={`/patients/${r.patient_id}/billing`}
            title="Open billing to record the payment"
            className="rounded-card border border-success/40 border-l-4 border-l-success bg-success/[0.07] px-4 py-3 transition-colors hover:bg-success/[0.12]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink-strong truncate">{r.name}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success text-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                <CheckCircle2 size={12} /> Seen
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gold-deep font-medium">
              <Wallet size={12} /> Take payment · EGP {Math.round(r.balance_due ?? 0).toLocaleString()}
              {r.clinic && <span className="text-ink/45 font-normal">· {r.clinic}</span>}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
