// Pure PDF drawing for the patient report. Takes a jsPDF instance (passed in so
// this module stays environment-agnostic and testable) and draws with core
// jsPDF primitives only — no plugins to resolve in the bundler.
//
// Two layouts: 'full' is the clinical record; 'images' is a photo sheet for
// the gallery's export. Neither shows fees — this is a document patients and
// other dentists receive.

import type { PatientReport } from '@/app/(dashboard)/patients/[id]/reportActions'
import type { PreparedImage, SkippedImage } from './loadReportImages'

type RGB = [number, number, number]

const MARQUINA: RGB = [23, 24, 26]
const GOLD: RGB = [184, 147, 94]
const GOLD_DEEP: RGB = [160, 123, 74]
const INK: RGB = [62, 76, 89]
const INK_SOFT: RGB = [122, 132, 142]
const TEAL: RGB = [47, 166, 162]
const DANGER: RGB = [192, 101, 79]
const MARBLE: RGB = [247, 245, 241]
const CREAM: RGB = [237, 232, 223]
const BORDER: RGB = [231, 228, 221]

const TOOTH_STATUS: Record<string, string> = {
  treated: 'Treated', planned: 'Needs treatment', watch: 'Decay / problem', missing: 'Missing', healthy: 'Healthy',
}

const IMAGE_TYPE: Record<string, string> = {
  intraoral_front: 'Intraoral — front', intraoral_left: 'Intraoral — left', intraoral_right: 'Intraoral — right',
  occlusal_upper: 'Occlusal — upper', occlusal_lower: 'Occlusal — lower', panoramic: 'Panoramic',
  cephalometric: 'Cephalometric', extraoral: 'Extraoral', other: '',
}

const GROUPS: { key: string; title: string }[] = [
  { key: 'radiograph', title: 'Radiographs' },
  { key: 'intraoral', title: 'Intraoral photographs' },
  { key: 'document', title: 'Documents' },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ageFrom(dob: string | null): string {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  const yrs = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
  return yrs > 0 ? `  (${yrs} yrs)` : ''
}

function label(value: string): string {
  return value ? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—'
}

function imageCaption(img: PatientReport['images'][number]): string {
  const kind = IMAGE_TYPE[img.image_type] || (img.category === 'radiograph' ? 'Radiograph' : img.category === 'document' ? 'Document' : 'Photograph')
  return [kind, fmtDate(img.taken_at), img.is_baseline ? 'Baseline' : ''].filter(Boolean).join('  ·  ')
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildReportPdf(
  doc: any,
  report: PatientReport,
  logoDataUrl: string | null,
  options: {
    mode?: 'full' | 'images'
    prepared?: Map<string, PreparedImage>
    skipped?: SkippedImage[]
  } = {}
) {
  const mode = options.mode ?? 'full'
  const prepared = options.prepared ?? new Map()
  const skipped = options.skipped ?? []

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 16
  const contentW = pageW - M * 2
  const bottom = pageH - 18
  const p = report.patient
  let y = 0

  // ---- page furniture -------------------------------------------------------
  function newPage() {
    doc.addPage()
    // A slim running header, so a loose page still says whose it is.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(p.full_name, M, 12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK_SOFT)
    doc.text(p.file_number ? `File ${p.file_number}` : '', pageW - M, 12, { align: 'right' })
    doc.setDrawColor(...CREAM)
    doc.setLineWidth(0.3)
    doc.line(M, 15, pageW - M, 15)
    y = 23
  }

  function ensure(space: number) {
    if (y + space > bottom) newPage()
  }

  function sectionTitle(title: string, needs = 24) {
    ensure(needs)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...MARQUINA)
    doc.text(title, M, y)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.5)
    doc.line(M, y + 2, M + 14, y + 2)
    y += 8
  }

  const lineH = 4.1
  const padX = 2.5
  const padY = 2

  function table(head: string[], rows: string[][], widths: number[], accent: RGB) {
    const headH = lineH + padY * 2
    const drawHead = () => {
      doc.setFillColor(...accent)
      doc.rect(M, y, contentW, headH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(255, 255, 255)
      let cx = M
      head.forEach((h, i) => {
        doc.text(h, cx + padX, y + padY + lineH - 1)
        cx += widths[i]
      })
      y += headH
    }
    ensure(headH + lineH + padY * 2)
    drawHead()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    rows.forEach((row, ri) => {
      const cells = row.map((c, i) => doc.splitTextToSize(String(c ?? ''), widths[i] - padX * 2))
      const rowH = Math.max(1, ...cells.map((l: string[]) => l.length)) * lineH + padY * 2
      if (y + rowH > bottom) {
        newPage()
        drawHead()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
      }
      if (ri % 2 === 1) {
        doc.setFillColor(...MARBLE)
        doc.rect(M, y, contentW, rowH, 'F')
      }
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.1)
      doc.line(M, y + rowH, M + contentW, y + rowH)
      doc.setTextColor(...INK)
      let cx = M
      cells.forEach((lines: string[], i: number) => {
        doc.text(lines, cx + padX, y + padY + lineH - 1)
        cx += widths[i]
      })
      y += rowH
    })
    y += 8
  }

  // ---- cover header ---------------------------------------------------------
  doc.setFillColor(...MARQUINA)
  doc.rect(0, 0, pageW, 34, 'F')
  let textX = M
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', M, 7, 20, 20)
      textX = M + 25
    } catch {
      // A bad logo must not stop the report.
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...GOLD)
  doc.text('BRITISH PROCARE', textX, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 200, 200)
  doc.text('Dental Clinics', textX, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(mode === 'images' ? 'IMAGING RECORD' : 'PATIENT REPORT', pageW - M, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 200, 200)
  doc.text(`Prepared ${fmtDate(report.generatedAt)}`, pageW - M, 22, { align: 'right' })
  y = 44

  // ---- patient card -----------------------------------------------------------
  const fields: [string, string][] = [
    ['File no.', p.file_number || '—'],
    ['Phone', p.phone || '—'],
    ['Date of birth', `${fmtDate(p.date_of_birth)}${ageFrom(p.date_of_birth)}`],
    ['Gender', p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender ? label(p.gender) : '—'],
    ['Case', p.is_ortho ? 'Orthodontic' : 'General'],
    ['Next visit', report.nextVisit ? fmtDateTime(report.nextVisit) : '—'],
  ]
  const cardH = 14 + Math.ceil(fields.length / 2) * 6.5
  doc.setFillColor(...MARBLE)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.roundedRect(M, y, contentW, cardH, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...MARQUINA)
  doc.text(p.full_name || 'Patient', M + 5, y + 9)
  doc.setFontSize(8.5)
  fields.forEach(([k, v], i) => {
    const x = M + 5 + (i % 2) * (contentW / 2)
    const yy = y + 16 + Math.floor(i / 2) * 6.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK_SOFT)
    doc.text(k, x, yy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(v, x + 24, yy)
  })
  y += cardH + 7

  // ---- medical alerts ---------------------------------------------------------
  const alerts: [string, string][] = []
  if (p.allergies) alerts.push(['Allergies', p.allergies])
  if (p.conditions) alerts.push(['Conditions', p.conditions])
  if (p.medications) alerts.push(['Medications', p.medications])
  if (p.pregnant) alerts.push(['Pregnancy', 'Pregnant or breastfeeding'])
  if (p.health_note) alerts.push(['Patient note', p.health_note])

  if (alerts.length && mode === 'full') {
    doc.setFontSize(8.5)
    const wrapped = alerts.map(([k, v]) => ({ k, lines: doc.splitTextToSize(v, contentW - 34) as string[] }))
    const boxH = 9 + wrapped.reduce((n, a) => n + a.lines.length * 4.3 + 1, 0)
    ensure(boxH + 4)
    doc.setFillColor(251, 240, 236)
    doc.setDrawColor(...DANGER)
    doc.setLineWidth(0.3)
    doc.roundedRect(M, y, contentW, boxH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...DANGER)
    doc.text('MEDICAL ALERTS', M + 4, y + 5.5)
    let ay = y + 11
    wrapped.forEach(({ k, lines }) => {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DANGER)
      doc.text(k, M + 4, ay)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...INK)
      doc.text(lines, M + 30, ay)
      ay += lines.length * 4.3 + 1
    })
    y += boxH + 8
  }

  if (mode === 'full') {
    // ---- treatment plan -------------------------------------------------------
    if (report.plan) {
      sectionTitle('Treatment plan')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(`${label(report.plan.status)} · started ${fmtDate(report.plan.started_at)}`, M, y)
      y += 5
      if (report.plan.notes) {
        const lines = doc.splitTextToSize(report.plan.notes, contentW)
        doc.setTextColor(...INK_SOFT)
        doc.text(lines, M, y)
        y += lines.length * 4.3 + 2
      }
      y += 2
      if (report.plan.phases.length) {
        table(
          ['Phase', 'Status', 'Planned', 'Dates'],
          report.plan.phases.map((ph) => [
            ph.name,
            label(ph.status),
            ph.planned_weeks ? `${ph.planned_weeks} weeks` : '—',
            ph.start ? `${fmtDate(ph.start)} – ${ph.end ? fmtDate(ph.end) : 'ongoing'}` : '—',
          ]),
          [60, 26, 26, contentW - 112],
          TEAL
        )
      }
    }

    // ---- visits -----------------------------------------------------------------
    sectionTitle('Treatment history')
    table(
      ['Date', 'Procedures', 'Notes'],
      report.visits.length
        ? report.visits.map((v) => [fmtDate(v.date), v.procedures.join(', ') || '—', v.notes || ''])
        : [['—', 'No visits recorded yet', '']],
      [26, 72, contentW - 98],
      MARQUINA
    )

    // ---- dental chart -----------------------------------------------------------
    sectionTitle('Dental chart')
    table(
      ['Tooth', 'Status', 'Findings'],
      report.findings.length
        ? report.findings.map((f) => [f.fdi, TOOTH_STATUS[f.status] || label(f.status), f.note || ''])
        : [['—', 'No findings charted', '']],
      [26, 32, contentW - 58],
      TEAL
    )

    // ---- lab work ---------------------------------------------------------------
    if (report.labs.length) {
      sectionTitle('Lab work')
      table(
        ['Sent', 'Type', 'Lab', 'Status', 'Notes'],
        report.labs.map((l) => [fmtDate(l.sent_at), label(l.case_type), l.lab_name || '—', label(l.status), l.notes || '']),
        [24, 26, 34, 24, contentW - 108],
        GOLD_DEEP
      )
    }
  }

  // ---- images -----------------------------------------------------------------
  const shownImages = report.images.filter((i) => prepared.has(i.id))
  if (shownImages.length || skipped.length) {
    if (mode === 'full') newPage()
    const gap = 6
    const colW = (contentW - gap) / 2

    // Say up front if anything is missing, so nobody takes the pages below as
    // the complete set.
    if (skipped.length) {
      ensure(12 + skipped.length * 4.5)
      doc.setFillColor(...MARBLE)
      doc.roundedRect(M, y - 4, contentW, 8 + skipped.length * 4.5, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...INK)
      doc.text(`${skipped.length} image${skipped.length === 1 ? '' : 's'} not shown in this PDF`, M + 3, y + 0.5)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...INK_SOFT)
      skipped.forEach((sk) => {
        const img = report.images.find((i) => i.id === sk.id)
        doc.text(`${img ? `${imageCaption(img)} — ${img.filename}` : sk.id}: ${sk.reason}`, M + 3, y)
        y += 4.5
      })
      y += 6
    }

    const groupKeys = [...GROUPS.map((g) => g.key)]
    const extra = [...new Set(shownImages.map((i) => i.category))].filter((k) => !groupKeys.includes(k))
    const groups = [...GROUPS, ...extra.map((k) => ({ key: k, title: label(k) }))]

    for (const group of groups) {
      const items = shownImages.filter((i) => i.category === group.key)
      if (!items.length) continue
      sectionTitle(`${group.title}  (${items.length})`, 80)

      let i = 0
      while (i < items.length) {
        const first = prepared.get(items[i].id)!
        // Panoramic and other wide images get the full width; photos go two by two.
        const wide = first.width / first.height > 1.7
        const row = wide ? [items[i]] : items.slice(i, i + 2).filter((it, k) => k === 0 || prepared.get(it.id)!.width / prepared.get(it.id)!.height <= 1.7)
        const cellW = wide ? contentW : colW
        const maxH = wide ? 95 : 72

        const sizes = row.map((it) => {
          const img = prepared.get(it.id)!
          let w = cellW
          let h = (cellW * img.height) / img.width
          if (h > maxH) {
            h = maxH
            w = (maxH * img.width) / img.height
          }
          return { w, h }
        })
        const captionH = row.some((it) => it.notes) ? 11 : 7
        const rowH = Math.max(...sizes.map((s) => s.h)) + captionH
        ensure(rowH + 4)

        row.forEach((it, k) => {
          const img = prepared.get(it.id)!
          const { w, h } = sizes[k]
          const cellX = M + k * (colW + gap)
          const x = cellX + (cellW - w) / 2
          doc.setDrawColor(...BORDER)
          doc.setLineWidth(0.2)
          doc.rect(x - 0.3, y - 0.3, w + 0.6, h + 0.6)
          doc.addImage(img.dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST')
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(...INK)
          // Captions share one baseline across the row, under the tallest image.
          const captionY = y + rowH - captionH + 4.5
          doc.text(imageCaption(it), cellX, captionY)
          if (it.notes) {
            doc.setTextColor(...INK_SOFT)
            doc.text(doc.splitTextToSize(it.notes, cellW)[0], cellX, captionY + 4)
          }
        })
        y += rowH + 4
        i += row.length
      }
    }

  } else if (mode === 'images') {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK_SOFT)
    doc.text('No images on file for this patient yet.', M, y + 4)
  }

  // ---- footer on every page -----------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n)
    doc.setDrawColor(...CREAM)
    doc.setLineWidth(0.3)
    doc.line(M, pageH - 12, pageW - M, pageH - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK_SOFT)
    doc.text('Confidential — patient medical record', M, pageH - 7.5)
    doc.text(report.clinic, pageW / 2, pageH - 7.5, { align: 'center' })
    doc.text(`Page ${n} of ${pages}`, pageW - M, pageH - 7.5, { align: 'right' })
  }
}
