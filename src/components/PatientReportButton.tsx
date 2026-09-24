'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText, Images, Loader2 } from 'lucide-react'
import { getPatientReportData } from '@/app/(dashboard)/patients/[id]/reportActions'
import { buildReportPdf } from '@/components/report/buildReportPdf'
import { loadReportImages, type PreparedImage, type SkippedImage } from '@/components/report/loadReportImages'
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

type Kind = 'report+images' | 'report' | 'images'
type Outcome = { ok: boolean; text: string; details?: string[] }

const KIND_LABEL: Record<Kind, string> = {
  'report+images': 'Report with images',
  report: 'Report only (no images)',
  images: 'Images only',
}

/** Says what actually went into the PDF, so a missing picture is never a surprise. */
function describe(kind: Kind, total: number, included: number, skipped: SkippedImage[], listError: string | null): Outcome {
  if (kind === 'report') return { ok: true, text: 'Report downloaded' }
  if (listError) return { ok: false, text: `Downloaded, but the image list could not be read: ${listError}` }
  if (total === 0) return { ok: true, text: 'Downloaded — this patient has no images on file yet' }
  if (included === total) return { ok: true, text: `Downloaded with all ${total} image${total === 1 ? '' : 's'}` }
  const reasons = [...new Set(skipped.map((s) => s.reason))]
  return {
    ok: included > 0,
    text: `Downloaded with ${included} of ${total} images — ${total - included} could not be added`,
    details: reasons.slice(0, 3),
  }
}

export default function PatientReportButton({
  patientId,
  variant = 'light',
  label,
  mode = 'full',
}: {
  patientId: string
  /** 'menu' offers the three kinds of PDF; the others make one kind. */
  variant?: 'light' | 'dark' | 'tile' | 'menu'
  label?: string
  /** For the single-kind variants: 'full' is the report with images, 'images' the photo sheet. */
  mode?: 'full' | 'images'
}) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [open, setOpen] = useState(false)
  const logoCache = useRef<string | null>(null)
  const menuRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function generate(kind: Kind) {
    setOpen(false)
    setOutcome(null)
    setLoading(true)
    try {
      await withMinDuration(
        (async () => {
          const [report, logo] = await Promise.all([getPatientReportData(patientId), loadLogo(logoCache)])
          if (!report) {
            setOutcome({ ok: false, text: 'Could not load the report' })
            return
          }
          let prepared = new Map<string, PreparedImage>()
          let skipped: SkippedImage[] = []
          if (kind !== 'report' && report.images.length) {
            const loaded = await loadReportImages(report.images, (done, total) => setProgress(`Images ${done}/${total}…`))
            prepared = loaded.prepared
            skipped = loaded.skipped
            if (skipped.length) console.warn('Report images left out:', skipped)
          }
          setProgress('Building PDF…')
          const { jsPDF } = await import('jspdf')
          const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
          buildReportPdf(doc, report, logo, { mode: kind === 'images' ? 'images' : 'full', prepared, skipped })
          const safeName = report.patient.full_name.replace(/[^\w\s-]/g, '').trim() || 'patient'
          doc.save(`${kind === 'images' ? 'Images' : 'Report'} - ${safeName}.pdf`)
          setOutcome(describe(kind, report.images.length, prepared.size, skipped, report.imagesError))
        })(),
        350
      )
    } catch (e) {
      console.error(e)
      setOutcome({ ok: false, text: 'The PDF could not be made' })
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const single: Kind = mode === 'images' ? 'images' : 'report+images'
  const text = loading ? progress ?? 'Preparing…' : label ?? (variant === 'menu' ? 'Download report' : KIND_LABEL[single])
  const dark = variant === 'dark' || variant === 'menu'

  const result = outcome && (
    <span className={`block text-xs ${outcome.ok ? (dark ? 'text-white/60' : 'text-ink/55') : dark ? 'text-[#F2B8A8]' : 'text-danger'}`}>
      {outcome.text}
      {outcome.details?.map((d) => (
        <span key={d} className="block opacity-80">· {d}</span>
      ))}
    </span>
  )

  if (variant === 'tile') {
    return (
      <div>
        <button
          type="button"
          onClick={() => generate(single)}
          disabled={loading}
          className="flex w-full items-center gap-3 rounded-control border border-ink/10 px-4 py-3 hover:border-teal hover:bg-teal/[0.04] transition-colors text-left disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          </span>
          <span className="text-sm text-ink-strong font-medium">{text}</span>
        </button>
        {result}
      </div>
    )
  }

  if (variant === 'menu') {
    return (
      <span ref={menuRef} className="relative inline-flex flex-col">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-sm text-gold-light hover:underline disabled:opacity-70"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {text}
          {!loading && <ChevronDown size={14} />}
        </button>
        {open && (
          <span className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-control bg-white py-1 text-ink shadow-soft ring-1 ring-ink/10">
            {(['report+images', 'report', 'images'] as Kind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => generate(kind)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-marble"
              >
                {kind === 'images' ? <Images size={15} className="text-gold-deep" /> : <FileText size={15} className="text-teal-deep" />}
                <span>
                  <span className="block text-ink-strong">{KIND_LABEL[kind]}</span>
                  <span className="block text-[11px] text-ink/45">
                    {kind === 'report+images'
                      ? 'Everything, with photos and X-rays'
                      : kind === 'report'
                        ? 'Small file, quick to send'
                        : 'Photos and X-rays on their own'}
                  </span>
                </span>
              </button>
            ))}
          </span>
        )}
        {result && <span className="mt-1 max-w-sm">{result}</span>}
      </span>
    )
  }

  const cls =
    variant === 'dark'
      ? 'text-gold-light hover:underline'
      : 'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-control border border-gold/40 text-gold-deep hover:bg-gold/10 transition-colors'

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={() => generate(single)} disabled={loading} className={cls}>
        {variant !== 'dark' && (loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />)}
        {variant === 'dark' ? `${text} →` : text}
      </button>
      {result}
    </span>
  )
}
