'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Smartphone, X, HeartPulse } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReceptionPatient } from '../types'
import {
  acceptRegistration,
  dismissRegistration,
  getPendingRegistrations,
  type PendingRegistration,
} from '../receptionActions'
import { SectionLabel } from '../ui'

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Patients who filled in the online form before arriving. One tap turns a
 * submission into a patient (or updates the matching record) and carries on
 * into the walk-in flow, with their medical history already filled in.
 */
export default function PendingRegistrations({
  onPick,
}: {
  onPick: (patient: ReceptionPatient) => void
}) {
  const [items, setItems] = useState<PendingRegistration[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const load = useCallback(() => {
    getPendingRegistrations().then(setItems)
  }, [])

  useEffect(() => {
    load()

    // A patient submitting on their phone should appear here without a reload.
    const supabase = createClient()
    const channel = supabase
      .channel('pending-registrations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_registrations' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  function accept(reg: PendingRegistration, target: 'new' | string) {
    setError(null)
    setBusy(reg.id)
    startTransition(async () => {
      const res = await acceptRegistration(reg.id, target)
      setBusy(null)
      if (res.ok && res.patient) onPick(res.patient)
      else {
        setError(res.message || 'Could not check this patient in')
        load()
      }
    })
  }

  function dismiss(reg: PendingRegistration) {
    if (!confirm(`Remove ${reg.full_name}'s online registration? Nothing else is affected.`)) return
    setItems((list) => list.filter((r) => r.id !== reg.id))
    dismissRegistration(reg.id)
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-2.5">
      <SectionLabel>Registered online</SectionLabel>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-2.5 rounded-control">{error}</div>
      )}

      <div className="space-y-2.5">
        {items.map((reg) => (
          <div
            key={reg.id}
            className="rounded-control border border-gold/30 bg-gold/[0.05] px-3.5 py-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
                <Smartphone size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-strong font-medium truncate">{reg.full_name}</p>
                <p className="text-xs text-ink/50 font-mono truncate">
                  {reg.phone} · {ago(reg.created_at)}
                  {reg.preferred_clinic ? ` · ${reg.preferred_clinic}` : ''}
                </p>
                {reg.reason && <p className="text-xs text-ink/55 mt-1 line-clamp-2">{reg.reason}</p>}
                {reg.has_history && (
                  <p className="inline-flex items-center gap-1 text-[11px] text-teal-deep mt-1">
                    <HeartPulse size={11} /> Medical history filled in
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(reg)}
                aria-label="Remove registration"
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded-control text-ink/30 hover:text-danger hover:bg-danger/10"
              >
                <X size={13} />
              </button>
            </div>

            {reg.match ? (
              <div className="mt-3 pl-12">
                <p className="text-xs text-ink/60">
                  Same phone as{' '}
                  <span className="font-medium text-ink-strong">{reg.match.full_name}</span>
                  {reg.match.file_number ? ` · File ${reg.match.file_number}` : ''}. Is this them?
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => accept(reg, reg.match!.id)}
                    className="text-xs px-3 py-1.5 rounded-control bg-teal text-white hover:bg-teal-deep disabled:opacity-50"
                  >
                    Yes, same person
                  </button>
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => accept(reg, 'new')}
                    className="text-xs px-3 py-1.5 rounded-control border border-ink/15 text-ink/70 hover:bg-white disabled:opacity-50"
                  >
                    No, new patient
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 pl-12">
                <button
                  type="button"
                  disabled={busy === reg.id}
                  onClick={() => accept(reg, 'new')}
                  className="text-xs px-3 py-1.5 rounded-control bg-teal text-white hover:bg-teal-deep disabled:opacity-50"
                >
                  {busy === reg.id ? 'Checking in…' : 'Check in'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
