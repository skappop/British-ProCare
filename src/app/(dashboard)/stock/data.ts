import { createClient } from '@/lib/supabase/server'
import { clinicDayRange } from '@/lib/clinicDay'

type One<T> = T | T[] | null
const one = <T,>(v: One<T>) => (Array.isArray(v) ? v[0] ?? null : v)

export type CheckItem = {
  id: string // container_items.id
  inventory_id: string
  name: string
  unit: string | null
  full: number
  missing: number
  missing_since: string | null
  reusable: boolean
  section: string | null
  /** A procedure lists it as a material: saved visits take it off stock. */
  by_visits: boolean
}

export type ContainerSummary = {
  id: string
  name: string
  description: string | null
  last_checked_at: string | null
  checked_today: boolean
  items: CheckItem[]
}

export type CabinetItem = {
  id: string
  name: string
  unit: string | null
  stock: number
  reorder_level: number
  order_quantity: number | null
  shelf: string | null
  supplier_id: string | null
  supplier_text: string | null
  last_counted_at: string | null
  ordered_at: string | null
  ordered_quantity: number | null
}

export type Supplier = { id: string; name: string; whatsapp: string | null; phone: string | null }

/** Start of the clinic's day, for "checked today". */
function todayStart() {
  return clinicDayRange().start.toISOString()
}

/**
 * Containers with what each should hold. `ready` is false until migration 18
 * has been run, so the pages can say so instead of failing.
 */
export async function getContainers(): Promise<{ ready: boolean; containers: ContainerSummary[] }> {
  const supabase = await createClient()
  const since = todayStart()
  const [{ data, error }, { data: bom }] = await Promise.all([
    supabase
      .from('containers')
      .select(
        'id, name, description, sort_order, last_checked_at, container_items(id, inventory_id, baseline_quantity, missing_quantity, missing_since, reusable, grid_section, inventory:inventory_id(name, unit))'
      )
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('procedure_bom').select('inventory_id'),
  ])

  if (error) return { ready: false, containers: [] }

  type Row = {
    id: string
    name: string
    description: string | null
    last_checked_at: string | null
    container_items: {
      id: string
      inventory_id: string
      baseline_quantity: number
      missing_quantity: number
      missing_since: string | null
      reusable: boolean
      grid_section: string | null
      inventory: One<{ name: string; unit: string | null }>
    }[]
  }

  const byVisits = new Set(((bom ?? []) as { inventory_id: string }[]).map((b) => b.inventory_id))
  const containers = ((data ?? []) as unknown as Row[]).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    last_checked_at: c.last_checked_at,
    checked_today: !!c.last_checked_at && c.last_checked_at >= since,
    items: (c.container_items ?? [])
      .map((ci) => ({
        id: ci.id,
        inventory_id: ci.inventory_id,
        name: one(ci.inventory)?.name ?? 'Item',
        unit: one(ci.inventory)?.unit ?? null,
        full: ci.baseline_quantity,
        missing: ci.missing_quantity ?? 0,
        missing_since: ci.missing_since,
        reusable: !!ci.reusable,
        section: ci.grid_section,
        by_visits: byVisits.has(ci.inventory_id),
      }))
      .sort((a, b) => (a.section ?? '').localeCompare(b.section ?? '') || a.name.localeCompare(b.name)),
  }))
  return { ready: true, containers }
}

/** How many containers have not been checked today (for the menu badge). */
export async function countContainersDue(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('containers').select('last_checked_at')
  if (error || !data) return 0
  const since = todayStart()
  return data.filter((c) => !c.last_checked_at || (c.last_checked_at as string) < since).length
}

export async function getCabinet(): Promise<{ ready: boolean; items: CabinetItem[]; suppliers: Supplier[] }> {
  const supabase = await createClient()
  const [{ data, error }, { data: suppliers }] = await Promise.all([
    supabase
      .from('inventory')
      .select(
        'id, name, unit, stock, reorder_level, order_quantity, shelf, supplier_id, supplier, last_counted_at, ordered_at, ordered_quantity'
      )
      .eq('is_active', true)
      .order('name'),
    supabase.from('suppliers').select('id, name, whatsapp, phone').order('name'),
  ])
  if (error) return { ready: false, items: [], suppliers: [] }
  type Row = Omit<CabinetItem, 'supplier_text'> & { supplier: string | null }
  return {
    ready: true,
    items: ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      stock: Number(r.stock) || 0,
      reorder_level: Number(r.reorder_level) || 0,
      order_quantity: r.order_quantity == null ? null : Number(r.order_quantity),
      shelf: r.shelf,
      supplier_id: r.supplier_id,
      supplier_text: r.supplier,
      last_counted_at: r.last_counted_at,
      ordered_at: r.ordered_at,
      ordered_quantity: r.ordered_quantity == null ? null : Number(r.ordered_quantity),
    })),
    suppliers: (suppliers ?? []) as Supplier[],
  }
}

/** Items at or below their minimum: the To-order list. */
export function needsOrdering(items: CabinetItem[]) {
  return items.filter((i) => i.reorder_level > 0 && i.stock <= i.reorder_level)
}

/** How much to order: the set amount, or enough to get back to twice the minimum. */
export function suggestedOrder(i: CabinetItem) {
  if (i.order_quantity && i.order_quantity > 0) return i.order_quantity
  return Math.max(Math.ceil(i.reorder_level * 2 - i.stock), 1)
}

/**
 * Today's few items to count: never counted (or flagged for a recount) first,
 * then the longest since last counted. A handful a day keeps the whole cabinet
 * honest without anyone ever doing a big count.
 */
export function pickDailyCount(items: CabinetItem[], howMany = 5) {
  const since = todayStart()
  const countedToday = items.filter((i) => i.last_counted_at && i.last_counted_at >= since).length
  const remaining = Math.max(howMany - countedToday, 0)
  return [...items]
    .filter((i) => !(i.last_counted_at && i.last_counted_at >= since))
    .sort((a, b) => {
      if (!a.last_counted_at && b.last_counted_at) return -1
      if (a.last_counted_at && !b.last_counted_at) return 1
      return (a.last_counted_at ?? '').localeCompare(b.last_counted_at ?? '')
    })
    .slice(0, remaining)
}
