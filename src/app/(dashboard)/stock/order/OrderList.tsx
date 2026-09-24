'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageCircle, PackageCheck, Undo2 } from 'lucide-react'
import { markOrdered, receiveDelivery, undoStock } from '../actions'

export type OrderLine = {
  id: string
  name: string
  unit: string | null
  stock: number
  minimum: number
  suggested: number
  ordered_at: string | null
  ordered_quantity: number | null
}

export type OrderGroup = { key: string; name: string; whatsapp: string | null; lines: OrderLine[] }

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('20')) return d
  if (d.startsWith('0')) return `2${d}`
  return d
}

function since(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

export default function OrderList({ groups }: { groups: OrderGroup[] }) {
  const router = useRouter()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [skip, setSkip] = useState<Record<string, boolean>>({})
  const [arrived, setArrived] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ ok: boolean; text: string; batch?: string | null } | null>(null)
  const [isPending, startTransition] = useTransition()

  function undoLast() {
    const batch = message?.batch
    if (!batch) return
    startTransition(async () => {
      const res = await undoStock(batch)
      setMessage(res.ok ? { ok: true, text: 'Undone' } : { ok: false, text: res.message || 'Could not undo' })
      router.refresh()
    })
  }

  if (groups.length === 0) {
    // (Receiving the last delivery empties the list: keep its message.)
    return (
      <div className="space-y-2">
        {message && !message.ok && <p className="rounded-control bg-danger/10 px-4 py-2 text-sm text-danger">{message.text}</p>}
        <p className="flex items-center gap-2 rounded-card bg-success/10 px-4 py-4 text-sm font-medium text-success">
          <CheckCircle2 size={18} /> <span className="flex-1">{message?.ok ? `${message.text}. ` : ''}Nothing is below its minimum.</span>
          {message?.batch && (
            <button type="button" onClick={undoLast} disabled={isPending} className="inline-flex items-center gap-1 text-xs font-normal text-ink/60 underline">
              <Undo2 size={13} /> Undo
            </button>
          )}
        </p>
      </div>
    )
  }

  function chosen(g: OrderGroup) {
    return g.lines.filter((l) => !l.ordered_at && !skip[l.id]).map((l) => ({ ...l, quantity: qty[l.id] ?? l.suggested }))
  }

  function whatsappLink(g: OrderGroup) {
    const lines = chosen(g)
    const text =
      `Hello${g.key === 'none' ? '' : ` ${g.name}`}, this is British ProCare Dental Clinics. We would like to order:\n` +
      lines.map((l) => `• ${l.name} × ${l.quantity}${l.unit ? ` ${l.unit}` : ''}`).join('\n') +
      '\nThank you.'
    const to = g.whatsapp ? waNumber(g.whatsapp) : ''
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
  }

  function order(g: OrderGroup) {
    const lines = chosen(g)
    if (!lines.length) return
    startTransition(async () => {
      const res = await markOrdered(lines.map((l) => ({ inventory_id: l.id, quantity: l.quantity })))
      setMessage(res.ok ? { ok: true, text: `Marked as ordered from ${g.name}` } : { ok: false, text: res.message || 'Could not save' })
      router.refresh()
    })
  }

  function receive(l: OrderLine) {
    const n = Number(arrived[l.id] ?? l.ordered_quantity ?? l.suggested)
    if (!(n > 0)) {
      setMessage({ ok: false, text: 'Enter how many arrived' })
      return
    }
    startTransition(async () => {
      const res = await receiveDelivery(l.id, n)
      setMessage(
        res.ok ? { ok: true, text: `${l.name}: ${n} added to stock`, batch: res.batch } : { ok: false, text: res.message || 'Could not save' }
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`flex items-center gap-2 rounded-control px-4 py-2 text-sm ${message.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          <span className="flex-1">{message.text}</span>
          {message.batch && (
            <button type="button" onClick={undoLast} disabled={isPending} className="inline-flex items-center gap-1 text-xs text-ink/60 underline">
              <Undo2 size={13} /> Undo
            </button>
          )}
        </div>
      )}
      {groups.map((g) => {
        const toOrder = g.lines.filter((l) => !l.ordered_at)
        const waiting = g.lines.filter((l) => l.ordered_at)
        const picked = chosen(g)
        return (
          <section key={g.key} className="overflow-hidden rounded-card bg-white shadow-soft">
            <h2 className="bg-marble/70 px-4 py-2 text-sm font-medium text-ink-strong">{g.name}</h2>

            {toOrder.map((l) => (
              <div key={l.id} className={`flex items-center gap-3 border-t border-ink/5 px-4 py-3 ${skip[l.id] ? 'opacity-45' : ''}`}>
                <input
                  type="checkbox"
                  checked={!skip[l.id]}
                  onChange={(e) => setSkip((s) => ({ ...s, [l.id]: !e.target.checked }))}
                  className="h-5 w-5 accent-teal"
                  aria-label={`Order ${l.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-strong">{l.name}</p>
                  <p className="text-xs text-danger">
                    {l.stock} left · minimum {l.minimum}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-xs text-ink/50">
                  Order
                  <input
                    inputMode="numeric"
                    value={qty[l.id] ?? l.suggested}
                    onChange={(e) => setQty((q) => ({ ...q, [l.id]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) }))}
                    className="w-14 rounded-control border border-ink/15 px-1.5 py-1.5 text-center font-mono text-sm"
                  />
                </label>
              </div>
            ))}

            {toOrder.length > 0 && (
              <div className="grid grid-cols-2 gap-2 border-t border-ink/5 p-3">
                <a
                  href={picked.length ? whatsappLink(g) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!picked.length}
                  className={`flex items-center justify-center gap-1.5 rounded-control py-2.5 text-sm font-medium ${
                    picked.length ? 'bg-[#25D366]/15 text-[#128C4A]' : 'pointer-events-none bg-ink/5 text-ink/30'
                  }`}
                >
                  <MessageCircle size={15} /> WhatsApp order
                </a>
                <button
                  type="button"
                  disabled={isPending || !picked.length}
                  onClick={() => order(g)}
                  className="rounded-control bg-teal py-2.5 text-sm font-medium text-white disabled:bg-ink/20"
                >
                  Mark {picked.length} ordered
                </button>
              </div>
            )}

            {waiting.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-t border-ink/5 bg-teal/[0.04] px-4 py-3">
                <PackageCheck size={18} className="shrink-0 text-teal-deep" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-strong">{l.name}</p>
                  <p className="text-xs text-ink/50">
                    Ordered {since(l.ordered_at!)}
                    {l.ordered_quantity ? ` · ${l.ordered_quantity}` : ''} — waiting for delivery
                  </p>
                </div>
                <input
                  inputMode="numeric"
                  aria-label={`How many ${l.name} arrived`}
                  value={arrived[l.id] ?? String(l.ordered_quantity ?? l.suggested)}
                  onChange={(e) => setArrived((a) => ({ ...a, [l.id]: e.target.value.replace(/\D/g, '') }))}
                  className="w-14 rounded-control border border-ink/15 px-1.5 py-1.5 text-center font-mono text-sm"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => receive(l)}
                  className="rounded-control bg-white px-3 py-2 text-xs font-medium text-teal-deep shadow-soft"
                >
                  Arrived
                </button>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
