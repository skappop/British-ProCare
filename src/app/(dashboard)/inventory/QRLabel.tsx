'use client'

export default function QRLabel({
  itemId,
  sku,
  name,
}: {
  itemId: string
  sku: string
  name: string
}) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(itemId)}`

  function printLabel() {
    const win = window.open('', '_blank', 'width=400,height=500')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${sku} label</title>
          <style>
            body { font-family: monospace; text-align: center; padding: 24px; }
            img { width: 200px; height: 200px; }
            p { margin: 4px 0; }
            .sku { font-weight: bold; font-size: 14px; }
            .name { font-size: 11px; color: #555; }
          </style>
        </head>
        <body>
          <img src="${qrUrl}" />
          <p class="sku">${sku}</p>
          <p class="name">${name}</p>
          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="bg-marble/40 rounded-control p-4 flex items-center gap-4">
      <img src={qrUrl} alt="QR code" className="w-20 h-20 rounded-control bg-white p-1" />
      <div className="flex-1">
        <p className="text-xs text-ink/60 mb-2">
          Scan this at <span className="font-mono">/inventory/scan</span> to pull stock instantly.
        </p>
        <button
          type="button"
          onClick={printLabel}
          className="text-xs px-3 py-1.5 rounded-control bg-teal hover:bg-teal-deep text-white transition-colors"
        >
          Print Label
        </button>
      </div>
    </div>
  )
}
