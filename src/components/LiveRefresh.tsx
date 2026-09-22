'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Keeps a server-rendered page current without anyone pressing refresh.
 *
 * Every server action already calls revalidatePath, so the acting user's own
 * screen updates. What was missing is everyone else's: reception sending a
 * patient never reached the doctor. This listens for database changes and
 * re-runs the server render for whoever is watching.
 */
export default function LiveRefresh({
  tables,
  label = 'Live',
}: {
  tables: string[]
  label?: string
}) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)

  // Collapse bursts: a status change can touch several tables at once, and each
  // refresh is a server round trip.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`live:${key}`)

    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => router.refresh(), 250)
      })
    }

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [key, router])

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-ink/45"
      title={
        connected
          ? 'This page updates on its own when anyone changes something'
          : 'Not receiving live updates — run migration 13 and check Realtime is enabled'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? 'bg-success animate-pulse' : 'bg-ink/25'
        }`}
      />
      {connected ? label : 'Offline'}
    </span>
  )
}
