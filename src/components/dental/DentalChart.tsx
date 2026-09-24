'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Baby, Check, CornerDownLeft, HelpCircle, Keyboard, Loader2, Undo2, X } from 'lucide-react'
import ToothGlyph from './ToothGlyph'
import { toothTypeFor, PERMANENT_UPPER, PERMANENT_LOWER, PRIMARY_UPPER, PRIMARY_LOWER } from './toothGeometry'
import { TOOTH_STYLE, STATUS_ORDER } from './toothStatus'
import {
  CONDITIONS,
  addFinding,
  condition,
  describeEntry,
  findingLabel,
  findingShort,
  findingsOf,
  isPrimary,
  palmer,
  parseEntries,
  removeFinding,
  type Finding,
  type OdontogramData,
  type ToothData,
} from './charting'

export type { OdontogramData, ToothData } from './charting'

type SaveResult = { ok: boolean; message?: string }

const POSITION: Record<string, string> = {
  '1': 'central incisor', '2': 'lateral incisor', '3': 'canine', '4': 'first premolar',
  '5': 'second premolar', '6': 'first molar', '7': 'second molar', '8': 'third molar',
}
const POSITION_PRIMARY: Record<string, string> = {
  '1': 'central incisor', '2': 'lateral incisor', '3': 'canine', '4': 'first molar', '5': 'second molar',
}
const SIDE: Record<string, string> = { U: 'Upper', L: 'Lower' }
function toothName(fdi: string) {
  const p = palmer(fdi)
  const side = `${SIDE[p[0]]} ${p[1] === 'L' ? 'left' : 'right'}`
  return `${side} ${(isPrimary(fdi) ? POSITION_PRIMARY : POSITION)[fdi[1]] ?? ''}${isPrimary(fdi) ? ' (baby)' : ''}`
}

const TONE: Record<string, string> = {
  watch: 'bg-[#F6E5E0] text-[#A4503C]',
  planned: 'bg-[#F4EBDA] text-[#8A6536]',
  treated: 'bg-[#E3F4F2] text-[#23807C]',
  missing: 'bg-ink/5 text-ink/50',
}

const PALETTE: { title: string; codes: string[] }[] = [
  { title: 'Decay & problems', codes: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'fracture', 'root', 'mobile'] },
  { title: 'Needs', codes: ['extract', 'need_rct', 'need_crown', 'need_filling'] },
  { title: 'Existing work', codes: ['filling', 'amalgam', 'rct', 'crown', 'bridge', 'implant'] },
  { title: 'Other', codes: ['missing', 'impacted', 'watch'] },
]
const SURFACE_KEYS = ['M', 'O', 'D', 'B', 'L', 'I']

// Button text: short enough that a phone fits several per row.
const BUTTON_LABEL: Record<string, string> = {
  c1: 'C1', c2: 'C2', c3: 'C3', c4: 'C4', c5: 'C5', c6: 'C6',
  fracture: 'Fracture', root: 'Root', mobile: 'Mobile',
  extract: 'Extract', need_rct: 'Needs RCT', need_crown: 'Needs crown', need_filling: 'Needs filling',
  filling: 'Filling', amalgam: 'Amalgam', rct: 'RCT done', crown: 'Crown', bridge: 'Bridge', implant: 'Implant',
  missing: 'Missing', impacted: 'Impacted', watch: 'Watch',
}

// What a phone shows first; the rest is one tap away under "More".
const COMMON = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'missing', 'filling', 'rct', 'crown', 'extract', 'fracture']

/** A mouse and keyboard, as opposed to a phone or tablet. */
function hasKeyboard() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
}

function localDay(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toDateString()
}

// ---------------------------------------------------------------------------
// Saving. Changes are queued per tooth; one request is in flight at a time and
// a failed batch is put back and retried, so fast charting never loses or
// reorders a tooth.
// ---------------------------------------------------------------------------

type SaveQueue = {
  pending: Record<string, ToothData | null>
  inFlight: boolean
  retry: ReturnType<typeof setTimeout> | null
}

function flushQueue(
  q: SaveQueue,
  save: (changes: Record<string, ToothData | null>) => Promise<SaveResult>,
  report: (state: 'saving' | 'saved' | 'error', error: string | null) => void
) {
  if (q.inFlight || Object.keys(q.pending).length === 0) return
  const batch = q.pending
  q.pending = {}
  q.inFlight = true
  report('saving', null)
  save(batch)
    .catch((): SaveResult => ({ ok: false, message: 'No connection' }))
    .then((res) => {
      q.inFlight = false
      if (res.ok) {
        if (Object.keys(q.pending).length > 0) flushQueue(q, save, report)
        else report('saved', null)
        return
      }
      // Put the batch back under anything typed since, and try again.
      q.pending = { ...batch, ...q.pending }
      report('error', res.message || 'Not saved')
      if (q.retry) clearTimeout(q.retry)
      q.retry = setTimeout(() => flushQueue(q, save, report), 3000)
    })
}

// ---------------------------------------------------------------------------
// One tooth. Memoised so a change to one tooth redraws only that tooth — the
// old chart rebuilt all 32 on every tap, which is what made it feel sluggish.
// ---------------------------------------------------------------------------

const Tooth = memo(function Tooth({
  fdi,
  tooth,
  upper,
  selected,
  scale,
  midline,
  onTap,
}: {
  fdi: string
  tooth: ToothData | undefined
  upper: boolean
  selected: boolean
  scale: number
  /** First tooth after the midline (21, 31, …). */
  midline: boolean
  onTap: (fdi: string) => void
}) {
  const primary = isPrimary(fdi)
  const status = tooth?.status || 'healthy'
  const findings = findingsOf(tooth)
  const number = (
    <span className={`text-[10px] font-mono leading-none ${selected ? 'text-teal-deep font-bold' : 'text-ink/45'}`}>
      {fdi}
    </span>
  )
  const codes = (
    <span className="flex min-h-[14px] max-w-full flex-col items-center gap-px">
      {findings.slice(0, 2).map((f) => (
        <span
          key={f.code}
          className={`max-w-full truncate rounded px-1 text-[9px] font-semibold leading-[13px] max-sm:px-0.5 max-sm:text-[8px] ${TONE[condition(f.code)?.status ?? 'watch']}`}
        >
          {findingShort(f)}
          {f.surfaces ? <span className="ml-0.5 font-normal max-sm:hidden">{f.surfaces}</span> : null}
        </span>
      ))}
      {findings.length > 2 && <span className="text-[9px] leading-none text-ink/40">+{findings.length - 2}</span>}
    </span>
  )
  return (
    <button
      type="button"
      onClick={() => onTap(fdi)}
      data-fdi={fdi}
      title={`${palmer(fdi)} · ${fdi}${findings.length ? ' — ' + findings.map(findingLabel).join(', ') : ''}`}
      className={`relative flex min-w-0 shrink-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors max-sm:w-full max-sm:px-0 ${
        midline ? 'sm:ml-[14px]' : ''
      } ${selected ? 'z-10 bg-teal/[0.14] ring-2 ring-teal' : 'hover:bg-marble active:bg-cream'}`}
    >
      {upper ? codes : number}
      <ToothGlyph
        type={toothTypeFor(fdi, primary)}
        status={status}
        upper={upper}
        primary={primary}
        scale={(primary ? 0.8 : 0.92) * scale}
        className="max-sm:h-11 max-sm:w-full"
      />
      {upper ? number : codes}
    </button>
  )
})

function Arch({
  codes,
  upper,
  data,
  selected,
  scale,
  onTap,
}: {
  codes: string[]
  upper: boolean
  data: OdontogramData
  selected: string | null
  scale: number
  onTap: (fdi: string) => void
}) {
  const half = codes.length / 2
  // One line per jaw, like the paper chart: the patient's right on the left,
  // the midline between the 1s. On a phone every tooth gets an equal share of
  // the width, so front teeth are as easy to hit as molars.
  return (
    <div
      className="relative grid w-full items-end gap-x-px sm:mx-auto sm:flex sm:w-max sm:gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${codes.length}, minmax(0, 1fr))` }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink/25 sm:hidden" />
      {codes.map((fdi, i) => (
        <Tooth
          key={fdi}
          fdi={fdi}
          tooth={data[fdi]}
          upper={upper}
          selected={selected === fdi}
          scale={scale}
          midline={i === half}
          onTap={onTap}
        />
      ))}
    </div>
  )
}

function SideLabels({ top }: { top: boolean }) {
  return (
    <div className="grid w-full grid-cols-2 text-center text-[10px] font-mono uppercase tracking-wider text-ink/40 sm:hidden">
      <span>{top ? 'Upper right' : 'Lower right'}</span>
      <span>{top ? 'Upper left' : 'Lower left'}</span>
    </div>
  )
}

/**
 * The dental chart, built for charting at the doctor's speed: type what she
 * says ("ul6 c1", "25 c2 mo", Enter) or tap a tooth and tap the finding.
 * Changes show instantly and are saved in the background, in order, one batch
 * at a time; nothing is lost if two are typed in quick succession.
 */
export default function DentalChart({
  initial,
  onSave,
  compact = false,
  large = false,
}: {
  initial: OdontogramData
  onSave: (changes: Record<string, ToothData | null>) => Promise<SaveResult>
  compact?: boolean
  /** Bigger teeth, for the phone charting page. */
  large?: boolean
}) {
  const [data, setData] = useState<OdontogramData>(initial || {})
  // Teeth changed here and not yet confirmed saved: kept when someone else's
  // charting arrives, so a live update never undoes what was just tapped.
  const [dirty, setDirty] = useState<Record<string, true>>({})
  const [seenInitial, setSeenInitial] = useState(initial)
  if (initial !== seenInitial) {
    setSeenInitial(initial)
    const merged: OdontogramData = { ...(initial || {}) }
    for (const fdi of Object.keys(dirty)) {
      if (data[fdi]) merged[fdi] = data[fdi]
      else delete merged[fdi]
    }
    setData(merged)
  }
  const [typing, setTyping] = useState(false)
  const [more, setMore] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [primary, setPrimary] = useState(() => Object.keys(initial || {}).some((k) => isPrimary(k)) && !Object.keys(initial || {}).some((k) => !isPrimary(k)))
  const [selected, setSelected] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [surfaces, setSurfaces] = useState('')
  const [toothNote, setToothNote] = useState('')
  const [help, setHelp] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  // Each step is one action (one Enter or one tap), so Undo reverses it whole.
  const [history, setHistory] = useState<{ fdi: string; before: ToothData | undefined }[][]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // ---- saving: queue changes, one request in flight, retry on failure -----
  const queue = useRef<SaveQueue>({ pending: {}, inFlight: false, retry: null })
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  const flush = useCallback(
    () =>
      flushQueue(queue.current, (changes) => onSaveRef.current(changes), (state, error) => {
        setSaveState(state)
        setSaveError(error)
        if (state === 'saved') setDirty({})
      }),
    []
  )

  useEffect(() => {
    const q = queue.current
    const warn = (e: BeforeUnloadEvent) => {
      if (q.inFlight || Object.keys(q.pending).length > 0) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      if (q.retry) clearTimeout(q.retry)
    }
  }, [])

  function commit(changes: Record<string, ToothData | null>, before: OdontogramData) {
    const next = { ...data }
    for (const [fdi, tooth] of Object.entries(changes)) {
      if (tooth) next[fdi] = tooth
      else delete next[fdi]
      queue.current.pending[fdi] = tooth
    }
    setData(next)
    setDirty((d) => ({ ...d, ...Object.fromEntries(Object.keys(changes).map((fdi) => [fdi, true as const])) }))
    setHistory((h) => [...h.slice(-49), Object.keys(changes).map((fdi) => ({ fdi, before: before[fdi] }))])
    flush()
  }

  // ---- actions --------------------------------------------------------------
  /** The teeth after applying findings, starting from `base` (so several entries chain). */
  function applyTo(
    base: OdontogramData,
    teeth: string[],
    codes: string[],
    opts: { clear?: boolean; surfaces?: string; note?: string }
  ): Record<string, ToothData | null> {
    const at = new Date().toISOString()
    const changes: Record<string, ToothData | null> = {}
    for (const fdi of teeth) {
      let tooth: ToothData | undefined = base[fdi]
      if (opts.clear) tooth = undefined
      for (const code of codes) {
        const f: Finding = { code, at, ...(opts.surfaces ? { surfaces: opts.surfaces } : {}), ...(opts.note ? { note: opts.note } : {}) }
        tooth = addFinding(tooth, f) ?? undefined
      }
      if (codes.length === 0 && opts.note && tooth) tooth = { ...tooth, note: opts.note }
      changes[fdi] = tooth ?? null
    }
    return changes
  }

  function apply(teeth: string[], codes: string[], opts: { clear?: boolean; surfaces?: string; note?: string }) {
    commit(applyTo(data, teeth, codes, opts), data)
  }

  const parsed = useMemo(() => (input.trim() ? parseEntries(input, selected) : null), [input, selected])

  function submit() {
    if (!parsed || !parsed.ok) return
    let last: string | null = null
    let working = data
    const changes: Record<string, ToothData | null> = {}
    for (const e of parsed.entries) {
      if (e.codes.length || e.clear) {
        const step = applyTo(working, e.teeth, e.codes, { clear: e.clear, surfaces: e.surfaces, note: e.note })
        Object.assign(changes, step)
        working = { ...working }
        for (const [fdi, t] of Object.entries(step)) {
          if (t) working[fdi] = t
          else delete working[fdi]
        }
      }
      last = e.teeth[e.teeth.length - 1]
    }
    if (Object.keys(changes).length) commit(changes, data)
    // Stay on the last tooth, so "c2" or "rct" next goes to the same one.
    if (last) {
      setSelected(last)
      if (isPrimary(last) !== primary) setPrimary(isPrimary(last))
    }
    setInput('')
  }

  function undoLast() {
    const step = history[history.length - 1]
    if (!step) return
    setHistory((h) => h.slice(0, -1))
    const next = { ...data }
    for (const { fdi, before } of step) {
      if (before) next[fdi] = before
      else delete next[fdi]
      queue.current.pending[fdi] = before ?? null
    }
    setData(next)
    setDirty((d) => ({ ...d, ...Object.fromEntries(step.map(({ fdi }) => [fdi, true as const])) }))
    flush()
  }

  function removeOne(fdi: string, code: string) {
    commit({ [fdi]: removeFinding(data[fdi], code) }, data)
  }

  const tapTooth = useCallback((fdi: string) => {
    setSelected((s) => (s === fdi ? null : fdi))
    setSurfaces('')
    setToothNote('')
    // Only with a real keyboard: on a phone, focusing the box would pop the
    // on-screen keyboard up over the chart at every tap.
    if (hasKeyboard()) inputRef.current?.focus({ preventScroll: true })
    // On a phone, keep the tapped tooth in view above the panel of findings.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const sheet = sheetRef.current
        const tooth = chartRef.current?.querySelector(`[data-fdi="${fdi}"]`)
        if (!sheet || !tooth || getComputedStyle(sheet).position !== 'fixed') return
        const t = tooth.getBoundingClientRect()
        const limit = sheet.getBoundingClientRect().top - 12
        if (t.bottom > limit) window.scrollBy({ top: t.bottom - limit, behavior: 'smooth' })
        else if (t.top < 8) window.scrollBy({ top: t.top - 8, behavior: 'smooth' })
      })
    )
  }, [])

  function tapCondition(code: string) {
    if (!selected) return
    apply([selected], [code], { surfaces: surfaces || undefined })
    setSurfaces('')
    if (hasKeyboard()) inputRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      if (input) setInput('')
      else setSelected(null)
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !input) {
      e.preventDefault()
      undoLast()
    }
  }

  function renderFinding(code: string) {
    if (!selected) return null
    const c = condition(code)!
    const has = findingsOf(data[selected]).some((f) => f.code === code)
    return (
      <button
        key={code}
        type="button"
        onClick={() => (has ? removeOne(selected, code) : tapCondition(code))}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-control border px-3 text-sm transition-colors sm:min-h-[36px] ${
          has ? `border-transparent font-semibold ${TONE[c.status]}` : 'border-ink/12 text-ink/75 hover:border-teal hover:bg-teal/[0.04]'
        }`}
      >
        {has && <Check size={13} />}
        {BUTTON_LABEL[code] ?? c.label}
      </button>
    )
  }

  // ---- derived --------------------------------------------------------------
  const today = new Date().toDateString()
  const todays = Object.entries(data)
    .flatMap(([fdi, t]) => (t.findings ?? []).filter((f) => f.at && localDay(f.at) === today).map((f) => ({ fdi, f })))
    .sort((a, b) => a.f.at.localeCompare(b.f.at))

  const upperCodes = primary ? PRIMARY_UPPER : PERMANENT_UPPER
  const lowerCodes = primary ? PRIMARY_LOWER : PERMANENT_LOWER
  const selectedFindings = selected ? findingsOf(data[selected]) : []
  const toothScale = large ? 1.18 : 1

  return (
    <div className={compact ? '' : 'bg-white rounded-card shadow-soft px-2.5 py-4 sm:p-6'}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {!compact && <h2 className="font-display text-lg text-ink-strong">Dental chart</h2>}
        <SaveBadge state={saveState} error={saveError} />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTyping((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors sm:hidden ${
              typing ? 'border-teal bg-teal/10 text-teal-deep' : 'border-ink/15 text-ink/55'
            }`}
          >
            <Keyboard size={12} /> Type
          </button>
          <button
            type="button"
            onClick={() => setHelp((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              help ? 'border-teal bg-teal/10 text-teal-deep' : 'border-ink/15 text-ink/55 hover:text-teal-deep'
            }`}
          >
            <HelpCircle size={12} /> Codes
          </button>
          <button
            type="button"
            onClick={() => {
              setPrimary((v) => !v)
              setSelected(null)
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              primary ? 'border-gold/40 bg-gold/10 text-gold-deep' : 'border-ink/15 text-ink/55 hover:border-gold/40 hover:text-gold-deep'
            }`}
          >
            <Baby size={12} /> {primary ? 'Baby teeth' : 'Adult'}
          </button>
        </div>
      </div>

      {/* Quick entry: the fast way, typed as the doctor dictates. */}
      {/* On a phone it is tucked away (tap "Type" to show it): tapping teeth is
          the quicker way there. */}
      <div className={`rounded-control border-2 border-teal/30 bg-teal/[0.03] p-2 focus-within:border-teal ${typing ? '' : 'hidden sm:block'}`}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={selected ? `${palmer(selected)} selected — type c1, rct, f… or another tooth` : 'Type as the doctor speaks: ul6 c1  ·  25 c2 mo  ·  36 m  — then Enter'}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-base text-ink-strong placeholder:font-sans placeholder:text-sm placeholder:text-ink/40 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Quick charting entry"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!parsed?.ok}
            className="inline-flex items-center gap-1 rounded-control bg-teal px-3 py-2 text-sm text-white hover:bg-teal-deep disabled:bg-ink/15"
          >
            <CornerDownLeft size={14} /> Add
          </button>
        </div>
        <p className={`min-h-[20px] px-2 pt-1 text-xs ${parsed && !parsed.ok ? 'text-danger' : 'text-teal-deep'}`}>
          {parsed ? (parsed.ok ? parsed.entries.map(describeEntry).join('  ·  ') : parsed.error) : ''}
        </p>
      </div>

      {help && <CodeSheet />}

      <div ref={chartRef} className="mt-4 overflow-x-auto pb-1">
        <div className="flex flex-col items-center gap-2 px-1 max-sm:px-0">
          <SideLabels top />
          <Arch codes={upperCodes} upper data={data} selected={selected} scale={toothScale} onTap={tapTooth} />
          <div className="w-full max-w-lg border-t border-dashed border-ink/20 max-sm:max-w-none" />
          <Arch codes={lowerCodes} upper={false} data={data} selected={selected} scale={toothScale} onTap={tapTooth} />
          <SideLabels top={false} />
        </div>
      </div>

      {/* Tap-to-chart: shown for the selected tooth. */}
      {/* On a phone the finding buttons sit in a panel along the bottom of the
          screen, so the chart stays in view and the next tooth is one tap away. */}
      {selected && (
        <div ref={sheetRef} className="fixed inset-x-0 bottom-0 z-40 max-h-[52vh] space-y-2.5 overflow-y-auto rounded-t-2xl border-t border-teal/30 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.14)] sm:static sm:z-auto sm:mt-4 sm:max-h-none sm:space-y-3 sm:overflow-visible sm:rounded-control sm:border sm:p-3 sm:shadow-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-ink-strong">
              {palmer(selected)} <span className="font-mono font-normal text-ink/45">· {selected}</span>
            </p>
            <p className="text-xs text-ink/50">{toothName(selected)}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedFindings.map((f) => (
                <span
                  key={f.code}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${TONE[condition(f.code)?.status ?? 'watch']}`}
                >
                  {findingLabel(f)}
                  <button type="button" onClick={() => removeOne(selected, f.code)} aria-label="Remove" className="opacity-60 hover:opacity-100">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto rounded-control px-3 py-1.5 text-sm font-medium text-teal-deep hover:bg-teal/10 sm:p-1 sm:text-ink/40"
              title="Close"
            >
              <span className="sm:hidden">Done</span>
              <X size={16} className="hidden sm:block" aria-hidden />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-ink/40">Surf.</span>
            {SURFACE_KEYS.map((s) => {
              const on = surfaces.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSurfaces((v) => (on ? v.replace(s, '') : v + s))}
                  className={`h-9 w-9 rounded-control border text-xs font-semibold transition-colors sm:h-8 sm:w-8 ${
                    on ? 'border-teal bg-teal text-white' : 'border-ink/15 text-ink/60 hover:border-teal'
                  }`}
                >
                  {s}
                </button>
              )
            })}
            <span className="hidden text-[11px] text-ink/40 sm:inline">optional, then tap the finding</span>
          </div>

          {/* Phone: the common findings first, everything else under More. */}
          {!more && (
            <div className="flex flex-wrap gap-1.5 sm:hidden">
              {COMMON.map((code) => renderFinding(code))}
              <button
                type="button"
                onClick={() => setMore(true)}
                className="inline-flex min-h-[40px] items-center rounded-control px-3 text-sm text-teal-deep"
              >
                More…
              </button>
            </div>
          )}
          <div className={`space-y-2.5 sm:space-y-3 ${more ? '' : 'hidden sm:block'}`}>
          {PALETTE.map((group) => (
            <div key={group.title} className="flex flex-wrap items-center gap-1.5">
              <span className="hidden text-[10px] font-mono uppercase tracking-wider text-ink/40 sm:inline-block sm:w-28">{group.title}</span>
              {group.codes.map((code) => renderFinding(code))}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <input
              value={toothNote}
              onChange={(e) => setToothNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && toothNote.trim()) {
                  apply([selected], [], { note: toothNote.trim() })
                  setToothNote('')
                }
              }}
              placeholder="Note for this tooth (Enter to save)"
              className="min-w-0 flex-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <button
              type="button"
              onClick={() => apply([selected], [], { clear: true })}
              className="rounded-control px-3 py-2 text-xs text-ink/50 hover:bg-danger/10 hover:text-danger"
            >
              Clear tooth
            </button>
          </div>
          </div>
          {data[selected]?.note && <p className="text-xs text-ink/55">Note: {data[selected]!.note}</p>}
        </div>
      )}

      {/* Today's findings: the paper chart's list, in the order they were said. */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink/45">
            Charted today {todays.length > 0 && `· ${todays.length}`}
          </span>
          {history.length > 0 && (
            <button type="button" onClick={undoLast} className="inline-flex items-center gap-1 text-xs text-ink/50 hover:text-teal-deep">
              <Undo2 size={12} /> Undo last <span className="hidden font-mono text-[10px] sm:inline">(Ctrl+Z)</span>
            </button>
          )}
        </div>
        {todays.length === 0 ? (
          <p className="text-xs text-ink/35">Nothing yet.</p>
        ) : (
          <ol className="grid gap-1 sm:grid-cols-2">
            {todays.map(({ fdi, f }) => (
              <li key={`${fdi}-${f.code}`} className="flex items-center gap-2 rounded-control bg-marble/60 px-2.5 py-1.5 text-sm">
                <button type="button" onClick={() => tapTooth(fdi)} className="font-semibold text-ink-strong hover:text-teal-deep">
                  {palmer(fdi)}
                </button>
                <span className="font-mono text-[11px] text-ink/40">{fdi}</span>
                <span className="min-w-0 flex-1 truncate text-ink/75">{findingLabel(f)}</span>
                <button type="button" onClick={() => removeOne(fdi, f.code)} className="text-ink/30 hover:text-danger" aria-label="Remove">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((s) => {
          const st = TOOTH_STYLE[s]
          return (
            <span key={s} className="inline-flex items-center gap-1.5 text-[10px] text-ink/55">
              <span className="h-3 w-3 rounded-[3px] border" style={{ background: st.fill === 'none' ? '#fff' : st.fill, borderColor: st.stroke }} />
              {st.label}
            </span>
          )
        })}
      </div>
      {selected && <div className="h-[52vh] sm:hidden" aria-hidden />}
    </div>
  )
}

function SaveBadge({ state, error }: { state: 'idle' | 'saving' | 'saved' | 'error'; error: string | null }) {
  if (state === 'idle') return null
  if (state === 'saving')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ink/45">
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    )
  if (state === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success">
        <Check size={11} /> Saved
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger" title={error ?? undefined}>
      <Loader2 size={11} className="animate-spin" /> Not saved yet — retrying
    </span>
  )
}

function CodeSheet() {
  const groups: { title: string; status: string }[] = [
    { title: 'Decay & problems', status: 'watch' },
    { title: 'Needs', status: 'planned' },
    { title: 'Existing work', status: 'treated' },
    { title: 'Other', status: 'missing' },
  ]
  return (
    <div className="mt-3 space-y-3 rounded-control bg-marble/60 p-3 text-xs text-ink/70">
      <p>
        <span className="font-semibold text-ink-strong">Teeth:</span> FDI <code className="font-mono">26</code> or{' '}
        <code className="font-mono">ul6</code> (upper left 6). Baby teeth <code className="font-mono">ule</code> or{' '}
        <code className="font-mono">65</code>. Several at once: <code className="font-mono">16 26 36 46 f</code>.
        Several entries: separate with commas. Surfaces after the finding: <code className="font-mono">25 c2 mo</code>.
        Anything after that is a note. <code className="font-mono">26 ok</code> clears a tooth.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1 font-semibold text-ink-strong">{g.title}</p>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS.filter((c) => (g.status === 'missing' ? ['missing', 'impacted', 'watch'].includes(c.code) : c.status === g.status && !['impacted', 'watch'].includes(c.code))).map((c) => (
                <span key={c.code} className="rounded bg-white px-1.5 py-0.5">
                  <code className="font-mono font-semibold text-teal-deep">{c.keys[0]}</code> {c.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
