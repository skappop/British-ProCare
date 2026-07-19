'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// A scanned QR encodes the inventory item's UUID. This looks it up by id,
// falling back to SKU in case someone scans/types a SKU instead.
export async function lookupInventoryItem(code: string) {
  const supabase = await createClient()
  const trimmed = code.trim()

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)

  const { data } = await supabase
    .from('inventory')
    .select('id, sku, name, category, unit, stock, reorder_level')
    .eq(isUuid ? 'id' : 'sku', trimmed)
    .eq('is_active', true)
    .single()

  return data || null
}

export async function pullStock(formData: FormData) {
  const supabase = await createClient()

  const inventoryId = formData.get('inventory_id') as string
  const qtyRaw = formData.get('qty') as string
  const notes = formData.get('notes') as string
  const qty = parseFloat(qtyRaw)

  if (!inventoryId || !qtyRaw || isNaN(qty) || qty <= 0) {
    return { ok: false, message: 'Enter a valid quantity' }
  }

  const { data: item } = await supabase
    .from('inventory')
    .select('stock, name, unit')
    .eq('id', inventoryId)
    .single()

  if (!item) {
    return { ok: false, message: 'Item not found' }
  }

  if (qty > item.stock) {
    return { ok: false, message: `Only ${item.stock} ${item.unit} in stock` }
  }

  const newStock = Number(item.stock) - qty

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ stock: newStock })
    .eq('id', inventoryId)

  if (updateError) {
    return { ok: false, message: updateError.message }
  }

  await supabase.from('stock_movements').insert({
    inventory_id: inventoryId,
    change_qty: -qty,
    reason: 'qr_pull',
    notes: notes || null,
  })

  revalidatePath('/inventory')
  revalidatePath('/')

  return { ok: true, message: `Pulled ${qty} ${item.unit} of ${item.name}. ${newStock} left.` }
}
