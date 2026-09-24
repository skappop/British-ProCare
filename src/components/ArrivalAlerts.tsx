'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ENABLED_KEY = 'procare.alerts'
const CLINIC_KEY = 'procare.clinic' // this computer's clinic, set by ClinicSwitcher
const FRESH_MS = 2 * 60 * 1000
const TOAST_MS = 20 * 1000

type Toast = {
  id: string
  patientId: string
  name: string
  clinic: string | null
  note: string | null
}

type AppointmentRow = {
  id: string
  patient_id: string
  clinic_id: string | null
  status: string
  arrived_at: string | null
  notes: string | null
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const CHANGED = 'procare-alerts-changed'

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the toggle just won't persist.
  }
  window.dispatchEvent(new Event(CHANGED))
}

// The toggle lives in localStorage, which the server cannot see. Reading it
// through an external store keeps the first render identical on both sides
// (off), then switches on the client without a hydration mismatch.
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}
const enabledOnClient = () => readStorage(ENABLED_KEY) === 'on'
const enabledOnServer = () => false

// One sound context per tab, shared by the alerts and the on/off switch.
let audioCtx: AudioContext | null = null

async function unlockAudio() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = audioCtx ?? new Ctx()
    await audioCtx.resume()
  } catch {
    audioCtx = null
  }
}

function chime() {
  const ctx = audioCtx
  if (!ctx) return
  try {
    // Two soft rising tones — noticeable across a surgery, not alarming.
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + i * 0.18
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })
  } catch {
    // Audio is a nicety; never let it break the alert.
  }
}

/**
 * The on/off switch for this device, in the side menu — not floating over the
 * page, where it covered the charting panel on phones.
 */
export function AlertsToggle() {
  const enabled = useSyncExternalStore(subscribe, enabledOnClient, enabledOnServer)

  async function toggle() {
    if (enabled) {
      writeStorage(ENABLED_KEY, null)
      return
    }
    // Sound and system notifications both need a click to be allowed.
    await unlockAudio()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // Permission prompts are best effort; the on-screen card still works.
      }
    }
    writeStorage(ENABLED_KEY, 'on')
    chime()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? 'Arrival alerts are on for this device. Tap to turn off.' : 'Sound and a notification when a patient arrives'}
      className={`flex w-full items-center gap-2 rounded-control px-3 py-2 text-xs transition-colors ${
        enabled ? 'bg-teal/20 text-gold-light' : 'text-white/45 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      {enabled ? 'Arrival alerts on' : 'Turn on arrival alerts'}
    </button>
  )
}

/**
 * Tells the doctor a patient has arrived: an on-screen card, a chime, and a
 * system notification that shows even when the browser is behind the imaging
 * software.
 *
 * It is opt-in per device, because the same app runs at the reception desk
 * where these alerts would only be noise. It rings only for this computer's
 * clinic (set on the Patients page), so Clinic 1 is not pinged for Clinic 2.
 */
export default function ArrivalAlerts() {
  const router = useRouter()
  const enabled = useSyncExternalStore(subscribe, enabledOnClient, enabledOnServer)
  const [toasts, setToasts] = useState<Toast[]>([])

  const seen = useRef(new Set<string>())
  const clinicNames = useRef(new Map<string, string>())
  // Browsers only allow sound after the user has interacted with the page, so
  // after a reload the chime would stay silent until the next click. Unlock it
  // on the first click or key press anywhere.
  useEffect(() => {
    if (!enabled) return
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    let cancelled = false

    supabase
      .from('clinics')
      .select('id, name')
      .then(({ data }) => {
        for (const c of data ?? []) clinicNames.current.set(c.id, c.name)
      })

    async function handle(row: AppointmentRow) {
      if (row.status !== 'arrived' || !row.arrived_at) return
      if (seen.current.has(row.id)) return

      // Only fresh arrivals: an edit to someone who has been waiting an hour
      // must not re-announce them.
      if (Date.now() - new Date(row.arrived_at).getTime() > FRESH_MS) return

      const followed = readStorage(CLINIC_KEY)
      if (followed && row.clinic_id && row.clinic_id !== followed) return

      seen.current.add(row.id)

      const { data: patient } = await supabase
        .from('patients')
        .select('full_name')
        .eq('id', row.patient_id)
        .maybeSingle()

      if (cancelled) return

      const toast: Toast = {
        id: row.id,
        patientId: row.patient_id,
        name: patient?.full_name || 'A patient',
        clinic: row.clinic_id ? clinicNames.current.get(row.clinic_id) ?? null : null,
        note: row.notes,
      }

      setToasts((list) => [toast, ...list].slice(0, 4))
      setTimeout(() => dismiss(toast.id), TOAST_MS)
      chime()

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(`${toast.name} has arrived`, {
            body: [toast.clinic, toast.note].filter(Boolean).join(' · ') || 'Waiting to be seen',
            tag: `arrival-${toast.id}`,
          })
          n.onclick = () => {
            window.focus()
            router.push(`/patients/${toast.patientId}`)
            n.close()
          }
        } catch {
          // Some browsers only allow notifications from a service worker.
        }
      }
    }

    const channel = supabase
      .channel('arrival-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => handle(payload.new as AppointmentRow)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => handle(payload.new as AppointmentRow)
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [enabled, dismiss, router])

  if (toasts.length === 0) return null

  // On phones at the top, clear of the charting panel along the bottom.
  return (
    <div className="fixed inset-x-4 top-16 z-50 flex flex-col items-center gap-2 print:hidden sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="w-full max-w-sm sm:w-72 rounded-card bg-white shadow-lg border border-gold/30 p-3 flex gap-3 animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
            <Bell size={15} />
          </span>
          <button
            type="button"
            onClick={() => {
              router.push(`/patients/${t.patientId}`)
              dismiss(t.id)
            }}
            className="flex-1 min-w-0 text-left"
          >
            <p className="text-sm font-medium text-ink-strong truncate">{t.name} has arrived</p>
            <p className="text-xs text-ink/55 truncate">
              {[t.clinic, t.note].filter(Boolean).join(' · ') || 'Waiting to be seen'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-control text-ink/35 hover:text-ink/70 hover:bg-ink/5"
          >
            <X size={13} />
          </button>
        </div>
      ))}

    </div>
  )
}
