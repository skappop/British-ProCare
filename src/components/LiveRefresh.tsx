'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Keeps a server-rendered page current without anyone pressing refresh.
 *
 * Every server action already calls revalidatePath, so the acting user's own
 * screen updates. What was missing is everyone else's: reception sending a
 * patient never reached the doctor. This listens for database changes and
 * re-runs the server render for whoever is watching.
 *
 * The refresh button is the fallback for when the live link has dropped — a
 * sleeping laptop or a flaky connection — so nobody has to reload the page.
 */
export default function LiveRefresh({
  tables,
  label = 'Live',
  variant = 'light',
  filters = {},
}: {
  tables: string[]
  label?: string
  variant?: 'light' | 'dark'
  /** Optional Realtime row filter per table, e.g. { appointments: 'patient_id=eq.<id>' }. */
  filters?: Record<string, string>
}) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()

  // Collapse bursts: a status change can touch several tables at once, and each
  // refresh is a server round trip.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = tables.map((t) => (filters[t] ? `${t}|${filters[t]}` : t)).join(',')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`live:${key}`)

    for (const entry of key.split(',')) {
      const [table, filter] = entry.split('|')
      const spec = filter
        ? { event: '*' as const, schema: 'public', table, filter }
        : { event: '*' as const, schema: 'public', table }
      channel.on('postgres_changes', spec, () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => router.refresh(), 250)
      })
    }

    // Back after the link dropped (sleep, Wi-Fi): catch up on what was missed.
    let lost = false
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED'
      setConnected(ok)
      if (ok && lost) router.refresh()
      if (!ok) lost = true
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [key, router])

  // Back in front after another program had the screen (the camera software,
  // another tab): the browser may have held back updates meanwhile, so catch
  // up at once rather than show a stale page.
  useEffect(() => {
    let last = 0
    const catchUp = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 3000) return
      last = now
      router.refresh()
    }
    document.addEventListener('visibilitychange', catchUp)
    window.addEventListener('focus', catchUp)
    return () => {
      document.removeEventListener('visibilitychange', catchUp)
      window.removeEventListener('focus', catchUp)
    }
  }, [router])

  const dark = variant === 'dark'

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${dark ? 'text-white/50' : 'text-ink/45'}`}
        title={
          connected
            ? 'This page updates on its own when anyone changes something'
            : 'Not receiving live updates — use the refresh button'
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? 'bg-success animate-pulse' : dark ? 'bg-white/25' : 'bg-ink/25'
          }`}
        />
        {connected ? label : 'Offline'}
      </span>

      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={isRefreshing}
        title="Refresh now"
        aria-label="Refresh now"
        className={`inline-flex h-6 w-6 items-center justify-center rounded-control transition-colors disabled:opacity-60 ${
          dark
            ? 'text-white/50 hover:text-white hover:bg-white/10'
            : 'text-ink/40 hover:text-teal-deep hover:bg-ink/5'
        }`}
      >
        <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
      </button>
    </span>
  )
}
