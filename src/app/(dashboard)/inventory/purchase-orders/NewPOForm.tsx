'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPurchaseOrder } from '../poActions'

type Supplier = { id: string; name: string }
type InventoryItem = { id: string; sku: string; name: string; unit: string }

type Line = { inventoryId: string; qty: string; cost: string }

export default function NewPOForm({
  suppliers,
  items,
}: {
  suppliers: Supplier[]
  items: InventoryItem[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [lines, setLines] = useState<Line[]>([{ inventoryId: '', qty: '', cost: '' }])
  const [supplierId, setSupplierId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')

  function addLine() {
    setLines((l) => [...l, { inventoryId: '', qty: '', cost: '' }])
  }

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)))
  }

  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    const formData = new FormData()
    formData.set('supplier_id', supplierId)
    formData.set('expected_at', expectedAt)
    formData.set('notes', notes)
    for (const line of lines) {
      if (!line.inventoryId || !line.qty) continue
      formData.append('item_id', line.inventoryId)
      formData.append('item_qty', line.qty)
      formData.append('item_cost', line.cost)
    }

    startTransition(async () => {
      const res = await createPurchaseOrder(formData)
      setResult(res)
      if (res.ok) {
        setLines([{ inventoryId: '', qty: '', cost: '' }])
        setNotes('')
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-6 space-y-4">
      <h2 className="font-display text-base text-ink-strong">New Purchase Order</h2>

      {result && (
        <div
          className={`text-xs px-3 py-2 rounded-control ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink/60">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="">— Select —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink/60">Expected Date</label>
          <input
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
            className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-ink/60">Items</label>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={line.inventoryId}
              onChange={(e) => updateLine(i, 'inventoryId', e.target.value)}
              className="flex-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="">— Item —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.sku})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              placeholder="Qty"
              value={line.qty}
              onChange={(e) => updateLine(i, 'qty', e.target.value)}
              className="w-24 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Cost"
              value={line.cost}
              onChange={(e) => updateLine(i, 'cost', e.target.value)}
              className="w-24 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="text-danger/60 hover:text-danger text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="text-xs text-teal-deep hover:underline"
        >
          + Add item
        </button>
      </div>

      <div>
        <label className="text-xs text-ink/60">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-sm px-4 py-2 rounded-control transition-colors"
      >
        {isPending ? 'Creating…' : 'Create Purchase Order'}
      </button>
    </div>
  )
}
