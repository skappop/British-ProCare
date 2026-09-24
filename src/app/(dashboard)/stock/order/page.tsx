import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCabinet, needsOrdering, suggestedOrder } from '../data'
import OrderList, { type OrderGroup } from './OrderList'

export const dynamic = 'force-dynamic'

/** Everything at or below its minimum, grouped by supplier. */
export default async function OrderPage() {
  const { ready, items, suppliers } = await getCabinet()
  if (!ready) {
    return (
      <p className="mx-auto max-w-xl rounded-card bg-white p-6 text-sm text-ink/60 shadow-soft">
        Stock check is not set up yet — run <span className="font-mono">migrations/18_stock_routines.sql</span> in Supabase.
      </p>
    )
  }
  const low = needsOrdering(items)
  const groups = new Map<string, OrderGroup>()
  for (const i of low) {
    const supplier = suppliers.find((s) => s.id === i.supplier_id)
    const key = supplier?.id ?? (i.supplier_text?.trim() ? `text:${i.supplier_text.trim().toLowerCase()}` : 'none')
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: supplier?.name ?? (i.supplier_text?.trim() || 'No supplier set'),
        whatsapp: supplier?.whatsapp || supplier?.phone || null,
        lines: [],
      })
    }
    groups.get(key)!.lines.push({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: i.stock,
      minimum: i.reorder_level,
      suggested: suggestedOrder(i),
      ordered_at: i.ordered_at,
      ordered_quantity: i.ordered_quantity,
    })
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/stock" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble" aria-label="Back to Stock check">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display text-xl text-ink-strong">To order</h1>
          <p className="text-xs text-ink/50">Anything at or below its minimum. Set minimums in Stock check → Set up.</p>
        </div>
      </div>
      <OrderList groups={[...groups.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)))} />
    </div>
  )
}
