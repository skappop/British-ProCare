'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react'
import { recordCount, undoStock } from '../actions'

type Item = { id: string; name: string; unit: string | null; shelf: string | null; expected: number }

/** Far enough from the records that it is more likely a miscount than a real change. */
function suspicious(counted: number, expected: number) {
  return Math.abs(counted - expected) > Math.max(2, expected * 0.3)
}

/**
 * Blind count: the expected number is not shown, so the only way to fill it in
 * is to look at the shelf. A number far from the records asks for a recount
 * once before it is accepted.
 */
export default function CountForm({ items, full }: { items: Item[]; full: boolean }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<{ batch: string | null; differences: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filled = items.filter((i) => values[i.id] !== undefined && values[i.id] !== '')

  function save() {
    setError(null)
    // First pass: any number far from the records gets one recount.
    const needCheck = filled.filter((i) => suspicious(Number(values[i.id]), i.expected) && !confirmed[i.id])
    if (needCheck.length) {
      setFlagged(Object.fromEntries(needCheck.map((i) => [i.id, true])))
      setError('Please recount the highlighted item' + (needCheck.length === 1 ? '' : 's') + ', then save again.')
      return
    }
    const lines = filled.map((i) => ({ inventory_id: i.id, counted: Number(values[i.id]) }))
    startTransition(async () => {
      const res = await recordCount(lines)
      if (!res.ok) {
        setError(res.message || 'Could not save. Nothing was changed — try again.')
        return
      }
      const differences = lines.filter((l) => l.counted !== items.find((i) => i.id === l.inventory_id)!.expected).length
      setSaved({ batch: res.batch ?? null, differences })
      router.refresh()
    })
  }

  if (saved) {
    return (
      <div className="space-y-3">
        <div className="rounded-card bg-success/10 px-5 py-5 text-center">
          <CheckCircle2 size={34} className="mx-auto text-success" />
          <p className="mt-2 font-display text-lg text-ink-strong">Count saved</p>
          <p className="text-sm text-ink/60">
            {saved.differences === 0
              ? 'Everything matched the records.'
              : `${saved.differences} item${saved.differences === 1 ? ' was' : 's were'} different — the records are now corrected.`}
          </p>
        </div>
        <Link href="/stock" className="flex w-full items-center justify-center rounded-control bg-teal py-3.5 text-base font-medium text-white">
          Back to Stock check
        </Link>
        {saved.batch && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await undoStock(saved.batch!)
                if (res.ok) {
                  setSaved(null)
                  router.refresh()
                } else setError(res.message || 'Could not undo')
              })
            }
            className="flex w-full items-center justify-center gap-2 py-2 text-sm text-ink/55"
          >
            <Undo2 size={15} /> Made a mistake? Undo this count
          </button>
        )}
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    )
  }

  // (After the saved screen: saving refreshes the list, which is then empty.)
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-card bg-success/10 px-4 py-4 text-sm font-medium text-success">
        <CheckCircle2 size={18} /> Nothing left to count today.
      </p>
    )
  }

  return (
    <div className="space-y-3 pb-24">
      {error && <p className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="divide-y divide-ink/5 overflow-hidden rounded-card bg-white shadow-soft">
        {items.map((i, index) => {
          // With a full stock-take, a heading wherever the shelf changes.
          const header = full && (index === 0 || items[index - 1].shelf !== i.shelf) ? (i.shelf ?? 'No shelf set') : null
          const isFlagged = flagged[i.id] && !confirmed[i.id]
          return (
            <div key={i.id}>
              {header && <p className="bg-marble/70 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider text-ink/50">{header}</p>}
              <div className={`px-4 py-3 ${isFlagged ? 'bg-gold/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-strong">{i.name}</p>
                    <p className="text-xs text-ink/45">
                      {!full && i.shelf ? `${i.shelf} · ` : ''}
                      Count in {i.unit || 'pieces'}
                    </p>
                  </div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`How many ${i.name}`}
                    value={values[i.id] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, '')
                      setValues((s) => ({ ...s, [i.id]: v }))
                      setConfirmed((c) => ({ ...c, [i.id]: false }))
                    }}
                    placeholder="?"
                    className="w-20 rounded-control border border-ink/15 px-2 py-2.5 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal"
                  />
                </div>
                {isFlagged && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gold-deep">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="flex-1">That is quite different from the records. Please count again.</span>
                    <button
                      type="button"
                      onClick={() => setConfirmed((c) => ({ ...c, [i.id]: true }))}
                      className="shrink-0 rounded-control bg-white px-2.5 py-1.5 font-medium text-ink-strong shadow-soft"
                    >
                      Recounted — it’s right
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-64">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={save}
            disabled={isPending || filled.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-control bg-teal py-3.5 text-base font-medium text-white disabled:bg-ink/20"
          >
            {isPending
              ? 'Saving…'
              : filled.length === 0
                ? 'Type the counts above'
                : filled.length < items.length
                  ? `Save ${filled.length} of ${items.length} counted`
                  : 'Save count'}
          </button>
        </div>
      </div>
    </div>
  )
}
