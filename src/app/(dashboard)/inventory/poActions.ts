'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createSupplier(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('suppliers').insert({
    name: formData.get('name') as string,
    phone: (formData.get('phone') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
    email: (formData.get('email') as string) || null,
    notes: (formData.get('notes') as string) || null,
  })

  if (error) {
    redirect('/inventory/suppliers?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/inventory/suppliers')
  redirect('/inventory/suppliers')
}

export async function createPurchaseOrder(formData: FormData) {
  const supabase = await createClient()

  const supplierId = formData.get('supplier_id') as string
  const notes = formData.get('notes') as string
  const expectedAt = formData.get('expected_at') as string

  const itemIds = formData.getAll('item_id') as string[]
  const quantities = formData.getAll('item_qty') as string[]
  const costs = formData.getAll('item_cost') as string[]

  const lineItems = itemIds
    .map((id, i) => ({
      inventory_id: id,
      quantity: parseFloat(quantities[i]),
      unit_cost: costs[i] ? parseFloat(costs[i]) : null,
    }))
    .filter((li) => li.inventory_id && li.quantity > 0)

  if (lineItems.length === 0) {
    return { ok: false, message: 'Add at least one item with a quantity' }
  }

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: supplierId || null,
      status: 'ordered',
      ordered_at: new Date().toISOString(),
      expected_at: expectedAt || null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (poError || !po) {
    return { ok: false, message: poError?.message || 'Failed to create purchase order' }
  }

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(
    lineItems.map((li) => ({ ...li, purchase_order_id: po.id }))
  )

  if (itemsError) {
    return { ok: false, message: itemsError.message }
  }

  revalidatePath('/inventory/purchase-orders')
  return { ok: true, message: 'Purchase order created' }
}

export async function receivePurchaseOrder(poId: string, expiryDates: Record<string, string>) {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('id, inventory_id, quantity, unit_cost')
    .eq('purchase_order_id', poId)

  if (!items || items.length === 0) {
    return { ok: false, message: 'No items on this purchase order' }
  }

  for (const item of items) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('stock')
      .eq('id', item.inventory_id)
      .single()

    if (!inv) continue

    await supabase
      .from('inventory')
      .update({ stock: Number(inv.stock) + Number(item.quantity) })
      .eq('id', item.inventory_id)

    await supabase.from('inventory_batches').insert({
      inventory_id: item.inventory_id,
      quantity: item.quantity,
      cost_per_unit: item.unit_cost,
      expiry_date: expiryDates[item.inventory_id] || null,
    })

    await supabase.from('stock_movements').insert({
      inventory_id: item.inventory_id,
      change_qty: item.quantity,
      reason: 'po_receipt',
      reference_id: poId,
    })
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'received', received_at: new Date().toISOString() })
    .eq('id', poId)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/inventory/purchase-orders')
  revalidatePath('/inventory')
  revalidatePath('/')

  return { ok: true, message: 'Purchase order received — stock updated' }
}

export async function cancelPurchaseOrder(poId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', poId)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/inventory/purchase-orders')
  return { ok: true, message: 'Purchase order cancelled' }
}
