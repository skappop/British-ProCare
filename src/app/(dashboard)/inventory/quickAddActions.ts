'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuickAddRow = {
  name: string
  category: string
  unit: string
  stock: number
  reorder_level: number
}

function makeSku(name: string, category: string): string {
  const cat = (category || 'ITM').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'ITM'
  const nm = (name || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 5)
    .toUpperCase() || 'ITEM'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${cat}-${nm}-${rand}`
}

export async function bulkCreateInventory(rows: QuickAddRow[]) {
  const supabase = await createClient()

  const clean = rows
    .map((r) => ({ ...r, name: (r.name || '').trim() }))
    .filter((r) => r.name.length > 0)

  if (clean.length === 0) {
    return { ok: false, count: 0, message: 'Add at least one item with a name' }
  }

  const payload = clean.map((r) => ({
    sku: makeSku(r.name, r.category),
    name: r.name,
    category: r.category || 'other',
    unit: r.unit || 'pc',
    stock: Number.isFinite(r.stock) ? r.stock : 0,
    reorder_level: Number.isFinite(r.reorder_level) ? r.reorder_level : 0,
    attributes: {},
  }))

  const { error } = await supabase.from('inventory').insert(payload)

  if (error) {
    return { ok: false, count: 0, message: error.message }
  }

  revalidatePath('/inventory')
  return { ok: true, count: payload.length, message: `Added ${payload.length} item${payload.length === 1 ? '' : 's'}` }
}
