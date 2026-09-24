import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCabinet, pickDailyCount } from '../data'
import CountForm from './CountForm'

export const dynamic = 'force-dynamic'

/**
 * Today's count: a handful of cabinet items, different ones each day. With
 * ?all=1, every item grouped by shelf, for a full stock-take.
 */
export default async function CountPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams
  const { ready, items } = await getCabinet()
  if (!ready) {
    return (
      <p className="mx-auto max-w-xl rounded-card bg-white p-6 text-sm text-ink/60 shadow-soft">
        Stock check is not set up yet — run <span className="font-mono">migrations/18_stock_routines.sql</span> in Supabase.
      </p>
    )
  }
  const full = all === '1'
  const list = full
    ? [...items].sort((a, b) => (a.shelf ?? '~').localeCompare(b.shelf ?? '~') || a.name.localeCompare(b.name))
    : pickDailyCount(items)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/stock" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble" aria-label="Back to Stock check">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display text-xl text-ink-strong">{full ? 'Full stock-take' : 'Today’s count'}</h1>
          <p className="text-xs text-ink/50">Count what is actually in the cabinet and type the number.</p>
        </div>
      </div>
      {/* No key: saving changes the list, and the form must stay to show the result and Undo. */}
      <CountForm items={list.map((i) => ({ id: i.id, name: i.name, unit: i.unit, shelf: i.shelf, expected: i.stock }))} full={full} />
      {!full && (
        <p className="text-center text-xs text-ink/45">
          Doing a full stock-take?{' '}
          <Link href="/stock/count?all=1" className="text-teal-deep underline">
            Count everything
          </Link>
        </p>
      )}
    </div>
  )
}
