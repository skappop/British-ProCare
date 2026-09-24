'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'

type Sticker = { id: string; name: string; items: number }

/**
 * Stickers to put on each container. The QR code is an ordinary web link, so
 * the phone's own camera opens the container's check — no scanner app.
 */
export default function ContainerStickers({ containers }: { containers: Sticker[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      containers.map(async (c) => [c.id, await QRCode.toDataURL(`${window.location.origin}/stock/check/${c.id}`, { margin: 1, width: 360 })] as const)
    ).then((pairs) => {
      if (!cancelled) setCodes(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [containers])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/stock/setup" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble" aria-label="Back to set-up">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-display text-xl text-ink-strong">Container stickers</h1>
            <p className="text-xs text-ink/50">Print, cut out, stick one on each container. Point any phone camera at it to open the check.</p>
          </div>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-control bg-teal px-4 py-2 text-sm text-white">
          <Printer size={15} /> Print
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
        {containers.map((c) => (
          <div key={c.id} className="break-inside-avoid rounded-card border-2 border-dashed border-ink/20 bg-white p-4 text-center">
            <p className="font-display text-lg leading-tight text-ink-strong">{c.name}</p>
            {codes[c.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={codes[c.id]} alt={`QR code for ${c.name}`} className="mx-auto my-2 h-36 w-36" />
            ) : (
              <div className="mx-auto my-2 h-36 w-36 animate-pulse rounded bg-ink/5" />
            )}
            <p className="text-[11px] text-ink/55">Scan at closing to check</p>
            <p className="text-[10px] text-ink/35">British ProCare · {c.items} items</p>
          </div>
        ))}
      </div>
      {containers.length === 0 && <p className="text-sm text-ink/50">No containers yet.</p>}
    </div>
  )
}
