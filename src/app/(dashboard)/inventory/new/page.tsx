import { createInventoryItem } from '../actions'

const CATEGORIES = [
  'bracket', 'wire', 'elastic', 'power_chain', 'spring', 'ligature',
  'band', 'composite', 'impression', 'endo', 'bond', 'anesthetic',
  'disposable', 'other',
]

const UNITS = ['pc', 'g', 'ml', 'pack', 'cartridge']

export default async function NewInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink-strong mb-6">New Inventory Item</h1>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      <form action={createInventoryItem} className="bg-white rounded-card shadow-soft p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">SKU *</label>
            <input
              name="sku"
              required
              placeholder="BRK-ROTH22-UR3"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Name *</label>
            <input
              name="name"
              required
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
            <label className="text-sm text-ink/70">Initial Stock</label>
            <input
              name="stock"
              type="number"
              step="0.001"
              defaultValue="0"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Reorder Level</label>
            <input
              name="reorder_level"
              type="number"
              step="0.001"
              defaultValue="0"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Cost per Unit (EGP)</label>
            <input
              name="cost_per_unit"
              type="number"
              step="0.01"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Supplier</label>
            <input
              name="supplier"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">
            Attributes <span className="text-ink/40">(optional JSON — for brackets, wires, elastics)</span>
          </label>
          <textarea
            name="attributes"
            rows={3}
            placeholder='{"material":"NiTi","dimension":"016","arch":"upper"}'
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-2.5 text-sm font-medium transition-colors"
        >
          Create Item
        </button>
      </form>
    </div>
  )
}