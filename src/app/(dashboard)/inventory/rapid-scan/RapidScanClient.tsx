'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Zap, Package, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logRapidScan } from './actions'
import { Html5Qrcode } from 'html5-qrcode'

interface Container {
  id: string
  name: string
}

interface Props {
  userEmail: string
  containers: Container[]
}

type ScanMode = 'consume' | 'restock'

interface ScanResult {
  success: boolean
  mode: ScanMode
  containerName: string
  itemName: string
  message: string
  timestamp: Date
}

export default function RapidScanClient({ userEmail, containers }: Props) {
  const [scanMode, setScanMode] = useState<ScanMode>('consume')
  const [isScanning, setIsScanning] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Initialize camera
  const startScanning = async () => {
    try {
      setError(null)
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanFailure
      )

      setIsScanning(true)
    } catch (err: any) {
      console.error('Failed to start camera:', err)
      setError(err?.message || 'Failed to start camera')
    }
  }

  // Stop camera
  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        scannerRef.current = null
        setIsScanning(false)
      } catch (err) {
        console.error('Failed to stop camera:', err)
      }
    }
  }

  // Handle successful QR code scan
  const onScanSuccess = async (decodedText: string) => {
    try {
      // Parse QR code payload: {"c": "container_id", "i": "item_id"}
      const payload = JSON.parse(decodedText)
      const { c: containerId, i: itemId } = payload

      if (!containerId || !itemId) {
        throw new Error('Invalid QR code format')
      }

      // Log the scan via server action
      const result = await logRapidScan({
        containerId,
        itemId,
        scanMode,
        userEmail,
      })

      const containerName =
        containers.find((c) => c.id === containerId)?.name || 'Unknown Container'

      const scanResult: ScanResult = {
        success: result.success,
        mode: scanMode,
        containerName,
        itemName: result.itemName || 'Unknown Item',
        message: result.message,
        timestamp: new Date(),
      }

      setLastScan(scanResult)
      setRecentScans((prev) => [scanResult, ...prev.slice(0, 9)])

      // Flash feedback
      if (result.success) {
        triggerFlash(scanMode === 'consume' ? 'green' : 'blue')
      } else {
        triggerFlash('red')
      }
    } catch (err: any) {
      console.error('Scan error:', err)
      const errorResult: ScanResult = {
        success: false,
        mode: scanMode,
        containerName: 'Error',
        itemName: '',
        message: err.message || 'Invalid QR code',
        timestamp: new Date(),
      }
      setLastScan(errorResult)
      setRecentScans((prev) => [errorResult, ...prev.slice(0, 9)])
      triggerFlash('red')
    }
  }

  const onScanFailure = (error: string) => {
    // Ignore scan failures (occurs constantly when no QR code in view)
  }

  // Visual flash feedback
  const triggerFlash = (color: string) => {
    setFlashColor(color)
    setTimeout(() => setFlashColor(null), 300)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Rapid Scan</h1>
        <p className="text-muted-foreground">
          Zero-click scanning for chairside consumption and container restocking
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scanner */}
        <div className="lg:col-span-2">
          <div className="bg-surface-2 border border-white/10 rounded-lg p-6">
            {/* Mode Toggle */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex bg-surface-1 rounded-full p-1">
                <button
                  onClick={() => setScanMode('consume')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    scanMode === 'consume'
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <Zap className="inline mr-2" size={16} />
                  CONSUME
                </button>
                <button
                  onClick={() => setScanMode('restock')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    scanMode === 'restock'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <Package className="inline mr-2" size={16} />
                  RESTOCK
                </button>
              </div>
            </div>

            {/* Mode Description */}
            <div className="text-center mb-6">
              {scanMode === 'consume' ? (
                <p className="text-sm text-green-400">
                  Chairside usage: Scan items as you remove them from the container
                </p>
              ) : (
                <p className="text-sm text-blue-400">
                  Refill mode: Scan items as you add them back from central stock
                </p>
              )}
            </div>

            {/* Camera View */}
            <div className="relative">
              {/* Flash overlay */}
              {flashColor && (
                <div
                  className="absolute inset-0 z-50 rounded-lg pointer-events-none transition-opacity duration-300"
                  style={{
                    backgroundColor:
                      flashColor === 'green'
                        ? 'rgba(34, 197, 94, 0.4)'
                        : flashColor === 'blue'
                        ? 'rgba(59, 130, 246, 0.4)'
                        : 'rgba(239, 68, 68, 0.4)',
                  }}
                />
              )}

              {/* Scanner container */}
              <div
                id="qr-reader"
                ref={videoContainerRef}
                className="w-full aspect-video bg-surface-1 rounded-lg overflow-hidden"
              />

              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-1 rounded-lg">
                  <div className="text-center">
                    <Camera className="mx-auto mb-4 text-muted-foreground" size={64} />
                    <p className="text-muted-foreground mb-4">Camera inactive</p>
                    <Button onClick={startScanning}>
                      <Camera className="mr-2" size={16} />
                      Start Camera
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Controls */}
            {isScanning && (
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={stopScanning} className="flex-1">
                  <RotateCcw className="mr-2" size={16} />
                  Stop Camera
                </Button>
              </div>
            )}

            {/* Last Scan Result */}
            {lastScan && (
              <div
                className={`mt-6 p-4 rounded-lg border ${
                  lastScan.success
                    ? lastScan.mode === 'consume'
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div
                      className={`text-sm font-semibold ${
                        lastScan.success
                          ? lastScan.mode === 'consume'
                            ? 'text-green-400'
                            : 'text-blue-400'
                          : 'text-red-400'
                      }`}
                    >
                      {lastScan.success ? '✓ Success' : '✗ Failed'}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{lastScan.itemName}</span>
                      {lastScan.containerName && (
                        <span className="text-muted-foreground"> from {lastScan.containerName}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{lastScan.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lastScan.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Scans */}
        <div className="lg:col-span-1">
          <div className="bg-surface-2 border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Scans</h2>
            {recentScans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No scans yet
              </p>
            ) : (
              <div className="space-y-2">
                {recentScans.map((scan, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      scan.success
                        ? 'bg-surface-3 border-white/10'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span
                        className={`text-xs font-medium uppercase ${
                          scan.mode === 'consume' ? 'text-green-400' : 'text-blue-400'
                        }`}
                      >
                        {scan.mode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {scan.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium truncate">{scan.itemName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {scan.containerName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-surface-2 border border-white/10 rounded-lg p-6">
        <h3 className="font-semibold mb-3">How to Use Rapid Scan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-green-400 font-semibold mb-2">CONSUME Mode (Chairside)</div>
            <ol className="space-y-1 text-muted-foreground">
              <li>1. Select CONSUME mode</li>
              <li>2. Start camera</li>
              <li>3. Scan item QR code as you take it from container</li>
              <li>4. Green flash confirms deduction</li>
              <li>5. No clicking or quantity input needed</li>
            </ol>
          </div>
          <div>
            <div className="text-blue-400 font-semibold mb-2">RESTOCK Mode (Refill)</div>
            <ol className="space-y-1 text-muted-foreground">
              <li>1. Select RESTOCK mode</li>
              <li>2. Start camera</li>
              <li>3. Scan item QR code as you add it to container</li>
              <li>4. Blue flash confirms addition</li>
              <li>5. Stock automatically refilled from central inventory</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
