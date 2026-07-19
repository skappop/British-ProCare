'use client'

import { useState, useRef } from 'react'
import { Baby, Check, X, Pencil, Loader2 } from 'lucide-react'
import ToothGlyph from './ToothGlyph'
import {
  toothTypeFor,
  PERMANENT_UPPER,
  PERMANENT_LOWER,
  PRIMARY_UPPER,
  PRIMARY_LOWER,
} from './toothGeometry'
import { TOOTH_STYLE, STATUS_ORDER, type ToothStatus } from './toothStatus'

export type ToothData = { status: ToothStatus; note?: string }
export type OdontogramData = Record<string, ToothData>

const QUAD: Record<string, string> = {
  '1': 'Upper right', '2': 'Upper left', '3': 'Lower left', '4': 'Lower right',
  '5': 'Upper right', '6': 'Upper left', '7': 'Lower left', '8': 'Lower right',
}
const POS_PERM: Record<string, string> = {
  '1': 'central incisor', '2': 'lateral incisor', '3': 'canine', '4': 'first premolar',
  '5': 'second premolar', '6': 'first molar', '7': 'second molar', '8': 'third molar',
}
const POS_PRIM: Record<string, string> = {
  '1': 'central incisor', '2': 'lateral incisor', '3': 'canine', '4': 'first molar', '5': 'second molar',
}
function toothName(fdi: string, primary: boolean): string {
  return `${QUAD[fdi[0]] || ''} ${(primary ? POS_PRIM : POS_PERM)[fdi[1]] || ''}`.trim()
}

type Brush = ToothStatus | 'note'

export default function DentalChart({
  initial,
  onSaveTooth,
  compact = false,
}: {
  initial: OdontogramData
  onSaveTooth: (fdi: string, status: ToothStatus, note: string) => Promise<{ ok: boolean; message?: string }>
  compact?: boolean
}) {
  const [data, setData] = useState<OdontogramData>(initial || {})
  const [primary, setPrimary] = useState(false)
  const [brush, setBrush] = useState<Brush>('treated')
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [savingFdi, setSavingFdi] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const upperCodes = primary ? PRIMARY_UPPER : PERMANENT_UPPER
  const lowerCodes = primary ? PRIMARY_LOWER : PERMANENT_LOWER
  const half = upperCodes.length / 2
  const glyphScale = primary ? 0.8 : 0.92

  function flashError(msg: string) {
    setErr(msg)
    if (errTimer.current) clearTimeout(errTimer.current)
    errTimer.current = setTimeout(() => setErr(null), 2600)
  }

  // Optimistic write — UI updates immediately, persists in the background.
  function write(fdi: string, status: ToothStatus, noteVal: string) {
    const prev = data[fdi]
    setData((d) => {
      const next = { ...d }
      if (status === 'healthy') delete next[fdi]
      else next[fdi] = { status, note: noteVal || undefined }
      return next
    })
    setSavingFdi(fdi)
    onSaveTooth(fdi, status, noteVal)
      .then((res) => {
        if (!res.ok) {
          setData((d) => {
            const n = { ...d }
            if (prev) n[fdi] = prev
            else delete n[fdi]
            return n
          })
          flashError(res.message || 'Could not save tooth')
        }
      })
      .catch(() => flashError('Could not save tooth'))
      .finally(() => setSavingFdi((s) => (s === fdi ? null : s)))
  }

  function tapTooth(fdi: string) {
    setErr(null)
    if (brush === 'note') {
      setSelected(fdi)
      setNote(data[fdi]?.note || '')
      return
    }
    write(fdi, brush, data[fdi]?.note || '')
  }

  function saveNoteEditor(status: ToothStatus) {
    if (!selected) return
    write(selected, status, note)
  }

  const brushes: { key: Brush; label: string }[] = [
    ...STATUS_ORDER.map((s) => ({ key: s as Brush, label: TOOTH_STYLE[s].label })),
    { key: 'note', label: 'Note' },
  ]

  function BrushBar() {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-ink/40 font-mono mr-0.5">Tap teeth to mark:</span>
        {brushes.map((b) => {
          const active = brush === b.key
          const st = b.key !== 'note' ? TOOTH_STYLE[b.key] : null
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setBrush(b.key)
                setSelected(null)
              }}
              className="text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 transition-all"
              style={
                active
                  ? st
                    ? { background: st.fill === 'none' ? '#EEF0F1' : st.fill, borderColor: st.stroke, color: st.stroke }
                    : { background: '#3E4C59', borderColor: '#3E4C59', color: '#fff' }
                  : { borderColor: 'rgba(62,76,89,0.15)', color: 'rgba(62,76,89,0.6)' }
              }
            >
              {b.key === 'note' ? (
                <Pencil size={11} />
              ) : (
                <span className="h-2.5 w-2.5 rounded-[2px] border" style={{ background: st!.fill === 'none' ? '#fff' : st!.fill, borderColor: st!.stroke }} />
              )}
              {b.label}
            </button>
          )
        })}
      </div>
    )
  }

  function Arch({ codes, upper }: { codes: string[]; upper: boolean }) {
    return (
      <div className="flex items-end justify-center gap-[3px] w-max mx-auto">
        {codes.map((fdi, i) => {
          const status = data[fdi]?.status || 'healthy'
          const type = toothTypeFor(fdi, primary)
          const isSel = selected === fdi
          const saving = savingFdi === fdi
          const numEl = (
            <span className={`text-[9px] font-mono leading-none ${isSel ? 'text-teal-deep font-semibold' : 'text-ink/40'}`}>
              {fdi}
            </span>
          )
          return (
            <button
              key={fdi}
              type="button"
              onClick={() => tapTooth(fdi)}
              title={data[fdi]?.note ? `${fdi} · ${data[fdi]!.note}` : `${fdi} · ${TOOTH_STYLE[status].label}`}
              style={{ marginLeft: i === half ? 14 : 0 }}
              className={`group relative flex flex-col items-center gap-1 rounded-lg px-0.5 py-1 shrink-0 transition-colors ${
                isSel ? 'bg-teal/[0.10] ring-1 ring-teal/50' : 'hover:bg-marble active:bg-cream'
              }`}
            >
              {saving && (
                <span className="absolute -top-0.5 -right-0.5 z-10">
                  <Loader2 size={10} className="animate-spin text-teal-deep" />
                </span>
              )}
              {!upper && numEl}
              <span className="transition-transform group-hover:-translate-y-0.5 group-active:scale-95">
                <ToothGlyph type={type} status={status} upper={upper} primary={primary} scale={glyphScale} />
              </span>
              {upper && numEl}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'bg-white rounded-card shadow-soft p-6'}>
      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
        {!compact && <h2 className="font-display text-lg text-ink-strong">Odontogram</h2>}
        <div className="flex items-center gap-2 ml-auto">
          {err && (
            <span className="text-[11px] text-danger inline-flex items-center gap-1">
              <X size={11} /> {err}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setPrimary((v) => !v)
              setSelected(null)
            }}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors font-mono ${
              primary ? 'bg-gold/10 text-gold-deep border-gold/40' : 'text-ink/55 border-ink/15 hover:border-gold/40 hover:text-gold-deep'
            }`}
          >
            <Baby size={12} /> {primary ? 'Primary' : 'Adult'}
          </button>
        </div>
      </div>
      {!compact && <div className="gold-hairline mb-4" />}

      <div className="mb-4">
        <BrushBar />
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex flex-col items-center gap-2 min-w-max px-1">
          <Arch codes={upperCodes} upper />
          <div className="w-full max-w-lg border-t border-dashed border-ink/12" />
          <Arch codes={lowerCodes} upper={false} />
        </div>
      </div>

      {selected && brush === 'note' && (
        <div className="border-t border-ink/8 mt-4 pt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm text-ink-strong font-medium">
                Tooth <span className="font-mono">{selected}</span>
              </p>
              <p className="text-xs text-ink/45">{toothName(selected, primary)}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-ink/40 hover:text-ink-strong p-1" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => {
              const active = (data[selected]?.status || 'healthy') === s
              const st = TOOTH_STYLE[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => saveNoteEditor(s)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5"
                  style={
                    active
                      ? { background: st.fill === 'none' ? '#F3F4F5' : st.fill, borderColor: st.stroke, color: st.stroke }
                      : { borderColor: 'rgba(62,76,89,0.15)', color: 'rgba(62,76,89,0.6)' }
                  }
                >
                  {active && <Check size={12} />}
                  {st.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note — e.g. RCT + crown, distal caries…"
              className="flex-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <button
              type="button"
              onClick={() => saveNoteEditor(data[selected]?.status || 'treated')}
              className="text-xs px-3 py-2 rounded-control bg-marble hover:bg-cream text-ink-strong transition-colors whitespace-nowrap"
            >
              Save note
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-4">
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
    </div>
  )
}
