import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { addBomItem, removeBomItem, updateProcedure, deactivateProcedure } from '../actions'
import DeleteButton from '@/components/DeleteButton'

export default async function ProcedureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: procedure } = await supabase.from('procedures').select('*').eq('id', id).single()
  if (!procedure) notFound()

  const { data: bomItems } = await supabase
    .from('procedure_bom')
    .select('*, inventory(name, sku, unit, stock)')
    .eq('procedure_id', id)

  const { data: inventoryOptions } = await supabase
    .from('inventory')
    .select('id, name, sku, unit')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      {/* Editable header */}
      <form action={updateProcedure.bind(null, id)} className="bg-white rounded-card shadow-soft p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-ink/60">Name</label>
            <input
              name="name"
              defaultValue={procedure.name}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink/60">Code</label>
            <input
              name="code"
              defaultValue={procedure.code}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink/60">Category</label>
            <select
              name="category"
              defaultValue={procedure.category}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {['general', 'ortho', 'endo', 'surgical', 'restorative', 'prosthetic'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-ink/60">Base Fee (EGP)</label>
            <input
              name="base_fee"
              type="number"
              step="0.01"
              defaultValue={procedure.base_fee || ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button
            type="submit"
            className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
          >
            Save
          </button>
        </div>
      </form>

      <div className="flex justify-end mb-6">
        <DeleteButton
          action={deactivateProcedure.bind(null, id)}
          label="Deactivate Procedure"
          warning="Hide from visit logging — confirm?"
        />
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      <h2 className="font-display text-lg text-ink-strong mb-3">Bill of Materials</h2>

      <div className="bg-white rounded-card shadow-soft mb-6 divide-y divide-ink/5">
        {bomItems?.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-ink-strong font-medium">{b.inventory.name}</span>
              <span className="text-ink/40 font-mono text-xs ml-2">{b.inventory.sku}</span>
              {b.is_optional && (
                <span className="ml-2 text-xs bg-gold/15 text-gold-deep px-2 py-0.5 rounded-full">optional</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-ink/70">
                {b.quantity} {b.inventory.unit}
              </span>
              <form action={removeBomItem}>
                <input type="hidden" name="bom_id" value={b.id} />
                <input type="hidden" name="procedure_id" value={id} />
                <button type="submit" className="text-danger text-xs hover:underline">
                  Remove
                </button>
              </form>
            </div>
          </div>
        ))}
        {(!bomItems || bomItems.length === 0) && (
          <div className="px-4 py-8 text-center text-ink/40 text-sm">
            No BOM items yet — this procedure won't deduct any stock.
          </div>
        )}
      </div>

      <h3 className="font-display text-base text-ink-strong mb-3">Add Item</h3>
      <form action={addBomItem} className="bg-white rounded-card shadow-soft p-4 flex items-end gap-3">
        <input type="hidden" name="procedure_id" value={id} />

        <div className="flex-1 space-y-1">
          <label className="text-xs text-ink/60">Inventory Item</label>
          <select
            name="inventory_id"
            required
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="">Select item...</option>
            {inventoryOptions?.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name} ({opt.sku})</option>
            ))}
          </select>
        </div>

        <div className="w-28 space-y-1">
          <label className="text-xs text-ink/60">Quantity</label>
          <input
            name="quantity"
            type="number"
            step="0.001"
            required
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink/60 pb-2.5">
          <input type="checkbox" name="is_optional" className="rounded" />
          Optional
        </label>

        <button
          type="submit"
          className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  )
}