'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Armchair, Clock } from 'lucide-react'
import { useStoredValue } from '@/lib/useStoredValue'
import type { WaitingRow } from './waiting'

/**
 * Who is waiting and who is in the chair, at the top of the patient list —
 * the doctor's way into today's patients without the appointments board.
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
        {shown.map((r) => (
          <Link
            key={r.appointment_id}
            href={`/patients/${r.patient_id}`}
            className={`rounded-card border px-4 py-3 transition-colors hover:border-teal ${
              r.status === 'in_chair' ? 'border-teal/30 bg-teal/[0.04]' : 'border-gold/30 bg-gold/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink-strong truncate">{r.name}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs ${
                  r.status === 'in_chair' ? 'text-teal-deep' : mins(r.since) >= 20 ? 'text-danger' : 'text-gold-deep'
                }`}
              >
                {r.status === 'in_chair' ? <Armchair size={12} /> : <Clock size={12} />}
                {r.status === 'in_chair' ? 'In chair' : 'Waiting'} · {mins(r.since)}m
              </span>
            </div>
            {(r.clinic || r.note) && (
              <p className="text-xs text-ink/50 mt-1 truncate">{[r.clinic, r.note].filter(Boolean).join(' · ')}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
