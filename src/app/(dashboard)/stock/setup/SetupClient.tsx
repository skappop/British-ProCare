'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { CabinetItem, ContainerSummary, Supplier } from '../data'
import {
  addSupplier,
  deleteContainer,
  removeContainerItem,
  saveContainer,
  saveContainerItem,
  saveItemSettings,
} from '../actions'

const field = 'rounded-control border border-ink/15 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal'

export default function SetupClient({
  containers,
  items,
  suppliers,
}: {
  containers: ContainerSummary[]
  items: CabinetItem[]
  suppliers: Supplier[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [open, setOpen] = useState<string | null>(containers[0]?.id ?? null)

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    setMessage(null)
    startTransition(async () => {
      const res = await fn()
      setMessage(res.ok ? (done ? { ok: true, text: done } : null) : { ok: false, text: res.message || 'Could not save' })
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className={`rounded-control px-4 py-2 text-sm ${message.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{message.text}</p>
      )}

      {/* Containers */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg text-ink-strong">Containers</h2>
          <p className="text-sm text-ink/55">
            For each container, list what it holds when full. Tick <b>reusable</b> for tools that come back after sterilising
            (mirrors, pliers…): a short one is then reported missing, not used up.
          </p>
        </div>

        {containers.map((c) => (
          <ContainerCard
            key={c.id}
            container={c}
            items={items}
            open={open === c.id}
            onToggle={() => setOpen(open === c.id ? null : c.id)}
            busy={isPending}
            run={run}
          />
        ))}

        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New container, e.g. Endo box" className={`${field} flex-1`} />
          <button
            type="button"
            disabled={isPending || !newName.trim()}
            onClick={() => {
              run(() => saveContainer({ name: newName }), `${newName.trim()} added`)
              setNewName('')
            }}
            className="inline-flex items-center gap-1 rounded-control bg-teal px-4 text-sm text-white disabled:bg-ink/20"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </section>

      {/* Cabinet items */}
      <CabinetSettings items={items} suppliers={suppliers} busy={isPending} run={run} />
    </div>
  )
}

function ContainerCard({
  container,
  items,
  open,
  onToggle,
  busy,
  run,
}: {
  container: ContainerSummary
  items: CabinetItem[]
  open: boolean
  onToggle: () => void
  busy: boolean
  run: (fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) => void
}) {
  const [search, setSearch] = useState('')
  const [full, setFull] = useState('1')
  const [reusable, setReusable] = useState(false)
  const [name, setName] = useState(container.name)
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const inContainer = new Set(container.items.map((i) => i.inventory_id))
    return items.filter((i) => !inContainer.has(i.id) && i.name.toLowerCase().includes(q)).slice(0, 6)
  }, [search, items, container.items])

  return (
    <div className="overflow-hidden rounded-card bg-white shadow-soft">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1">
          <span className="block font-medium text-ink-strong">{container.name}</span>
          <span className="block text-xs text-ink/50">{container.items.length} items</span>
        </span>
        <ChevronDown size={18} className={`text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink/5 px-4 py-3">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} flex-1`} aria-label="Container name" />
            {name.trim() !== container.name && (
              <button type="button" disabled={busy} onClick={() => run(() => saveContainer({ id: container.id, name }), 'Renamed')} className="rounded-control bg-teal px-3 text-sm text-white">
                Rename
              </button>
            )}
          </div>

          <div className="divide-y divide-ink/5 rounded-control border border-ink/10">
            {container.items.map((i) => (
              <ItemRow key={i.id} item={i} containerId={container.id} busy={busy} run={run} />
            ))}
            {container.items.length === 0 && <p className="px-3 py-3 text-sm text-ink/45">Nothing listed yet — add the items below.</p>}
          </div>

          <div className="space-y-2 rounded-control bg-marble/60 p-3">
            <p className="text-xs font-medium text-ink/60">Add an item</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock items…" className={`${field} w-full`} />
            {matches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-ink/60">
                  Full amount
                  <input inputMode="numeric" value={full} onChange={(e) => setFull(e.target.value.replace(/\D/g, ''))} className={`${field} w-16 text-center`} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-ink/60">
                  <input type="checkbox" checked={reusable} onChange={(e) => setReusable(e.target.checked)} className="h-4 w-4 accent-teal" />
                  Reusable tool
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    run(
                      () => saveContainerItem({ container_id: container.id, inventory_id: m.id, full: Number(full) || 1, reusable }),
                      `${m.name} added to ${container.name}`
                    )
                    setSearch('')
                  }}
                  className="rounded-full border border-teal/40 bg-white px-3 py-1.5 text-xs text-teal-deep hover:bg-teal/5"
                >
                  + {m.name}
                </button>
              ))}
              {search.trim().length >= 2 && matches.length === 0 && (
                <p className="text-xs text-ink/45">No stock item matches. Add it in Inventory first.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete the ${container.name} container? Its stock items are not affected.`)) {
                run(() => deleteContainer(container.id), `${container.name} deleted`)
              }
            }}
            className="inline-flex items-center gap-1 text-xs text-ink/40 hover:text-danger"
          >
            <Trash2 size={13} /> Delete container
          </button>
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  containerId,
  busy,
  run,
}: {
  item: ContainerSummary['items'][number]
  containerId: string
  busy: boolean
  run: (fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) => void
}) {
  const [full, setFull] = useState(String(item.full))
  const [reusable, setReusable] = useState(item.reusable)
  const changed = Number(full) !== item.full || reusable !== item.reusable
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-ink-strong">
        {item.name}
        {item.by_visits && (
          <span className="ml-1.5 text-[11px] text-ink/40" title="A procedure lists this as a material, so saved visits take it off stock; refilling only moves it from the cabinet.">
            · taken off by visits
          </span>
        )}
      </span>
      <label className="flex items-center gap-1 text-xs text-ink/50">
        Full
        <input inputMode="numeric" value={full} onChange={(e) => setFull(e.target.value.replace(/\D/g, ''))} className={`${field} w-14 py-1 text-center`} />
      </label>
      <label className="flex items-center gap-1 text-xs text-ink/50">
        <input type="checkbox" checked={reusable} onChange={(e) => setReusable(e.target.checked)} className="h-4 w-4 accent-teal" />
        Reusable
      </label>
      {changed && (
        <button
          type="button"
          disabled={busy || !(Number(full) > 0)}
          onClick={() => run(() => saveContainerItem({ id: item.id, container_id: containerId, inventory_id: item.inventory_id, full: Number(full), reusable }), 'Saved')}
          className="rounded-control bg-teal px-2.5 py-1 text-xs text-white"
        >
          Save
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirm(`Remove ${item.name} from this container?`)) run(() => removeContainerItem(item.id))
        }}
        className="p-1 text-ink/30 hover:text-danger"
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function CabinetSettings({
  items,
  suppliers,
  busy,
  run,
}: {
  items: CabinetItem[]
  suppliers: Supplier[]
  busy: boolean
  run: (fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierWa, setSupplierWa] = useState('')
  const shown = items.filter((i) => i.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const noMinimum = items.filter((i) => i.reorder_level <= 0).length

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg text-ink-strong">Cabinet items</h2>
        <p className="text-sm text-ink/55">
          <b>Minimum</b>: when stock reaches it, the item goes on the To-order list. <b>Order</b>: how many to order each
          time. <b>Shelf</b>: where it is, so counts go shelf by shelf.
        </p>
        {noMinimum > 0 && (
          <p className="mt-1 text-xs text-gold-deep">
            {noMinimum} item{noMinimum === 1 ? ' has' : 's have'} no minimum yet, so {noMinimum === 1 ? 'it' : 'they'} will never be
            suggested for ordering.
          </p>
        )}
      </div>

      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find an item…" className={`${field} w-full`} />

      <div className="divide-y divide-ink/5 overflow-hidden rounded-card bg-white shadow-soft">
        {shown.map((i) => (
          <CabinetRow key={i.id} item={i} suppliers={suppliers} busy={busy} run={run} />
        ))}
        {shown.length === 0 && <p className="px-4 py-4 text-sm text-ink/45">No items.</p>}
      </div>

      <div className="flex flex-wrap gap-2 rounded-control bg-marble/60 p-3">
        <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="New supplier name" className={`${field} min-w-0 flex-1`} />
        <input value={supplierWa} onChange={(e) => setSupplierWa(e.target.value)} placeholder="WhatsApp number" inputMode="tel" className={`${field} w-40`} />
        <button
          type="button"
          disabled={busy || !supplierName.trim()}
          onClick={() => {
            run(() => addSupplier({ name: supplierName, whatsapp: supplierWa }), `${supplierName.trim()} added`)
            setSupplierName('')
            setSupplierWa('')
          }}
          className="rounded-control bg-teal px-3 text-sm text-white disabled:bg-ink/20"
        >
          Add supplier
        </button>
      </div>
    </section>
  )
}

function CabinetRow({
  item,
  suppliers,
  busy,
  run,
}: {
  item: CabinetItem
  suppliers: Supplier[]
  busy: boolean
  run: (fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) => void
}) {
  const [min, setMin] = useState(String(item.reorder_level || ''))
  const [orderQty, setOrderQty] = useState(item.order_quantity ? String(item.order_quantity) : '')
  const [shelf, setShelf] = useState(item.shelf ?? '')
  const [supplier, setSupplier] = useState(item.supplier_id ?? '')
  const changed =
    Number(min || 0) !== item.reorder_level ||
    Number(orderQty || 0) !== (item.order_quantity ?? 0) ||
    shelf.trim() !== (item.shelf ?? '') ||
    supplier !== (item.supplier_id ?? '')

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink-strong">{item.name}</p>
        <p className="shrink-0 text-xs text-ink/45">
          {item.stock} {item.unit || ''} in stock
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-ink/50">
          Minimum
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ''))} className={`${field} w-16 py-1 text-center`} />
        </label>
        <label className="flex items-center gap-1 text-xs text-ink/50">
          Order
          <input inputMode="numeric" value={orderQty} onChange={(e) => setOrderQty(e.target.value.replace(/[^\d.]/g, ''))} placeholder="auto" className={`${field} w-16 py-1 text-center`} />
        </label>
        <input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="Shelf" className={`${field} w-24 py-1`} aria-label="Shelf" />
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${field} py-1`} aria-label="Supplier">
          <option value="">{item.supplier_text ? `${item.supplier_text} (not linked)` : 'Supplier…'}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {changed && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  saveItemSettings({
                    id: item.id,
                    reorder_level: Number(min || 0),
                    order_quantity: orderQty ? Number(orderQty) : null,
                    shelf,
                    supplier_id: supplier || null,
                  }),
                `${item.name} saved`
              )
            }
            className="rounded-control bg-teal px-3 py-1 text-xs text-white"
          >
            Save
          </button>
        )}
      </div>
    </div>
  )
}
