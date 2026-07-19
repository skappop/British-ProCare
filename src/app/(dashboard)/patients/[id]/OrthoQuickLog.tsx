'use client'

import { useState } from 'react'

const WIRE_MATERIALS = ['NiTi', 'SS', 'TMA']
const WIRE_DIMENSIONS = ['014', '016', '018', '16x22', '17x25', '19x25']
const MECHANICS = ['Power Chain', 'Open Coil', 'Closed Coil', 'Laceback']
const ELASTIC_CONFIGS = ['Class II R', 'Class II L', 'Class III R', 'Class III L', 'Box', 'Triangle', 'Midline']
const ELASTIC_SIZES = ['3/16', '1/4', '5/16', '3/8']
const NEXT_VISIT_OPTIONS = [2, 3, 4, 6]

type WireArch = { material: string; dimension: string } | null

export type QuickLogData = {
  upper_wire: WireArch
  lower_wire: WireArch
  mechanics: string[]
  elastics: { config: string; size: string } | null
  next_visit_weeks: number | null
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border font-mono transition-colors ${
        active
          ? 'bg-teal text-white border-teal'
          : 'bg-white text-ink/70 border-ink/15 hover:border-teal'
      }`}
    >
      {label}
    </button>
  )
}

function WireRow({
  label,
  wire,
  onChange,
}: {
  label: string
  wire: WireArch
  onChange: (w: WireArch) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink/70">{label}</span>
        {wire && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-danger hover:underline"
          >
            No change
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {WIRE_MATERIALS.map((m) => (
          <Chip
            key={m}
            label={m}
            active={wire?.material === m}
            onClick={() => onChange({ material: m, dimension: wire?.dimension || WIRE_DIMENSIONS[1] })}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {WIRE_DIMENSIONS.map((d) => (
          <Chip
            key={d}
            label={d}
            active={wire?.dimension === d}
            onClick={() => onChange({ material: wire?.material || WIRE_MATERIALS[0], dimension: d })}
          />
        ))}
      </div>
    </div>
  )
}

export default function OrthoQuickLog({
  initial,
  onChange,
}: {
  initial: Partial<QuickLogData> | null
  onChange: (data: QuickLogData) => void
}) {
  const [upperWire, setUpperWire] = useState<WireArch>(initial?.upper_wire ?? null)
  const [lowerWire, setLowerWire] = useState<WireArch>(initial?.lower_wire ?? null)
  const [mechanics, setMechanics] = useState<string[]>(initial?.mechanics ?? [])
  const [elasticConfig, setElasticConfig] = useState<string | null>(initial?.elastics?.config ?? null)
  const [elasticSize, setElasticSize] = useState<string | null>(initial?.elastics?.size ?? null)
  const [nextVisit, setNextVisit] = useState<number | null>(initial?.next_visit_weeks ?? 4)

  function toggleMechanic(m: string) {
    const next = mechanics.includes(m) ? mechanics.filter((x) => x !== m) : [...mechanics, m]
    setMechanics(next)
    emit({ mechanics: next })
  }

  function emit(patch: Partial<QuickLogData>) {
    const data: QuickLogData = {
      upper_wire: patch.upper_wire !== undefined ? patch.upper_wire : upperWire,
      lower_wire: patch.lower_wire !== undefined ? patch.lower_wire : lowerWire,
      mechanics: patch.mechanics !== undefined ? patch.mechanics : mechanics,
      elastics:
        (patch.elastics !== undefined ? patch.elastics : elasticConfig && elasticSize
          ? { config: elasticConfig, size: elasticSize }
          : null),
      next_visit_weeks: patch.next_visit_weeks !== undefined ? patch.next_visit_weeks : nextVisit,
    }
    onChange(data)
  }

  return (
    <div className="bg-cream/50 rounded-card p-5 space-y-5">
      <div className="grid grid-cols-2 gap-6">
        <WireRow
          label="Upper Wire"
          wire={upperWire}
          onChange={(w) => {
            setUpperWire(w)
            emit({ upper_wire: w })
          }}
        />
        <WireRow
          label="Lower Wire"
          wire={lowerWire}
          onChange={(w) => {
            setLowerWire(w)
            emit({ lower_wire: w })
          }}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-ink/70">Mechanics</span>
        <div className="flex flex-wrap gap-1.5">
          {MECHANICS.map((m) => (
            <Chip key={m} label={m} active={mechanics.includes(m)} onClick={() => toggleMechanic(m)} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-ink/70">Elastics</span>
        <div className="flex flex-wrap gap-1.5">
          {ELASTIC_CONFIGS.map((c) => (
            <Chip
              key={c}
              label={c}
              active={elasticConfig === c}
              onClick={() => {
                const next = elasticConfig === c ? null : c
                setElasticConfig(next)
                emit({ elastics: next && elasticSize ? { config: next, size: elasticSize } : null })
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ELASTIC_SIZES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={elasticSize === s}
              onClick={() => {
                const next = elasticSize === s ? null : s
                setElasticSize(next)
                emit({ elastics: elasticConfig && next ? { config: elasticConfig, size: next } : null })
              }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-ink/70">Next Visit</span>
        <div className="flex gap-1.5">
          {NEXT_VISIT_OPTIONS.map((w) => (
  <Chip
    key={w}
    label={`${w} wks`}
    active={nextVisit === w}
    onClick={() => {
      const next = nextVisit === w ? null : w
      setNextVisit(next)
      emit({ next_visit_weeks: next })
    }}
  />
))}
        </div>
      </div>
    </div>
  )
}