'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createInventoryItem(formData: FormData) {
  const supabase = await createClient()

  const attributesRaw = formData.get('attributes') as string
  let attributes = {}
  if (attributesRaw?.trim()) {
    try {
      attributes = JSON.parse(attributesRaw)
    } catch {
      redirect('/inventory/new?error=' + encodeURIComponent('Attributes must be valid JSON'))
    }
  }

  const { error } = await supabase.from('inventory').insert({
    sku: formData.get('sku') as string,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    unit: formData.get('unit') as string,
    stock: parseFloat(formData.get('stock') as string) || 0,
    reorder_level: parseFloat(formData.get('reorder_level') as string) || 0,
    cost_per_unit: formData.get('cost_per_unit') ? parseFloat(formData.get('cost_per_unit') as string) : null,
    supplier: formData.get('supplier') as string || null,
    attributes,
  })

  if (error) {
    redirect('/inventory/new?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/inventory')
  redirect('/inventory')
}

export async function restockItem(formData: FormData) {
  const supabase = await createClient()

  const inventoryId = formData.get('inventory_id') as string
  const qty = parseFloat(formData.get('qty') as string)

  if (!qty || qty <= 0) {
    redirect('/inventory?error=' + encodeURIComponent('Restock quantity must be positive'))
  }

  const { data: item } = await supabase.from('inventory').select('stock').eq('id', inventoryId).single()
  if (!item) redirect('/inventory?error=' + encodeURIComponent('Item not found'))

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ stock: item.stock + qty, updated_at: new Date().toISOString() })
    .eq('id', inventoryId)

  if (updateError) {
    redirect('/inventory?error=' + encodeURIComponent(updateError.message))
  }

  await supabase.from('inventory_transactions').insert({
    inventory_id: inventoryId,
    change: qty,
    reason: 'restock',
  })

  revalidatePath('/inventory')
}

export async function updateInventoryItem(id: string, formData: FormData) {
  const supabase = await createClient()

  const attributesRaw = formData.get('attributes') as string
  let attributes = {}
  if (attributesRaw?.trim()) {
    try {
      attributes = JSON.parse(attributesRaw)
    } catch {
      redirect(`/inventory/${id}/edit?error=` + encodeURIComponent('Attributes must be valid JSON'))
    }
  }

  const { error } = await supabase.from('inventory').update({
    sku: formData.get('sku') as string,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    unit: formData.get('unit') as string,
    reorder_level: parseFloat(formData.get('reorder_level') as string) || 0,
    cost_per_unit: formData.get('cost_per_unit') ? parseFloat(formData.get('cost_per_unit') as string) : null,
    supplier: formData.get('supplier') as string || null,
    attributes,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) {
    redirect(`/inventory/${id}/edit?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/inventory')
  redirect('/inventory')
}

export async function deactivateItem(id: string) {
  const supabase = await createClient()
  await supabase.from('inventory').update({ is_active: false }).eq('id', id)
  revalidatePath('/inventory')
  redirect('/inventory')
}

export async function duplicateItem(id: string) {
  const supabase = await createClient()

  const { data: src } = await supabase.from('inventory').select('*').eq('id', id).single()
  if (!src) redirect('/inventory')

  const { data: copy, error } = await supabase.from('inventory').insert({
    sku: `${src.sku}-COPY`,
    name: `${src.name} (copy)`,
    category: src.category,
    unit: src.unit,
    attributes: src.attributes,
    stock: 0,
    reorder_level: src.reorder_level,
    cost_per_unit: src.cost_per_unit,
    supplier: src.supplier,
  }).select().single()

  if (error) {
    redirect('/inventory?error=' + encodeURIComponent(error.message))
  }

  redirect(`/inventory/${copy.id}/edit`)
}