'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Loader2,
  MonitorSmartphone,
  Radiation,
  Square,
  UploadCloud,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStoredValue } from '@/lib/useStoredValue'
import { STATION_ONLINE_MS, type ImagingMode } from '@/lib/imaging'
import {
  cancelImaging,
  endImaging,
  getImagingState,
  startImaging,
  type ImagingState,
  type StationView,
} from '@/app/(dashboard)/patients/[id]/imagingActions'

const MODE_LABEL: Record<ImagingMode, string> = {
  intraoral: 'intraoral camera',
  xray: 'X-ray',
  both: 'camera and X-ray',
}

/**
 * Runs imaging from the patient's page. The Dental Agent sits in the
 * background on each chairside PC; this asks the chosen PC to open the camera
 * or X-ray software, shows images landing as they are taken, and ends the
 * session — nobody needs to touch the agent itself.
 */
export default function ImagingPanel({ patientId }: { patientId: string }) {
  const [state, setState] = useState<ImagingState | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [storedStation, setStoredStation] = useStoredValue('procare.station')

  const load = useCallback(() => {
    getImagingState(patientId).then((next) => {
      setState(next)
      setClockOffset(next.serverNow - Date.now())
    })
  }, [patientId])

  const hasOpen = !!state?.open

  useEffect(() => {
    load()
    // Station online status comes from heartbeats, which are not pushed live
    // (they would re-render this page every few seconds), so poll gently.
    const timer = setInterval(load, hasOpen ? 4000 : 10000)
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => {
      clearInterval(timer)
      clearInterval(tick)
    }
  }, [load, hasOpen])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`imaging:${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imaging_sessions', filter: `patient_id=eq.${patientId}` },
        load
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId, load])

  const online = useCallback(
    (s: StationView) =>
      !!s.last_seen_at && now + clockOffset - new Date(s.last_seen_at).getTime() < STATION_ONLINE_MS,
    [now, clockOffset]
  )

  const stations = useMemo(() => state?.stations ?? [], [state])
  const station =
    stations.find((s) => s.id === storedStation) ?? (stations.length === 1 ? stations[0] : null)

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setError(res.message || 'Something went wrong')
      load()
    })
  }

  if (!state) {
    return (
      <Shell>
        <p className="text-sm text-ink/40">Loading imaging…</p>
      </Shell>
    )
  }

  if (!state.ready) {
    return (
      <Shell>
        <p className="text-sm text-ink/55">
          Imaging from the website is not set up yet — run migration{' '}
          <span className="font-mono text-xs">15_imaging_sessions.sql</span> in Supabase.
        </p>
      </Shell>
    )
  }

  if (stations.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-ink/55">
          No imaging computers yet. Install the background Dental Agent on the chairside PC and it
          will appear here.
        </p>
      </Shell>
    )
  }

  const open = state.open
  const last = state.last

  return (
    <Shell
      right={
        stations.length > 1 && !open ? (
          <select
            value={station?.id ?? ''}
            onChange={(e) => setStoredStation(e.target.value || null)}
            className="text-xs rounded-control border border-ink/15 bg-white px-2 py-1"
            aria-label="Which computer is this patient at"
          >
            <option value="">Choose computer…</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.clinic ? ` · ${s.clinic}` : ''}
                {online(s) ? '' : ' (offline)'}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {error && (
        <div className="bg-danger/10 text-danger text-sm px-3 py-2 rounded-control mb-3">{error}</div>
      )}

      {open ? (
        <OpenSession
          session={open}
          pending={isPending}
          onEnd={() => run(() => endImaging(open.id))}
          onCancel={() => {
            if (confirm('Stop this imaging session? Images already uploaded stay in the gallery.')) {
              run(() => cancelImaging(open.id))
            }
          }}
        />
      ) : !station ? (
        <p className="text-sm text-ink/55">Choose which computer this patient is at to start imaging.</p>
      ) : !online(station) ? (
        <div className="text-sm text-ink/60 space-y-2">
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ink/25" />
            <span>
              <span className="font-medium text-ink-strong">{station.name}</span> is offline.
            </span>
          </p>
          <p className="text-xs text-ink/50">
            If you are at that computer,{' '}
            <a href="procare://start" className="text-teal-deep underline">
              start the agent
            </a>
            . Otherwise check the PC is switched on.
          </p>
        </div>
      ) : station.busy && station.busy.patient_id !== patientId ? (
        <p className="text-sm text-ink/60">
          <span className="font-medium text-ink-strong">{station.name}</span> is imaging{' '}
          <Link href={`/patients/${station.busy.patient_id}`} className="text-teal-deep underline">
            {station.busy.patient_name || 'another patient'}
          </Link>
          . End that session first.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink/50 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            {station.name} is ready
          </p>
          {station.capabilities.intraoral === false && station.capabilities.xray === false && (
            // Connected, but nothing to start: say so rather than showing no buttons.
            <div className="rounded-control bg-gold/10 px-3 py-2.5 text-sm text-ink/70 space-y-1">
              <p className="font-medium text-ink-strong">No camera or X-ray program is set up on this computer yet.</p>
              <p>
                On <span className="font-medium">{station.name}</span>: right-click the British ProCare icon by
                the clock → <span className="font-medium">Settings</span>. Fill in the <span className="font-medium">Program</span>{' '}
                and <span className="font-medium">Export folder</span> for the intraoral camera (One2) and/or the X-ray
                (EzDent-i), then Save. The buttons appear here within a few seconds.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {station.capabilities.intraoral !== false && (
              <StartButton
                icon={<Camera size={15} />}
                label="Intraoral camera"
                disabled={isPending}
                onClick={() => run(() => startImaging(patientId, station.id, 'intraoral'))}
              />
            )}
            {station.capabilities.xray !== false && (
              <StartButton
                icon={<Radiation size={15} />}
                label="X-ray"
                disabled={isPending}
                onClick={() => run(() => startImaging(patientId, station.id, 'xray'))}
              />
            )}
            {station.capabilities.intraoral !== false && station.capabilities.xray !== false && (
              <StartButton
                icon={<MonitorSmartphone size={15} />}
                label="Both"
                disabled={isPending}
                onClick={() => run(() => startImaging(patientId, station.id, 'both'))}
              />
            )}
          </div>
          {last && <LastSession session={last} patientId={patientId} now={now} />}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-ink-strong">Imaging</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function StartButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-control bg-teal hover:bg-teal-deep text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}

function OpenSession({
  session,
  pending,
  onEnd,
  onCancel,
}: {
  session: NonNullable<ImagingState['open']>
  pending: boolean
  onEnd: () => void
  onCancel: () => void
}) {
  const where = session.station_name ?? 'the imaging PC'

  if (session.status === 'requested') {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/70 flex items-center gap-2">
          <Loader2 size={15} className="animate-spin text-teal-deep" />
          Opening the {MODE_LABEL[session.mode]} on {where}…
        </p>
        <button type="button" onClick={onCancel} disabled={pending} className="text-xs text-ink/50 hover:text-danger">
          Cancel
        </button>
      </div>
    )
  }

  const uploading = session.status === 'uploading' || session.end_requested

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-ink-strong">
        {uploading ? (
          <UploadCloud size={16} className="text-teal-deep animate-pulse" />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" />
        )}
        <span className="font-medium">
          {uploading ? 'Finishing — uploading the last images' : `${MODE_LABEL[session.mode]} open`}
        </span>
        <span className="text-ink/45">on {where}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Captured" value={session.images_captured} />
        <Stat label="In gallery" value={session.images_uploaded} tone="success" />
        <Stat label="Failed" value={session.images_failed} tone={session.images_failed ? 'danger' : undefined} />
      </div>

      {session.message && <p className="text-xs text-ink/50">{session.message}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEnd}
          disabled={pending || uploading}
          className="inline-flex items-center gap-2 rounded-control bg-ink-strong hover:bg-ink text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Square size={13} fill="currentColor" />
          {uploading ? 'Finishing…' : 'End session'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs text-ink/45 hover:text-danger"
        >
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-strong'
  return (
    <div className="rounded-control bg-marble/60 py-2">
      <p className={`text-lg font-display ${color}`}>{value}</p>
      <p className="text-[11px] text-ink/45">{label}</p>
    </div>
  )
}

function LastSession({
  session,
  patientId,
  now,
}: {
  session: NonNullable<ImagingState['last']>
  patientId: string
  now: number
}) {
  // Only worth mentioning if it was recent; old sessions are just history.
  if (!session.ended_at || now - new Date(session.ended_at).getTime() > 6 * 60 * 60 * 1000) return null

  if (session.status === 'completed') {
    return (
      <p className="text-xs text-success flex items-center gap-1.5">
        <CheckCircle2 size={13} />
        Last session: {session.images_uploaded} image{session.images_uploaded === 1 ? '' : 's'} added.{' '}
        <Link href={`/patients/${patientId}/gallery`} className="underline">
          Open gallery
        </Link>
      </p>
    )
  }

  if (session.status === 'failed') {
    return (
      <p className="text-xs text-danger flex items-start gap-1.5">
        <CircleAlert size={13} className="mt-0.5 shrink-0" />
        <span>
          Last session did not finish: {session.message || 'an upload failed'}. The images are still
          on {session.station_name ?? 'the PC'} — start a new session to pick them up.
        </span>
      </p>
    )
  }

  return null
}
