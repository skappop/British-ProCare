// Rapid charting: the vocabulary, tooth names and the parser for typed entries
// such as "26 c1", "ul6 c2 mo" or "16 26 f". Pure functions, shared by the
// chart, the reception walk-in panel and the PDF report.

import type { ToothStatus } from './toothStatus'

export type Finding = {
  code: string
  /** Surfaces, e.g. "MO". */
  surfaces?: string
  note?: string
  /** When it was charted (ISO). */
  at: string
}

export type ToothData = { status: ToothStatus; note?: string; findings?: Finding[] }
export type OdontogramData = Record<string, ToothData>

type Condition = {
  code: string
  label: string
  /** What is printed under the tooth. */
  short: string
  status: ToothStatus
  /** What can be typed for it. */
  keys: string[]
}

const CLASS = ['I', 'II', 'III', 'IV', 'V', 'VI']

export const CONDITIONS: Condition[] = [
  ...CLASS.map((roman, i) => ({
    code: `c${i + 1}`,
    label: `Caries Class ${roman}`,
    short: `C${i + 1}`,
    status: 'watch' as ToothStatus,
    keys: [`c${i + 1}`, `cl${i + 1}`, `class${i + 1}`],
  })),
  { code: 'caries', label: 'Caries', short: 'C', status: 'watch', keys: ['c', 'car', 'caries'] },
  { code: 'fracture', label: 'Fracture', short: 'Fx', status: 'watch', keys: ['fx', 'frac', 'fracture'] },
  { code: 'root', label: 'Retained root', short: 'RR', status: 'watch', keys: ['rr', 'root'] },
  { code: 'mobile', label: 'Mobile', short: 'Mob', status: 'watch', keys: ['mob', 'mobile'] },
  { code: 'impacted', label: 'Impacted', short: 'Ia', status: 'watch', keys: ['ia', 'impacted'] },
  { code: 'watch', label: 'Watch', short: 'W', status: 'watch', keys: ['w', 'watch'] },
  { code: 'extract', label: 'Extraction needed', short: 'X', status: 'planned', keys: ['x', 'ext', 'extract'] },
  { code: 'need_rct', label: 'Needs RCT', short: 'RCT?', status: 'planned', keys: ['nrct'] },
  { code: 'need_crown', label: 'Needs crown', short: 'Cr?', status: 'planned', keys: ['ncr', 'ncrown'] },
  { code: 'need_filling', label: 'Needs filling', short: 'F?', status: 'planned', keys: ['nf', 'nfill'] },
  { code: 'planned', label: 'Treatment planned', short: 'Plan', status: 'planned', keys: ['p', 'plan', 'planned'] },
  { code: 'filling', label: 'Filling', short: 'F', status: 'treated', keys: ['f', 'fill', 'comp', 'composite'] },
  { code: 'amalgam', label: 'Amalgam', short: 'Am', status: 'treated', keys: ['am', 'amalgam'] },
  { code: 'rct', label: 'Root canal treated', short: 'RCT', status: 'treated', keys: ['rct', 'endo'] },
  { code: 'crown', label: 'Crown', short: 'Cr', status: 'treated', keys: ['cr', 'crown'] },
  { code: 'bridge', label: 'Bridge', short: 'Br', status: 'treated', keys: ['br', 'bridge', 'pontic'] },
  { code: 'implant', label: 'Implant', short: 'Imp', status: 'treated', keys: ['imp', 'implant'] },
  { code: 'treated', label: 'Treated', short: 'Tx', status: 'treated', keys: ['tx', 'treated'] },
  { code: 'missing', label: 'Missing', short: 'M', status: 'missing', keys: ['m', 'miss', 'missing'] },
]

const BY_CODE = new Map(CONDITIONS.map((c) => [c.code, c]))
const BY_KEY = new Map(CONDITIONS.flatMap((c) => c.keys.map((k) => [k, c] as const)))
const CLEAR_KEYS = new Set(['h', 'ok', 'sound', 'healthy', 'clear'])

export function condition(code: string): Condition | undefined {
  return BY_CODE.get(code)
}

export function findingLabel(f: Finding): string {
  const c = BY_CODE.get(f.code)
  return [c?.label ?? f.code, f.surfaces ? `(${f.surfaces})` : '', f.note ? `— ${f.note}` : '']
    .filter(Boolean)
    .join(' ')
}

export function findingShort(f: Finding): string {
  return BY_CODE.get(f.code)?.short ?? f.code
}

// Red (decay, problems) beats gold (needs treatment) beats teal (treated).
const RANK: Record<ToothStatus, number> = { watch: 4, planned: 3, treated: 2, missing: 1, healthy: 0 }

export function statusFromFindings(findings: Finding[]): ToothStatus {
  let best: ToothStatus = 'healthy'
  for (const f of findings) {
    const s = BY_CODE.get(f.code)?.status ?? 'watch'
    if (RANK[s] > RANK[best]) best = s
  }
  return best
}

/**
 * The tooth's findings. A tooth charted before findings existed only has a
 * status (and maybe a note); that becomes one finding so nothing is lost.
 */
export function findingsOf(tooth: ToothData | undefined): Finding[] {
  if (!tooth) return []
  if (tooth.findings) return tooth.findings
  if (!tooth.status || tooth.status === 'healthy') return []
  return [{ code: tooth.status, note: tooth.note, at: '' }]
}

/** Adds a finding (replacing one with the same code) and returns the new tooth, or null for healthy. */
export function addFinding(tooth: ToothData | undefined, f: Finding): ToothData | null {
  let list = findingsOf(tooth).filter((x) => x.code !== f.code)
  // Missing means nothing else on the tooth, except what replaces it.
  if (f.code === 'missing') list = list.filter((x) => x.code === 'implant' || x.code === 'bridge')
  else if (f.code !== 'implant' && f.code !== 'bridge') list = list.filter((x) => x.code !== 'missing')
  return toTooth([...list, f], tooth?.findings ? tooth.note : undefined)
}

export function removeFinding(tooth: ToothData | undefined, code: string): ToothData | null {
  return toTooth(
    findingsOf(tooth).filter((x) => x.code !== code),
    tooth?.findings ? tooth.note : undefined
  )
}

function toTooth(findings: Finding[], note?: string): ToothData | null {
  if (findings.length === 0 && !note) return null
  return { status: statusFromFindings(findings), findings, ...(note ? { note } : {}) }
}

// ---------------------------------------------------------------------------
// Tooth names: FDI numbers and the "upper left 6" the doctor says out loud.
// ---------------------------------------------------------------------------

const QUAD_OF: Record<string, string> = { ur: '1', ul: '2', ll: '3', lr: '4' }
const QUAD_NAME: Record<string, string> = { '1': 'UR', '2': 'UL', '3': 'LL', '4': 'LR', '5': 'UR', '6': 'UL', '7': 'LL', '8': 'LR' }
const PRIMARY_LETTER = ['A', 'B', 'C', 'D', 'E']

export function isPrimary(fdi: string) {
  return Number(fdi[0]) >= 5
}

export function isValidFdi(fdi: string): boolean {
  if (!/^[1-8][1-8]$/.test(fdi)) return false
  return isPrimary(fdi) ? Number(fdi[1]) <= 5 : true
}

/** "UL6", or "ULE" for a baby tooth. */
export function palmer(fdi: string): string {
  const pos = Number(fdi[1])
  return `${QUAD_NAME[fdi[0]]}${isPrimary(fdi) ? PRIMARY_LETTER[pos - 1] : pos}`
}

function toothFrom(token: string): string | null {
  const t = token.toLowerCase()
  if (/^[1-8][1-8]$/.test(t)) return isValidFdi(t) ? t : null
  const m = /^(ur|ul|lr|ll)([1-8]|[a-e])$/.exec(t)
  if (!m) return null
  const quad = Number(QUAD_OF[m[1]])
  if (/[a-e]/.test(m[2])) return `${quad + 4}${m[2].charCodeAt(0) - 96}`
  return `${quad}${m[2]}`
}

// ---------------------------------------------------------------------------
// Typed entries
// ---------------------------------------------------------------------------

export type Entry = {
  teeth: string[]
  /** Condition codes; empty with `clear` false means "just select the tooth". */
  codes: string[]
  clear: boolean
  surfaces?: string
  note?: string
}

export type Parsed = { ok: true; entries: Entry[] } | { ok: false; error: string }

const SURFACES = /^[modblpifv]{1,5}$/

/**
 * Reads what the assistant typed. Entries are separated by commas; within one:
 * teeth first ("26", "ul6", "ul 6", several allowed), then conditions
 * ("c2", "rct"), then surfaces ("mo"), and anything left over is a note.
 * With no tooth typed, the entry applies to `selected`.
 */
export function parseEntries(input: string, selected: string | null): Parsed {
  const parts = input
    .split(/[,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return { ok: false, error: '' }

  const entries: Entry[] = []
  for (const part of parts) {
    // "ul 6" -> "ul6" so the tooth is one token.
    const tokens = part
      .toLowerCase()
      .replace(/\b(ur|ul|lr|ll)\s+([1-8a-e])\b/g, '$1$2')
      .replace(/\bclass\s+([1-6])\b/g, 'class$1')
      .split(/\s+/)
    const teeth: string[] = []
    let i = 0
    while (i < tokens.length) {
      const tooth = toothFrom(tokens[i])
      if (!tooth) break
      if (!teeth.includes(tooth)) teeth.push(tooth)
      i++
    }
    if (teeth.length === 0) {
      if (/^\d+$/.test(tokens[0]) || /^(ur|ul|lr|ll)/.test(tokens[0])) {
        return { ok: false, error: `"${tokens[0]}" is not a tooth` }
      }
      if (!selected) return { ok: false, error: 'Start with a tooth, e.g. 26 or UL6' }
      teeth.push(selected)
    }

    const codes: string[] = []
    let clear = false
    let surfaces: string | undefined
    for (; i < tokens.length; i++) {
      const t = tokens[i]
      if (CLEAR_KEYS.has(t)) {
        clear = true
        continue
      }
      // A surface string only counts once a condition has been named, so "m"
      // on its own still means missing.
      if (codes.length > 0 && !surfaces && SURFACES.test(t)) {
        surfaces = t.toUpperCase()
        continue
      }
      const c = BY_KEY.get(t)
      if (c) {
        if (!codes.includes(c.code)) codes.push(c.code)
        continue
      }
      break
    }
    const note = tokens.slice(i).join(' ').trim() || undefined
    if (codes.length === 0 && !clear && note) {
      return { ok: false, error: `Unknown condition "${tokens[i]}"` }
    }
    entries.push({ teeth, codes, clear, surfaces, note })
  }
  return { ok: true, entries }
}

/** A one-line reading of an entry, shown before Enter is pressed. */
export function describeEntry(e: Entry): string {
  const teeth = e.teeth.map((t) => `${palmer(t)} (${t})`).join(', ')
  if (e.clear) return `${teeth}: clear to healthy`
  if (e.codes.length === 0) return `${teeth}: select`
  const what = e.codes.map((c) => BY_CODE.get(c)?.label ?? c).join(' + ')
  return `${teeth}: ${what}${e.surfaces ? ` · ${e.surfaces}` : ''}${e.note ? ` · “${e.note}”` : ''}`
}
