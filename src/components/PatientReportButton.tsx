'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { getPatientReportData } from '@/app/(dashboard)/patients/[id]/reportActions'
import { buildReportPdf } from '@/components/report/buildReportPdf'
import { loadReportImages } from '@/components/report/loadReportImages'
import { withMinDuration } from '@/lib/utils'

async function loadLogo(cache: React.MutableRefObject<string | null>): Promise<string | null> {
  if (cache.current !== null) return cache.current || null
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
    cache.current = dataUrl
    return dataUrl
  } catch {
    cache.current = ''
    return null
  }
}

export default function PatientReportButton({
  patientId,
  variant = 'light',
  label = 'Patient report (PDF)',
  mode = 'full',
}: {
  patientId: string
  variant?: 'light' | 'dark' | 'tile'
  label?: string
  /** 'full' is the clinical report; 'images' is the photo sheet from the gallery. */
  mode?: 'full' | 'images'
}) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const logoCache = useRef<string | null>(null)

  async function generate() {
    setErr(null)
    setLoading(true)
    try {
      await withMinDuration(
        (async () => {
          const [report, logo] = await Promise.all([getPatientReportData(patientId), loadLogo(logoCache)])
          if (!report) {
            setErr('Could not load report')
            return
          }
          const { prepared, skipped } = report.images.length
            ? await loadReportImages(report.images, (done, total) => setProgress(`Images ${done}/${total}…`))
            : { prepared: new Map(), skipped: [] }
          setProgress('Building PDF…')
          const { jsPDF } = await import('jspdf')
          const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
          buildReportPdf(doc, report, logo, { mode, prepared, skipped })
          const safeName = report.patient.full_name.replace(/[^\w\s-]/g, '').trim() || 'patient'
          doc.save(`${mode === 'images' ? 'Images' : 'Report'} - ${safeName}.pdf`)
        })(),
        350
      )
    } catch {
      setErr('Report failed to generate')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  if (variant === 'tile') {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors text-left disabled:opacity-60"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        </span>
        <span className="text-sm text-ink-strong font-medium">{loading ? progress ?? 'Preparing…' : label}</span>
      </button>
    )
  }

  const cls =
    variant === 'dark'
      ? 'text-gold-light hover:underline'
      : 'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-control border border-gold/40 text-gold-deep hover:bg-gold/10 transition-colors'

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={generate} disabled={loading} className={cls}>
        {variant !== 'dark' && (loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />)}
        {loading ? progress ?? 'Preparing…' : variant === 'dark' ? `${label} →` : label}
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  )
}
