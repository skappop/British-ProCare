'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Minus, Plus, Undo2 } from 'lucide-react'
import type { ContainerSummary } from '../../data'
import { checkContainer, resolveMissing, undoStock } from '../../actions'

type Entry = { short: number; refilled: boolean }

/**
 * The end-of-day check of one container, built for a tired person at closing:
 * everything starts as full, only what is short needs a tap, the numbers can
 * only be what the box can hold, a summary is shown before anything is saved,
 * and the save can be undone.
 */
export default function ContainerCheck({
  container,
  next,
}: {
  container: ContainerSummary
  next: { id: string; name: string } | null
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState<{ batch: string | null; summary: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const checkedAt = container.last_checked_at
    ? new Date(container.last_checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })
    : null
  const items = container.items
  const missingNow = items.filter((i) => i.missing > 0)
  const short = items.filter((i) => (entries[i.id]?.short ?? 0) > 0)

  function setShort(id: string, value: number, max: number) {
    setEntries((e) => {
      const v = Math.min(Math.max(value, 0), max)
      const prev = e[id]
      return { ...e, [id]: { short: v, refilled: prev?.refilled ?? true } }
    })
  }

  function setRefilled(id: string, refilled: boolean) {
    setEntries((e) => ({ ...e, [id]: { short: e[id]?.short ?? 0, refilled } }))
  }

  function describe(i: (typeof items)[number], e: Entry) {
    if (e.refilled) return `${i.name}: ${e.short} put back from the cabinet`
    return i.reusable ? `${i.name}: ${e.short} missing` : `${i.name}: ${e.short} short — cabinet has none left`
  }

  function save() {
    setError(null)
    const lines = short.map((i) => ({ item: i.id, short: entries[i.id].short, refilled: entries[i.id].refilled }))
    startTransition(async () => {
      const res = await checkContainer(container.id, lines, container.last_checked_at)
      if (!res.ok) {
        setError(res.message || 'Could not save. Nothing was changed — try again.')
        setConfirming(false)
        return
      }
      setSaved({ batch: res.batch ?? null, summary: short.map((i) => describe(i, entries[i.id])) })
      setConfirming(false)
      router.refresh()
    })
  }

  function undo() {
    if (!saved?.batch) return
    startTransition(async () => {
      const res = await undoStock(saved.batch!)
      if (!res.ok) {
        setError(res.message || 'Could not undo')
        return
      }
      setSaved(null)
      router.refresh()
    })
  }

  function resolve(id: string, outcome: 'found' | 'written_off', replace = false) {
    setError(null)
    startTransition(async () => {
      const res = await resolveMissing(id, outcome, replace)
      if (!res.ok) setError(res.message || 'Could not save')
      router.refresh()
    })
  }

  // ---- after saving -------------------------------------------------------
  if (saved) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="rounded-card bg-success/10 px-5 py-5 text-center">
          <CheckCircle2 size={36} className="mx-auto text-success" />
          <p className="mt-2 font-display text-xl text-ink-strong">{container.name} checked</p>
          {saved.summary.length === 0 ? (
            <p className="text-sm text-ink/60">Everything was full.</p>
          ) : (
            <ul className="mt-2 space-y-0.5 text-sm text-ink/70">
              {saved.summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
        {next ? (
          <Link
            href={`/stock/check/${next.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-control bg-teal py-3.5 text-base font-medium text-white"
          >
            Next: {next.name} <ChevronRight size={18} />
          </Link>
        ) : (
          <Link href="/stock" className="flex w-full items-center justify-center gap-2 rounded-control bg-teal py-3.5 text-base font-medium text-white">
            All containers done — back to Stock check
          </Link>
        )}
        {saved.batch && saved.summary.length > 0 && (
          <button
            type="button"
            onClick={undo}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 py-2 text-sm text-ink/55 hover:text-ink-strong disabled:opacity-50"
          >
            <Undo2 size={15} /> {isPending ? 'Undoing…' : 'Made a mistake? Undo this check'}
          </button>
        )}
      </div>
    )
  }

  // ---- the check ----------------------------------------------------------
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Link href="/stock" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble" aria-label="Back to Stock check">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-ink-strong">{container.name}</h1>
          <p className="text-xs text-ink/50">Everything starts as full. Only tap what is short.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
          {error.startsWith('Someone else') && (
            <button type="button" onClick={() => window.location.reload()} className="ml-2 font-medium underline">
              Reload
            </button>
          )}
        </div>
      )}

      {container.checked_today && !error && (
        <p className="rounded-control bg-success/10 px-4 py-2 text-sm text-success">
          Already checked today{checkedAt ? ` at ${checkedAt}` : ''}. Only save again if something has been used since.
        </p>
      )}

      {missingNow.length > 0 && (
        <div className="space-y-2 rounded-card bg-danger/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
            <AlertTriangle size={15} /> Still missing
          </p>
          {missingNow.map((m) => (
            <div key={m.id} className="rounded-control bg-white p-2.5">
              <p className="text-sm text-ink-strong">
                {m.name} ×{m.missing}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" disabled={isPending} onClick={() => resolve(m.id, 'found')} className="rounded-control bg-success/15 px-3 py-2 text-xs font-medium text-success">
                  Found it
                </button>
                <button type="button" disabled={isPending} onClick={() => resolve(m.id, 'written_off', true)} className="rounded-control border border-ink/15 px-3 py-2 text-xs text-ink/70">
                  Lost — replaced from cabinet
                </button>
                <button type="button" disabled={isPending} onClick={() => resolve(m.id, 'written_off', false)} className="rounded-control border border-ink/15 px-3 py-2 text-xs text-ink/70">
                  Lost — no spare
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-card bg-white px-4 py-6 text-center text-sm text-ink/45 shadow-soft">
          This container has no items listed yet.
        </p>
      ) : (
        <div className="divide-y divide-ink/5 overflow-hidden rounded-card bg-white shadow-soft">
          {items.map((i) => {
            const e = entries[i.id] ?? { short: 0, refilled: true }
            const max = Math.max(i.full - i.missing, 0)
            return (
              <div key={i.id} className={`px-4 py-3 ${e.short > 0 ? 'bg-gold/[0.07]' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-strong">{i.name}</p>
                    <p className="text-xs text-ink/45">
                      Full: {i.full}
                      {i.unit ? ` ${i.unit}` : ''}
                      {i.reusable ? ' · reusable tool' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`One less short: ${i.name}`}
                      onClick={() => setShort(i.id, e.short - 1, max)}
                      disabled={e.short === 0}
                      className="flex h-10 w-10 items-center justify-center rounded-control border border-ink/15 text-ink/60 disabled:opacity-30"
                    >
                      <Minus size={16} />
                    </button>
                    <span className={`w-16 text-center text-sm ${e.short > 0 ? 'font-semibold text-gold-deep' : 'text-success'}`}>
                      {e.short > 0 ? `${e.short} short` : 'Full'}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more short: ${i.name}`}
                      onClick={() => setShort(i.id, e.short + 1, max)}
                      disabled={e.short >= max}
                      className="flex h-10 w-10 items-center justify-center rounded-control border border-ink/15 text-ink/60 disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {e.short > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <Choice active={e.refilled} onClick={() => setRefilled(i.id, true)}>
                      {i.reusable ? 'Replaced from cabinet' : 'Refilled from cabinet'}
                    </Choice>
                    <Choice active={!e.refilled} warn onClick={() => setRefilled(i.id, false)}>
                      {i.reusable ? 'It’s missing' : 'Cabinet is empty'}
                    </Choice>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm before anything is changed. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => setConfirming(false)}>
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-card" onClick={(ev) => ev.stopPropagation()}>
            <p className="font-display text-lg text-ink-strong">Save {container.name}?</p>
            <ul className="mt-2 space-y-1 text-sm text-ink/70">
              {short.map((i) => (
                <li key={i.id}>• {describe(i, entries[i.id])}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink/45">Everything else: full.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-control border border-ink/15 py-3 text-sm text-ink/70">
                Go back
              </button>
              <button type="button" onClick={save} disabled={isPending} className="rounded-control bg-teal py-3 text-sm font-medium text-white disabled:opacity-60">
                {isPending ? 'Saving…' : 'Yes, save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The one button, always in reach. */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-64">
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              disabled={isPending}
              onClick={() => (short.length ? setConfirming(true) : save())}
              className={`flex w-full items-center justify-center gap-2 rounded-control py-3.5 text-base font-medium text-white disabled:opacity-60 ${
                short.length ? 'bg-teal' : 'bg-success'
              }`}
            >
              <CheckCircle2 size={18} />
              {isPending
                ? 'Saving…'
                : short.length
                  ? `Save — ${short.length} item${short.length === 1 ? '' : 's'} short`
                  : 'Everything is full — done'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Choice({
  children,
  active,
  warn,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  warn?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control border px-2 py-2 text-xs transition-colors ${
        active
          ? warn
            ? 'border-danger bg-danger/10 font-medium text-danger'
            : 'border-teal bg-teal/10 font-medium text-teal-deep'
          : 'border-ink/15 text-ink/60'
      }`}
    >
      {children}
    </button>
  )
}
