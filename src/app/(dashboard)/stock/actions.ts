'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/auth/role'
import { canOpen } from '@/lib/auth/access'

type Result = { ok: boolean; message?: string; batch?: string | null; changes?: { item: string; kind: string; quantity: number }[] }

function refresh() {
  revalidatePath('/stock', 'layout')
  revalidatePath('/inventory')
  revalidatePath('/')
}

function friendly(message: string) {
  const already = message.match(/ALREADY_CHECKED: (\d\d:\d\d)/)
  if (already) {
    return `Someone else saved a check of this container at ${already[1]}. Nothing was changed — reload to see it before checking again.`
  }
  if (/function .* does not exist|Could not find the function/i.test(message)) {
    return 'Stock routines are not set up yet — run migrations/18_stock_routines.sql in Supabase.'
  }
  return message
}

async function call(fn: string, args: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return { ok: false, message: friendly(error.message) }
  refresh()
  const d = (data ?? {}) as { batch?: string | null; changes?: Result['changes'] }
  return { ok: true, batch: d.batch ?? null, changes: d.changes ?? [] }
}

export type CheckLine = { item: string; short: number; refilled: boolean }

/** The end-of-day check of one container. Lines only for what was short. */
export async function checkContainer(containerId: string, lines: CheckLine[], seen: string | null = null): Promise<Result> {
  const clean = (lines ?? [])
    .map((l) => ({ item: String(l.item), short: Math.max(0, Math.floor(Number(l.short) || 0)), refilled: !!l.refilled }))
    .filter((l) => l.short > 0)
  return call('stock_check_container', { p_container: containerId, p_lines: clean, p_seen: seen })
}

export async function resolveMissing(containerItemId: string, outcome: 'found' | 'written_off', replace = false) {
  return call('stock_resolve_missing', { p_item: containerItemId, p_outcome: outcome, p_replace: replace })
}

export async function recordCount(lines: { inventory_id: string; counted: number }[]): Promise<Result> {
  const clean = (lines ?? [])
    .map((l) => ({ inventory_id: String(l.inventory_id), counted: Number(l.counted) }))
    .filter((l) => Number.isFinite(l.counted) && l.counted >= 0)
  if (clean.length === 0) return { ok: false, message: 'Nothing counted' }
  return call('stock_record_count', { p_lines: clean })
}

export async function markOrdered(lines: { inventory_id: string; quantity: number }[]) {
  return call('stock_mark_ordered', { p_lines: lines })
}

export async function receiveDelivery(inventoryId: string, quantity: number) {
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0) return { ok: false, message: 'Enter how many arrived' }
  return call('stock_receive', { p_inventory: inventoryId, p_quantity: q })
}

export async function undoStock(batch: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('stock_undo', { p_batch: batch })
  if (error) return { ok: false, message: friendly(error.message) }
  refresh()
  const undone = (data as { undone?: number } | null)?.undone ?? 0
  return { ok: undone > 0, message: undone > 0 ? 'Undone' : 'Nothing to undo (older than a day, or already undone)' }
}

// ---------------------------------------------------------------------------
// Setup (owner and dentists): what each container holds, and item settings.
// ---------------------------------------------------------------------------

async function canSetUp() {
  return canOpen(await getCurrentUserRole(), '/stock/setup')
}

export async function saveContainer(input: { id?: string; name: string; description?: string }) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Give the container a name' }
  const supabase = await createClient()
  const row = { name, description: input.description?.trim() || null }
  const { error } = input.id
    ? await supabase.from('containers').update(row).eq('id', input.id)
    : await supabase.from('containers').insert(row)
  if (error) return { ok: false, message: error.message }
  refresh()
  return { ok: true }
}

export async function deleteContainer(id: string) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const supabase = await createClient()
  // The old rapid-scan log points at containers without a cascade; its rows
  // would block the delete. (Ignored where that table does not exist.)
  await supabase.from('rapid_scan_log').delete().eq('container_id', id)
  const { error } = await supabase.from('containers').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  refresh()
  return { ok: true }
}

export async function saveContainerItem(input: {
  id?: string
  container_id: string
  inventory_id: string
  full: number
  reusable: boolean
}) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const full = Math.max(1, Math.floor(Number(input.full) || 1))
  const supabase = await createClient()
  if (input.id) {
    const { error } = await supabase
      .from('container_items')
      .update({ baseline_quantity: full, reusable: !!input.reusable })
      .eq('id', input.id)
    if (error) return { ok: false, message: error.message }
  } else {
    const { data: existing } = await supabase
      .from('container_items')
      .select('id')
      .eq('container_id', input.container_id)
      .eq('inventory_id', input.inventory_id)
      .limit(1)
    if (existing && existing.length) return { ok: false, message: 'That item is already in this container' }
    const { error } = await supabase.from('container_items').insert({
      container_id: input.container_id,
      inventory_id: input.inventory_id,
      baseline_quantity: full,
      current_quantity: full,
      reusable: !!input.reusable,
    })
    if (error) return { ok: false, message: error.message }
  }
  refresh()
  return { ok: true }
}

export async function removeContainerItem(id: string) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const supabase = await createClient()
  const { error } = await supabase.from('container_items').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  refresh()
  return { ok: true }
}

export async function saveItemSettings(input: {
  id: string
  reorder_level: number
  order_quantity: number | null
  shelf: string | null
  supplier_id: string | null
}) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory')
    .update({
      reorder_level: Math.max(0, Number(input.reorder_level) || 0),
      order_quantity: input.order_quantity && input.order_quantity > 0 ? input.order_quantity : null,
      shelf: input.shelf?.trim() || null,
      supplier_id: input.supplier_id || null,
    })
    .eq('id', input.id)
  if (error) return { ok: false, message: error.message }
  refresh()
  return { ok: true }
}

export async function addSupplier(input: { name: string; whatsapp?: string }) {
  if (!(await canSetUp())) return { ok: false, message: 'Not allowed' }
  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Give the supplier a name' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, whatsapp: input.whatsapp?.trim() || null })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  refresh()
  return { ok: true, id: data.id as string }
}
