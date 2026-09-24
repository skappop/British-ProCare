import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, PackageSearch, Settings2, ShoppingCart } from 'lucide-react'
import LiveRefresh from '@/components/LiveRefresh'
import { getCurrentUserRole } from '@/lib/auth/role'
import { canOpen } from '@/lib/auth/access'
import { getCabinet, getContainers, needsOrdering, pickDailyCount } from './data'

export const dynamic = 'force-dynamic'

function ago(iso: string | null) {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * The closing routine, as a checklist: each container, today's few items to
 * count, and what needs ordering. Nothing here is needed during the day.
 */
export default async function StockPage() {
  const [{ ready, containers }, cabinet, role] = await Promise.all([getContainers(), getCabinet(), getCurrentUserRole()])
  const canSetUp = canOpen(role, '/stock/setup')

  if (!ready || !cabinet.ready) {
    return (
      <div className="mx-auto max-w-xl rounded-card bg-white p-6 text-sm text-ink/60 shadow-soft">
        Stock check is not set up yet. Run <span className="font-mono">migrations/18_stock_routines.sql</span> in
        Supabase, then reload this page.
      </div>
    )
  }

  const done = containers.filter((c) => c.checked_today).length
  const missing = containers.flatMap((c) => c.items.filter((i) => i.missing > 0).map((i) => ({ ...i, container: c.name })))
  const toCount = pickDailyCount(cabinet.items)
  const toOrder = needsOrdering(cabinet.items)
  const notOrdered = toOrder.filter((i) => !i.ordered_at)
  const allDone = containers.length > 0 && done === containers.length && toCount.length === 0

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold-deep font-mono">Closing routine</p>
          <h1 className="font-display text-2xl text-ink-strong">Stock check</h1>
        </div>
        <div className="flex items-center gap-2">
          <LiveRefresh tables={['stock_events']} />
          {canSetUp && (
            <Link href="/stock/setup" className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs text-ink/55 hover:bg-marble hover:text-ink-strong">
              <Settings2 size={14} /> Set up
            </Link>
          )}
        </div>
      </div>

      {allDone ? (
        <p className="flex items-center gap-2 rounded-card bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 size={18} /> All done for today. Thank you.
        </p>
      ) : (
        <p className="text-sm text-ink/55">
          At closing: check each container, then count today&apos;s {toCount.length || 'few'} items. About a minute each.
        </p>
      )}

      {/* 1. Containers */}
      <section>
        <h2 className="mb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-ink/45">
          <span>1 · Containers</span>
          <span>
            {done} of {containers.length} checked today
          </span>
        </h2>
        {containers.length === 0 ? (
          <p className="rounded-card bg-white px-4 py-6 text-center text-sm text-ink/45 shadow-soft">
            No containers yet.{' '}
            {canSetUp ? (
              <Link href="/stock/setup" className="text-teal-deep underline">
                Set them up
              </Link>
            ) : (
              'Ask the owner or a doctor to set them up.'
            )}
          </p>
        ) : (
          <div className="divide-y divide-ink/5 overflow-hidden rounded-card bg-white shadow-soft">
            {containers.map((c) => {
              const miss = c.items.filter((i) => i.missing > 0).length
              return (
                <Link key={c.id} href={`/stock/check/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-marble">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      c.checked_today ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold-deep'
                    }`}
                  >
                    {c.checked_today ? <CheckCircle2 size={18} /> : <PackageSearch size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink-strong">{c.name}</span>
                    <span className="block text-xs text-ink/50">
                      {c.checked_today ? 'Checked today' : `Last checked ${ago(c.last_checked_at)}`} · {c.items.length} items
                      {miss > 0 && <span className="text-danger"> · {miss} missing</span>}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-ink/30" />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 2. Daily count */}
      <section>
        <h2 className="mb-2 text-[11px] font-mono uppercase tracking-wider text-ink/45">2 · Count</h2>
        <Link href="/stock/count" className="flex items-center gap-3 rounded-card bg-white px-4 py-3.5 shadow-soft active:bg-marble">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              toCount.length ? 'bg-gold/15 text-gold-deep' : 'bg-success/15 text-success'
            }`}
          >
            {toCount.length ? <ClipboardList size={17} /> : <CheckCircle2 size={18} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium text-ink-strong">
              {toCount.length ? `Count ${toCount.length} item${toCount.length === 1 ? '' : 's'} in the cabinet` : 'Counted today'}
            </span>
            <span className="block text-xs text-ink/50">A few different items each day keeps the whole cabinet right.</span>
          </span>
          <ChevronRight size={18} className="text-ink/30" />
        </Link>
      </section>

      {/* 3. To order */}
      <section>
        <h2 className="mb-2 text-[11px] font-mono uppercase tracking-wider text-ink/45">3 · To order</h2>
        <Link href="/stock/order" className="flex items-center gap-3 rounded-card bg-white px-4 py-3.5 shadow-soft active:bg-marble">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              notOrdered.length ? 'bg-danger/10 text-danger' : 'bg-success/15 text-success'
            }`}
          >
            <ShoppingCart size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium text-ink-strong">
              {notOrdered.length ? `${notOrdered.length} item${notOrdered.length === 1 ? '' : 's'} to order` : 'Nothing to order'}
            </span>
            <span className="block text-xs text-ink/50">
              {toOrder.length - notOrdered.length > 0
                ? `${toOrder.length - notOrdered.length} already ordered, waiting for delivery`
                : 'Anything at or below its minimum shows up here'}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink/30" />
        </Link>
      </section>

      {missing.length > 0 && (
        <section className="rounded-card bg-danger/5 px-4 py-3">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-danger">
            <AlertTriangle size={15} /> Missing tools
          </h2>
          <ul className="space-y-0.5 text-sm text-ink/70">
            {missing.map((m) => (
              <li key={m.id}>
                {m.name} ×{m.missing} — {m.container}, since {ago(m.missing_since)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink/45">Open the container to mark one found or lost.</p>
        </section>
      )}
    </div>
  )
}
