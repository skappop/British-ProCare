import { isOwner } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import { restockItem, duplicateItem } from './actions'
import Link from 'next/link'

export default async function InventoryPage() {
  // Supplier prices are the owner's business.
  const showPurchaseOrders = await isOwner()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('inventory')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  const { data: expiringBatches } = await supabase
    .from('expiring_batches')
    .select('*')
    .order('expiry_date', { ascending: true })

  const lowStock = items?.filter((i) => i.stock <= i.reorder_level) || []

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="font-display text-2xl text-ink-strong">Inventory</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/inventory/scan" className="text-xs text-teal-deep hover:underline">
            Scan to Pull
          </Link>
          <Link href="/inventory/labels" className="text-xs text-teal-deep hover:underline">
            QR Labels
          </Link>
          {showPurchaseOrders && (
            <Link href="/inventory/purchase-orders" className="text-xs text-teal-deep hover:underline">
              Purchase Orders
            </Link>
          )}
          <Link
            href="/inventory/quick-add"
            className="border border-teal/40 text-teal-deep hover:bg-teal/10 text-sm px-3 py-2 rounded-control transition-colors"
          >
            Quick Add
          </Link>
          <Link
            href="/inventory/new"
            className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
          >
            + New Item
          </Link>
        </div>
      </div>

      {expiringBatches && expiringBatches.length > 0 && (
        <div className="bg-gold/10 rounded-card p-4 mb-4">
          <p className="text-gold-deep text-sm font-medium mb-2">
            {expiringBatches.length} batch{expiringBatches.length > 1 ? 'es' : ''} expiring within 60 days
          </p>
          <div className="flex flex-wrap gap-2">
            {expiringBatches.map((b: any) => (
              <span key={b.batch_id} className="bg-white text-gold-deep text-xs px-2 py-1 rounded-full font-mono">
                {b.item_name} — {b.quantity} {b.unit} exp. {new Date(b.expiry_date).toLocaleDateString('en-GB')}
              </span>
            ))}
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-danger/10 rounded-card p-4 mb-6">
          <p className="text-danger text-sm font-medium mb-2">
            {lowStock.length} item{lowStock.length > 1 ? 's' : ''} at or below reorder level
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <span key={i.id} className="bg-white text-danger text-xs px-2 py-1 rounded-full font-mono">
                {i.name} ({i.stock} {i.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-card shadow-soft overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-ink/8 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Reorder At</th>
              <th className="px-4 py-3 font-medium">Restock</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => {
              const isLow = item.stock <= item.reorder_level
              return (
                <tr key={item.id} className="border-b border-ink/5 last:border-0 hover:bg-marble/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventory/${item.id}/edit`}
                      className="text-ink-strong font-medium hover:text-teal-deep"
                    >
                      {item.name}
                    </Link>
                    <div className="text-ink/40 text-xs font-mono flex items-center gap-2">
                      {item.sku}
                      <form action={duplicateItem.bind(null, item.id)}>
                        <button type="submit" className="text-teal-deep hover:underline">
                          duplicate
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/70 capitalize">{item.category.replace('_', ' ')}</td>
                  <td className={`px-4 py-3 font-mono ${isLow ? 'text-danger font-semibold' : 'text-ink-strong'}`}>
                    {item.stock} {item.unit}
                  </td>
                  <td className="px-4 py-3 font-mono text-ink/50">{item.reorder_level} {item.unit}</td>
                  <td className="px-4 py-3">
                    <form action={restockItem} className="flex gap-2">
                      <input type="hidden" name="inventory_id" value={item.id} />
                      <input
                        type="number"
                        name="qty"
                        step="0.001"
                        placeholder="Qty"
                        className="w-20 rounded-control border border-ink/15 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                      <button
                        type="submit"
                        className="bg-sage/30 hover:bg-sage/50 text-ink-strong text-xs px-3 py-1 rounded-control transition-colors"
                      >
                        Add
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {(!items || items.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/40">
                  No inventory items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}