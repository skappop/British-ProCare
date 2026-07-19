import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NewPOForm from './NewPOForm'
import POCard from './POCard'

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()

  const [{ data: suppliers }, { data: items }, { data: purchaseOrders }] = await Promise.all([
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('inventory').select('id, sku, name, unit').eq('is_active', true).order('name'),
    supabase
      .from('purchase_orders')
      .select('*, suppliers(name), purchase_order_items(inventory_id, quantity, unit_cost, inventory(name, unit))')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inventory" className="text-xs text-teal-deep hover:underline">
            ← Inventory
          </Link>
          <h1 className="font-display text-2xl text-ink-strong mt-1">Purchase Orders</h1>
        </div>
        <Link href="/inventory/suppliers" className="text-xs text-ink/50 hover:text-teal-deep">
          Manage Suppliers →
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <NewPOForm suppliers={suppliers || []} items={items || []} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          {(purchaseOrders as any[])?.map((po) => (
            <POCard
              key={po.id}
              po={{
                id: po.id,
                status: po.status,
                supplier_name: po.suppliers?.name || null,
                ordered_at: po.ordered_at,
                expected_at: po.expected_at,
                notes: po.notes,
              }}
              items={po.purchase_order_items || []}
            />
          ))}
          {(!purchaseOrders || purchaseOrders.length === 0) && (
            <div className="bg-white rounded-card shadow-soft px-4 py-10 text-center text-ink/40 text-sm">
              No purchase orders yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
