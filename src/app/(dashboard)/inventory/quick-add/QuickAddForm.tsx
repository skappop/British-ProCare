'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, QrCode } from 'lucide-react'
import { bulkCreateInventory, type QuickAddRow } from '../quickAddActions'

type Row = { key: number; name: string; category: string; unit: string; stock: string; reorder: string }

let counter = 0
function blankRow(category: string, unit: string): Row {
  return { key: counter++, name: '', category, unit, stock: '0', reorder: '0' }
}

export default function QuickAddForm({ categories, units }: { categories: string[]; units: string[] }) {
  const router = useRouter()
  const defaultCat = categories[0] || 'other'
  const defaultUnit = units[0] || 'pc'
  const [rows, setRows] = useState<Row[]>(() => [blankRow(defaultCat, defaultUnit)])
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((rs) => [...rs, blankRow(defaultCat, defaultUnit)])
  }
  function addFive() {
    setRows((rs) => [...rs, ...Array.from({ length: 5 }, () => blankRow(defaultCat, defaultUnit))])
  }
  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  }

  function save(thenPrint: boolean) {
    setResult(null)
    const payload: QuickAddRow[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        category: r.category,
        unit: r.unit,
        stock: parseFloat(r.stock) || 0,
        reorder_level: parseFloat(r.reorder) || 0,
      }))
    if (payload.length === 0) {
      setResult({ ok: false, message: 'Add at least one item with a name' })
      return
    }
    startTransition(async () => {
      const res = await bulkCreateInventory(payload)
      setResult(res)
      if (res.ok) {
        if (thenPrint) router.push('/inventory/labels')
        else {
          setRows([blankRow(defaultCat, defaultUnit)])
          router.refresh()
        }
      }
    })
  }

  const filled = rows.filter((r) => r.name.trim()).length

  return (
    <div className="space-y-4">
      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-control ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="bg-white rounded-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-ink/8 text-left text-ink/50">
                <th className="px-3 py-2.5 font-medium">Item name *</th>
                <th className="px-3 py-2.5 font-medium">Category</th>
                <th className="px-3 py-2.5 font-medium">Unit</th>
                <th className="px-3 py-2.5 font-medium w-24">Stock</th>
                <th className="px-3 py-2.5 font-medium w-28">Reorder at</th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-ink/5 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addRow()
                      }}
                      placeholder="e.g. Roth .022 bracket UR3"
                      className="w-full rounded-control border border-ink/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.category}
                      onChange={(e) => update(r.key, { category: e.target.value })}
                      className="rounded-control border border-ink/15 px-2 py-1.5 text-sm capitalize"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.unit}
                      onChange={(e) => update(r.key, { unit: e.target.value })}
                      className="rounded-control border border-ink/15 px-2 py-1.5 text-sm"
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={r.stock}
                      onChange={(e) => update(r.key, { stock: e.target.value })}
                      className="w-full rounded-control border border-ink/15 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={r.reorder}
                      onChange={(e) => update(r.key, { reorder: e.target.value })}
                      className="w-full rounded-control border border-ink/15 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="text-ink/30 hover:text-danger p-1"
                      aria-label="Remove row"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 px-3 py-3 border-t border-ink/8">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-control border border-ink/15 text-ink/60 hover:bg-marble/60"
          >
            <Plus size={13} /> Add row
          </button>
          <button
            type="button"
            onClick={addFive}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-control border border-ink/15 text-ink/60 hover:bg-marble/60"
          >
            <Plus size={13} /> Add 5 rows
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isPending || filled === 0}
          className="bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-control transition-colors"
        >
          {isPending ? 'Saving…' : `Save ${filled || ''} item${filled === 1 ? '' : 's'}`.trim()}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={isPending || filled === 0}
          className="inline-flex items-center gap-2 border border-teal/40 text-teal-deep hover:bg-teal/10 disabled:opacity-50 text-sm px-4 py-2.5 rounded-control transition-colors"
        >
          <QrCode size={15} /> Save & print QR labels
        </button>
      </div>
    </div>
  )
}
