'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Printer, CheckSquare, Square } from 'lucide-react'

type Item = { id: string; sku: string; name: string; category: string }

export default function LabelSheet({ items }: { items: Item[] }) {
  const [qr, setQr] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)))
  const [perRow, setPerRow] = useState(3)

  // Generate every QR locally (encodes the item id — what the scanner reads).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const out: Record<string, string> = {}
      for (const it of items) {
        try {
          out[it.id] = await QRCode.toDataURL(it.id, {
            margin: 1,
            width: 240,
            errorCorrectionLevel: 'M',
          })
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setQr(out)
    })()
    return () => {
      cancelled = true
    }
  }, [items])

  const chosen = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected])
  const allSelected = selected.size === items.length
  const ready = Object.keys(qr).length === items.length

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #label-sheet, #label-sheet * { visibility: visible !important; }
          #label-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 8mm; }
          .no-print { display: none !important; }
          .label-card { break-inside: avoid; border: 1px solid #ccc !important; }
          @page { margin: 8mm; }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print flex flex-wrap items-center gap-3 bg-white rounded-card shadow-soft px-4 py-3">
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink-strong"
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-ink/45 font-mono">{selected.size} of {items.length} selected</span>

        <div className="ml-auto flex items-center gap-3">
          <label className="text-xs text-ink/50 inline-flex items-center gap-1.5">
            Per row
            <select
              value={perRow}
              onChange={(e) => setPerRow(Number(e.target.value))}
              className="rounded-control border border-ink/15 px-2 py-1 text-xs"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!ready || chosen.length === 0}
            className="inline-flex items-center gap-2 bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-sm px-4 py-2 rounded-control transition-colors"
          >
            <Printer size={15} />
            {ready ? `Print ${chosen.length} label${chosen.length === 1 ? '' : 's'}` : 'Preparing…'}
          </button>
        </div>
      </div>

      {!ready && (
        <p className="no-print text-xs text-ink/40">Generating QR codes… ({Object.keys(qr).length}/{items.length})</p>
      )}

      {/* The printable sheet */}
      <div
        id="label-sheet"
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
      >
        {chosen.map((it) => (
          <div
            key={it.id}
            className="label-card bg-white rounded-lg border border-ink/10 p-3 flex flex-col items-center text-center"
          >
            {qr[it.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr[it.id]} alt="" className="w-28 h-28" />
            ) : (
              <div className="w-28 h-28 bg-marble animate-pulse rounded" />
            )}
            <p className="mt-2 font-mono text-[11px] font-semibold text-ink-strong break-all leading-tight">{it.sku}</p>
            <p className="text-[10px] text-ink/55 leading-tight line-clamp-2">{it.name}</p>
            <p className="text-[9px] text-ink/35 uppercase tracking-wide mt-0.5">{it.category.replace('_', ' ')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
