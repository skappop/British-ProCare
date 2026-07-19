import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LabelSheet from './LabelSheet'

export const dynamic = 'force-dynamic'

export default async function LabelsPage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('inventory')
    .select('id, sku, name, category')
    .eq('is_active', true)
    .order('category')
    .order('name')

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Inventory</p>
          <h1 className="font-display text-2xl text-ink-strong mt-1">QR Labels</h1>
        </div>
        <Link href="/inventory" className="text-sm text-teal-deep hover:underline">
          ← Back to inventory
        </Link>
      </div>

      {(!items || items.length === 0) ? (
        <div className="bg-white rounded-card shadow-soft px-4 py-12 text-center text-ink/40 text-sm no-print">
          No inventory items yet. Add items first, then print their labels here.
        </div>
      ) : (
        <LabelSheet items={items} />
      )}
    </div>
  )
}
