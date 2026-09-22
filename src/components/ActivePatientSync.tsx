'use client'

import { useEffect, useState } from 'react'

type Status = 'linking' | 'linked' | 'failed'

/**
 * Marks this patient as the "active patient" for the Osstem bridge and the
 * desktop agent, so hardware captures land in their gallery automatically.
 *
 * It renders a visible badge rather than working silently: when the link fails,
 * staff at the chair need to know before they start capturing, not after.
 */
export default function ActivePatientSync({
  patientId,
  variant = 'light',
}: {
  patientId: string
  variant?: 'light' | 'dark'
}) {
  const [status, setStatus] = useState<Status>('linking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    const sync = () => {
      fetch('/api/bridge/active-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId }),
      })
        .then((response) => {
          if (!cancelled) setStatus(response.ok ? 'linked' : 'failed')
        })
        .catch(() => {
          if (!cancelled) setStatus('failed')
        })
    }

    sync()

    // The server expires the active patient after 10 minutes of inactivity.
    const interval = setInterval(sync, 5 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [patientId, attempt])

  const muted = variant === 'dark' ? 'text-white/50' : 'text-ink/50'
  const good = variant === 'dark' ? 'text-gold-light' : 'text-teal-deep'

  if (status === 'linking') {
    return <span className={`text-xs ${muted}`}>Linking imaging hardware…</span>
  }

  if (status === 'failed') {
    return (
      <span className="text-xs text-danger">
        Imaging hardware not linked — captures won&apos;t attach to this patient.{' '}
        <button
          type="button"
          onClick={() => {
            setStatus('linking')
            setAttempt((n) => n + 1)
          }}
          className="underline hover:no-underline"
        >
          Retry
        </button>
      </span>
    )
  }

  return <span className={`text-xs ${good}`}>📷 Imaging hardware linked to this patient</span>
}
