'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, MessageCircle, Printer, QrCode, X } from 'lucide-react'

/**
 * Hands patients the pre-registration form: copy the link, send it on
 * WhatsApp with the booking confirmation, or print a QR code for the desk.
 */
export default function RegistrationLink() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function openPanel() {
    const link = `${window.location.origin}/register`
    setUrl(link)
    setOpen(true)
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#1f2a2c', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `British ProCare: please fill in your details before your visit — it takes two minutes and saves time at reception.\n${url}`
  )}`

  function printPoster() {
    if (!qr) return
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    win.document.write(`<!doctype html><html><head><title>Register before your visit</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#1f2a2c}
      h1{font-size:28px;margin:0 0 8px}p{font-size:16px;color:#555;margin:0 0 32px}
      img{width:320px;height:320px}small{display:block;margin-top:24px;color:#888;font-size:13px}</style>
      </head><body><h1>Register before your visit</h1>
      <p>Scan with your phone camera — it takes two minutes.</p>
      <img src="${qr}" alt="QR code" /><small>${url}</small>
      <script>window.onload=function(){window.print()}</script></body></html>`)
    win.document.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 text-xs text-ink/55 hover:text-teal-deep px-2.5 py-1.5 rounded-control hover:bg-ink/5 transition-colors"
      >
        <QrCode size={14} /> Patient registration link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-card shadow-lg w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-control text-ink/40 hover:bg-ink/5"
            >
              <X size={15} />
            </button>

            <h2 className="font-display text-lg text-ink-strong">Registration link</h2>
            <p className="text-sm text-ink/55 mt-1">
              Patients fill in their details and health history before they arrive. It shows up
              here at reception the moment they submit.
            </p>

            <div className="mt-5 flex justify-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
                <img src={qr} alt="QR code for the registration form" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-marble rounded-control" />
              )}
            </div>

            <p className="mt-3 text-center font-mono text-xs text-ink/50 break-all">{url}</p>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <button
                type="button"
                onClick={copy}
                className="flex flex-col items-center gap-1 rounded-control border border-ink/10 py-2.5 text-xs text-ink/70 hover:bg-marble"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1 rounded-control border border-ink/10 py-2.5 text-xs text-ink/70 hover:bg-marble"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
              <button
                type="button"
                onClick={printPoster}
                disabled={!qr}
                className="flex flex-col items-center gap-1 rounded-control border border-ink/10 py-2.5 text-xs text-ink/70 hover:bg-marble disabled:opacity-50"
              >
                <Printer size={16} /> Print QR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
