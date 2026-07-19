// Pure PDF drawing for the patient report. Takes a jsPDF instance (passed in so
// this module stays environment-agnostic and unit-testable) and draws a
// professional report using only core jsPDF primitives — no jspdf-autotable, so
// nothing depends on plugin resolution in the bundler.

type RGB = [number, number, number]

export type ReportData = {
  clinic: string
  generatedAt: string
  patient: {
    full_name: string
    file_number: string | null
    phone: string | null
    date_of_birth: string | null
    gender: string | null
    is_ortho: boolean
    allergies: string | null
    conditions: string | null
    medications: string | null
    pregnant: boolean
  }
  visits: { date: string; procedures: string[]; notes: string | null }[]
  findings: { fdi: string; status: string; note?: string }[]
}

const MARQUINA: RGB = [23, 24, 26]
const GOLD_DEEP: RGB = [160, 123, 74]
const INK: RGB = [62, 76, 89]
const INK_SOFT: RGB = [122, 132, 142]
const TEAL: RGB = [47, 166, 162]
const DANGER: RGB = [192, 101, 79]
const MARBLE: RGB = [247, 245, 241]
const CREAM: RGB = [237, 232, 223]
const BORDER: RGB = [231, 228, 221]

const STATUS_LABEL: Record<string, string> = {
  treated: 'Treated',
  planned: 'Planned',
  watch: 'Watch',
  missing: 'Missing',
  healthy: 'Healthy',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ageFrom(dob: string | null): string {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  const yrs = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
  return yrs > 0 ? ` (${yrs} yrs)` : ''
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildReportPdf(doc: any, report: ReportData, logoDataUrl: string | null) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 16
  const contentW = pageW - M * 2

  // ---- Header --------------------------------------------------------------
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', M, 13, 20, 20)
    } catch {
      /* ignore */
    }
  }
  const textX = logoDataUrl ? M + 25 : M
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...MARQUINA)
  doc.text(report.clinic, textX, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_SOFT)
  doc.text('Clinical treatment summary', textX, 26)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...GOLD_DEEP)
  doc.text('PATIENT REPORT', pageW - M, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK_SOFT)
  doc.text(`Generated ${fmtDate(report.generatedAt)}`, pageW - M, 25, { align: 'right' })

  doc.setDrawColor(...GOLD_DEEP)
  doc.setLineWidth(0.5)
  doc.line(M, 37, pageW - M, 37)

  // ---- Patient block -------------------------------------------------------
  let y = 47
  const p = report.patient
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...INK)
  doc.text(p.full_name || 'Patient', M, y)

  y += 8
  const fields: [string, string][] = [
    ['File No.', p.file_number || '—'],
    ['Phone', p.phone || '—'],
    ['Date of birth', `${fmtDate(p.date_of_birth)}${ageFrom(p.date_of_birth)}`],
    ['Gender', p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : '—'],
    ['Case type', p.is_ortho ? 'Orthodontic' : 'General'],
  ]
  doc.setFontSize(9)
  const colW = contentW / 2
  fields.forEach(([label, value], i) => {
    const x = M + (i % 2) * colW
    const yy = y + Math.floor(i / 2) * 7
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK_SOFT)
    doc.text(label, x, yy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(value, x + 26, yy)
  })
  y += Math.ceil(fields.length / 2) * 7 + 3

  // ---- Medical alerts ------------------------------------------------------
  const alerts: string[] = []
  if (p.allergies) alerts.push(`Allergies: ${p.allergies}`)
  if (p.conditions) alerts.push(`Conditions: ${p.conditions}`)
  if (p.medications) alerts.push(`Medications: ${p.medications}`)
  if (p.pregnant) alerts.push('Pregnant / breastfeeding')

  if (alerts.length) {
    const boxH = 7 + alerts.length * 5
    doc.setFillColor(250, 238, 234)
    doc.setDrawColor(...DANGER)
    doc.setLineWidth(0.3)
    doc.roundedRect(M, y, contentW, boxH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...DANGER)
    doc.text('MEDICAL ALERTS', M + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK)
    alerts.forEach((a, i) => doc.text(a, M + 3, y + 10 + i * 5))
    y += boxH + 7
  } else {
    y += 2
  }

  // ---- table renderer ------------------------------------------------------
  const lineH = 4.0
  const padX = 2.5
  const padY = 2
  const bottom = pageH - 16

  function sectionTitle(title: string) {
    if (y > bottom - 20) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...MARQUINA)
    doc.text(title, M, y)
    doc.setDrawColor(...CREAM)
    doc.setLineWidth(0.4)
    doc.line(M, y + 2, pageW - M, y + 2)
    y += 6
  }

  function table(head: string[], rows: string[][], widths: number[], headFill: RGB, headText: RGB) {
    const headH = lineH + padY * 2
    const drawHead = () => {
      doc.setFillColor(...headFill)
      doc.rect(M, y, contentW, headH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...headText)
      let cx = M
      head.forEach((h, i) => {
        doc.text(h, cx + padX, y + padY + lineH - 1)
        cx += widths[i]
      })
      y += headH
    }
    drawHead()

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    rows.forEach((row, ri) => {
      const cellLines = row.map((c, i) => doc.splitTextToSize(String(c ?? ''), widths[i] - padX * 2))
      const nLines = Math.max(1, ...cellLines.map((l: string[]) => l.length))
      const rowH = nLines * lineH + padY * 2

      if (y + rowH > bottom) {
        doc.addPage()
        y = 20
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
      doc.rect(M, y, contentW, rowH)

      doc.setTextColor(...INK)
      let cx = M
      cellLines.forEach((lines: string[], i: number) => {
        doc.text(lines, cx + padX, y + padY + lineH - 1)
        cx += widths[i]
      })
      y += rowH
    })
  }

  // ---- Treatment history ---------------------------------------------------
  sectionTitle('Treatment History')
  const third = contentW - 26 - 74
  table(
    ['Date', 'Procedures', 'Notes'],
    report.visits.length
      ? report.visits.map((v) => [fmtDate(v.date), v.procedures.length ? v.procedures.join(', ') : '—', v.notes || ''])
      : [['—', 'No recorded visits yet', '']],
    [26, 74, third],
    MARQUINA,
    [217, 188, 133]
  )
  y += 10

  // ---- Dental chart findings ----------------------------------------------
  sectionTitle('Dental Chart Findings')
  const noteW = contentW - 28 - 32
  table(
    ['Tooth (FDI)', 'Status', 'Note'],
    report.findings.length
      ? report.findings.map((f) => [f.fdi, STATUS_LABEL[f.status] || f.status, f.note || ''])
      : [['—', 'No charted findings', '']],
    [28, 32, noteW],
    TEAL,
    [255, 255, 255]
  )

  // ---- Footer on every page ------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...CREAM)
    doc.setLineWidth(0.3)
    doc.line(M, pageH - 12, pageW - M, pageH - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK_SOFT)
    doc.text(report.clinic, M, pageH - 8)
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 8, { align: 'right' })
    doc.text('Clinical summary — fees appear on the receipt.', pageW / 2, pageH - 8, { align: 'center' })
  }
}
