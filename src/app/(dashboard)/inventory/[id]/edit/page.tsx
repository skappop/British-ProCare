import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateInventoryItem, deactivateItem, duplicateItem } from '../../actions'
import DeleteButton from '@/components/DeleteButton'
import QRLabel from '../../QRLabel'

const CATEGORIES = [
  'bracket', 'wire', 'elastic', 'power_chain', 'spring', 'ligature',
  'band', 'composite', 'impression', 'endo', 'bond', 'anesthetic',
  'disposable', 'other',
]

const UNITS = ['pc', 'g', 'ml', 'pack', 'cartridge']

export default async function EditInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: item } = await supabase.from('inventory').select('*').eq('id', id).single()
  if (!item) notFound()

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-ink-strong">Edit Inventory Item</h1>
        <span className="font-mono text-xs text-ink/40">
          Stock: {item.stock} {item.unit}
        </span>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <QRLabel itemId={item.id} sku={item.sku} name={item.name} />
      </div>

      <form
        action={updateInventoryItem.bind(null, id)}
        className="bg-white rounded-card shadow-soft p-6 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">SKU *</label>
            <input
              name="sku"
              required
              defaultValue={item.sku}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Name *</label>
            <input
              name="name"
              required
              defaultValue={item.name}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Category *</label>
            <select
              name="category"
              required
              defaultValue={item.category}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Unit</label>
            <select
              name="unit"
              defaultValue={item.unit}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Reorder Level</label>
            <input
              name="reorder_level"
              type="number"
              step="0.001"
              defaultValue={item.reorder_level ?? 0}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Cost per Unit (EGP)</label>
            <input
              name="cost_per_unit"
              type="number"
              step="0.01"
              defaultValue={item.cost_per_unit ?? ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Supplier</label>
          <input
            name="supplier"
            defaultValue={item.supplier ?? ''}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">
            Attributes <span className="text-ink/40">(optional JSON — for brackets, wires, elastics)</span>
          </label>
          <textarea
            name="attributes"
            rows={3}
            defaultValue={item.attributes ? JSON.stringify(item.attributes, null, 2) : ''}
            placeholder='{"material":"NiTi","dimension":"016","arch":"upper"}'
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-2.5 text-sm font-medium transition-colors"
        >
          Save Changes
        </button>
      </form>

      <div className="flex justify-between mt-4">
        <form action={duplicateItem.bind(null, id)}>
          <button
            type="submit"
            className="text-sm text-ink/60 hover:text-ink-strong hover:underline"
          >
            Duplicate Item
          </button>
        </form>
        <DeleteButton
          action={deactivateItem.bind(null, id)}
          label="Deactivate Item"
          warning="Hide from inventory — confirm?"
        />
      </div>
    </div>
  )
}