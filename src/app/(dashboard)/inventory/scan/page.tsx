'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ScanLine, Camera, X } from 'lucide-react'
import { lookupInventoryItem, pullStock } from '../scanActions'

type Item = {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  stock: number
  reorder_level: number
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const [cameraCapable, setCameraCapable] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [item, setItem] = useState<Item | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [looking, setLooking] = useState(false)

  useEffect(() => {
    setCameraCapable(
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    )
    return () => stopScanning()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startScanning() {
    setResult(null)
    setItem(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.setAttribute('playsinline', 'true') // iOS: stay inline, don't fullscreen
        await video.play()
      }
      setScanning(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setResult({
        ok: false,
        message:
          'Could not access the camera. Allow camera permission in your browser, make sure the site is on HTTPS, then try again — or enter the SKU below.',
      })
      setCameraCapable(false)
    }
  }

  function stopScanning() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  // Pure-JS QR decode from the live video frames (works on iOS Safari, Android, desktop).
  function tick() {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
      const canvas = canvasRef.current
      // Downscale for speed — cap the longest edge at ~640px.
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
      const w = Math.round(video.videoWidth * scale)
      const h = Math.round(video.videoHeight * scale)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h)
        const img = ctx.getImageData(0, 0, w, h)
        const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
        if (code && code.data) {
          stopScanning()
          void handleCode(code.data.trim())
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  async function handleCode(code: string) {
    setLooking(true)
    try {
      const found = await lookupInventoryItem(code)
      if (!found) {
        setResult({ ok: false, message: `No inventory item matches "${code}"` })
        return
      }
      setItem(found)
      setResult(null)
    } finally {
      setLooking(false)
    }
  }

  function handlePull() {
    if (!item) return
    setIsPending(true)
    const formData = new FormData()
    formData.set('inventory_id', item.id)
    formData.set('qty', qty)
    formData.set('notes', notes)
    pullStock(formData).then((res) => {
      setResult(res)
      setIsPending(false)
      if (res.ok) {
        setItem(null)
        setQty('1')
        setNotes('')
      }
    })
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Inventory</p>
        <h1 className="font-display text-2xl text-ink-strong mt-1">Scan to Pull Stock</h1>
      </div>

      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-control ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      {!item && (
        <div className="bg-white rounded-card shadow-soft p-5 sm:p-6 space-y-4">
          {cameraCapable && (
            <>
              <div className="rounded-control overflow-hidden bg-ink aspect-square relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  autoPlay
                  playsInline
                />
                {!scanning ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50">
                    <Camera size={28} strokeWidth={1.5} />
                    <p className="text-sm">Tap “Start camera” to scan a QR</p>
                  </div>
                ) : (
                  <>
                    {/* scan reticle */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-2/3 aspect-square rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 text-white/80 text-xs">
                      <ScanLine size={14} className="animate-pulse" />
                      {looking ? 'Looking up…' : 'Point at the QR code'}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={scanning ? stopScanning : startScanning}
                className="w-full inline-flex items-center justify-center gap-2 bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2.5 rounded-control transition-colors"
              >
                {scanning ? (
                  <>
                    <X size={15} /> Stop scanning
                  </>
                ) : (
                  <>
                    <Camera size={15} /> Start camera
                  </>
                )}
              </button>
            </>
          )}

          <div className={cameraCapable ? 'border-t border-ink/8 pt-4' : ''}>
            <label className="text-xs text-ink/60">
              {cameraCapable ? 'Or enter SKU manually' : 'Enter the item SKU'}
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualCode) handleCode(manualCode.trim())
                }}
                placeholder="BRK-ROTH22-UR3"
                className="flex-1 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
              />
              <button
                type="button"
                onClick={() => manualCode && handleCode(manualCode.trim())}
                disabled={looking}
                className="px-4 py-2 rounded-control bg-marble/60 hover:bg-marble text-ink-strong text-sm transition-colors disabled:opacity-50"
              >
                Look up
              </button>
            </div>
          </div>
        </div>
      )}

      {item && (
        <div className="bg-white rounded-card shadow-soft p-5 sm:p-6 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/40 font-mono">
              {item.sku} · {item.category.replace('_', ' ')}
            </p>
            <h2 className="font-display text-lg text-ink-strong">{item.name}</h2>
            <p
              className={`font-mono text-sm mt-1 ${
                item.stock <= item.reorder_level ? 'text-danger font-semibold' : 'text-ink/70'
              }`}
            >
              {item.stock} {item.unit} in stock
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/60">Quantity to pull</label>
              <input
                type="number"
                step="0.001"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>
            <div>
              <label className="text-xs text-ink/60">Note (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. chairside use"
                className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePull}
              disabled={isPending}
              className="flex-1 bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-control transition-colors"
            >
              {isPending ? 'Pulling…' : `Pull ${qty || 0} ${item.unit}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setItem(null)
                setManualCode('')
              }}
              className="px-4 py-2.5 rounded-control border border-ink/15 text-sm text-ink/60 hover:bg-marble/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
