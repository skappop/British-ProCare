'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { receivePurchaseOrder, cancelPurchaseOrder } from '../poActions'

type POItem = { inventory_id: string; quantity: number; unit_cost: number | null; inventory: { name: string; unit: string } }

export default function POCard({
  po,
  items,
}: {
  po: { id: string; status: string; supplier_name: string | null; ordered_at: string | null; expected_at: string | null; notes: string | null }
  items: POItem[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [showReceive, setShowReceive] = useState(false)
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleReceive() {
    startTransition(async () => {
      const res = await receivePurchaseOrder(po.id, expiryDates)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  function handleCancel() {
    if (!confirm('Cancel this purchase order?')) return
    startTransition(async () => {
      const res = await cancelPurchaseOrder(po.id)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-ink/10 text-ink/50',
    ordered: 'bg-teal/10 text-teal-deep',
    received: 'bg-success/10 text-success',
    cancelled: 'bg-danger/10 text-danger',
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-ink-strong font-medium">{po.supplier_name || 'No supplier'}</p>
          <p className="text-xs text-ink/40 font-mono mt-0.5">
            {po.ordered_at ? new Date(po.ordered_at).toLocaleDateString('en-GB') : '—'}
            {po.expected_at && ` · expected ${new Date(po.expected_at).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[po.status]}`}>
          {po.status}
        </span>
      </div>

      {result && (
        <div
          className={`text-xs px-3 py-2 rounded-control mb-3 ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-ink/70">{it.inventory?.name}</span>
            <span className="font-mono text-ink-strong">
              {it.quantity} {it.inventory?.unit}
              {it.unit_cost ? ` · EGP ${it.unit_cost}` : ''}
            </span>
          </div>
        ))}
      </div>

      {po.status === 'ordered' && !showReceive && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowReceive(true)}
            className="text-xs px-3 py-1.5 rounded-control bg-success/10 text-success hover:bg-success/20 transition-colors"
          >
            Receive
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-control bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {showReceive && (
        <div className="border-t border-ink/8 pt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-ink/40">
            Set expiry per item (optional)
          </p>
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink/70 flex-1">{it.inventory?.name}</span>
              <input
                type="date"
                onChange={(e) =>
                  setExpiryDates((prev) => ({ ...prev, [it.inventory_id]: e.target.value }))
                }
                className="rounded-control border border-ink/15 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleReceive}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-control bg-teal hover:bg-teal-deep text-white transition-colors"
            >
              {isPending ? 'Receiving…' : 'Confirm Receipt'}
            </button>
            <button
              type="button"
              onClick={() => setShowReceive(false)}
              className="text-xs px-3 py-1.5 rounded-control border border-ink/15 text-ink/60 hover:bg-marble/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
