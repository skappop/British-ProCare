'use client'

import { useState } from 'react'

const WIRES = ['Changed', 'Retained', 'Adjusted']
const MATERIALS = ['NiTi', 'SS', 'TMA']
const SIZES = ['014', '016', '018', '16x22', '17x25', '19x25']
const MECHANICS = ['Power Chain', 'Open Coil', 'Closed Coil', 'Laceback', 'Cinch Back', 'Bite Turbos', 'Koby Hooks', 'Fig-8 Ligation', 'Piggy back']
const POSITIONS = ['Upper R', 'Upper L', 'Lower R', 'Lower L']
const VECTORS = ['Class II R', 'Class II L', 'Class III R', 'Class III L', 'Box', 'Triangle', 'Midline']
const ELASTIC_SIZES = ['1/8', '3/16', '1/4', '5/16', '3/8']
const FORCES = ['3.5 oz', '5.0 oz', '6.5 oz']
const TAD_LOCATIONS = ['Infrazygomatic', 'Interradicular', 'Palatal', 'Buccal Shelf']
const TAD_SIZES = ['1.6x8', '1.6x10', '2.0x10', '2.0x12']
const REPAIRS = ['Loose Bracket', 'Re-bonded', 'Poking Wire Clipped']
const NEXT = [2, 3, 4, 6, 8]

export type WireLog = { action: string; material: string; size: string } | null
export type MechanicLog = { type: string; position?: string }
export type OrthoLogData = {
  upper_wire: WireLog
  lower_wire: WireLog
  mechanics: MechanicLog[]
  elastics: { vector: string; size: string; force: string }[]
  tads: { location: string; size: string }[]
  maintenance: string[]
  hygiene: string | null
  elastic_compliance: string | null
  next_visit_weeks: number | null
}
export type QuickLogData = OrthoLogData

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? 'border-teal bg-teal text-white' : 'border-ink/15 bg-white text-ink/70 hover:border-teal'}`}>{label}</button>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="space-y-2"><span className="text-sm text-ink/70">{title}</span>{children}</div> }

function WireRow({ label, value, onChange }: { label: string; value: WireLog; onChange: (value: WireLog) => void }) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm text-ink/70">{label}</span><button type="button" onClick={() => onChange(null)} className="text-xs text-ink/40 hover:text-danger">Clear</button></div><div className="flex flex-wrap gap-1.5">{WIRES.map((action) => <Chip key={action} label={action} active={value?.action === action} onClick={() => onChange({ action, material: value?.material || MATERIALS[0], size: value?.size || SIZES[1] })} />)}</div><div className="flex flex-wrap gap-1.5">{MATERIALS.map((material) => <Chip key={material} label={material} active={value?.material === material} onClick={() => onChange({ action: value?.action || WIRES[0], material, size: value?.size || SIZES[1] })} />)}{SIZES.map((size) => <Chip key={size} label={size} active={value?.size === size} onClick={() => onChange({ action: value?.action || WIRES[0], material: value?.material || MATERIALS[0], size })} />)}</div></div>
}

export default function OrthoQuickLog({ initial, onChange }: { initial: Partial<OrthoLogData> | null; onChange: (data: OrthoLogData) => void }) {
  const [data, setData] = useState<OrthoLogData>({
    upper_wire: initial?.upper_wire ?? null,
    lower_wire: initial?.lower_wire ?? null,
    mechanics: Array.isArray(initial?.mechanics) ? initial!.mechanics.map((m) => typeof m === 'string' ? { type: m } : m) : [],
    elastics: initial?.elastics ?? [],
    tads: initial?.tads ?? [],
    maintenance: initial?.maintenance ?? [],
    hygiene: initial?.hygiene ?? null,
    elastic_compliance: initial?.elastic_compliance ?? null,
    next_visit_weeks: initial?.next_visit_weeks ?? 4,
  })

  function patch(next: Partial<OrthoLogData>) { const value = { ...data, ...next }; setData(value); onChange(value) }
  function toggleRepair(value: string) { patch({ maintenance: data.maintenance.includes(value) ? data.maintenance.filter((x) => x !== value) : [...data.maintenance, value] }) }
  function toggleMechanic(type: string) { const exists = data.mechanics.some((m) => m.type === type); patch({ mechanics: exists ? data.mechanics.filter((m) => m.type !== type) : [...data.mechanics, { type, ...(type === 'Piggy back' ? { position: POSITIONS[0] } : {}) }] }) }

  return <div className="space-y-5 rounded-card bg-cream/50 p-5">
    <div className="grid gap-5 sm:grid-cols-2"><WireRow label="Upper wire" value={data.upper_wire} onChange={(upper_wire) => patch({ upper_wire })} /><WireRow label="Lower wire" value={data.lower_wire} onChange={(lower_wire) => patch({ lower_wire })} /></div>
    <Section title="Mechanics · choose all that apply"><div className="flex flex-wrap gap-1.5">{MECHANICS.map((type) => <Chip key={type} label={type} active={data.mechanics.some((m) => m.type === type)} onClick={() => toggleMechanic(type)} />)}</div>{data.mechanics.filter((m) => m.type === 'Piggy back').map((m) => <div key="piggy" className="flex flex-wrap items-center gap-1.5 text-xs text-ink/55"><span>Piggy back position</span>{POSITIONS.map((position) => <Chip key={position} label={position} active={m.position === position} onClick={() => patch({ mechanics: data.mechanics.map((x) => x.type === 'Piggy back' ? { ...x, position } : x) })} />)}</div>)}</Section>
    <Section title="Elastics"><div className="flex flex-wrap gap-1.5">{VECTORS.map((vector) => <Chip key={vector} label={vector} active={data.elastics.some((e) => e.vector === vector)} onClick={() => { const found = data.elastics.find((e) => e.vector === vector); patch({ elastics: found ? data.elastics.filter((e) => e.vector !== vector) : [...data.elastics, { vector, size: ELASTIC_SIZES[1], force: FORCES[1] }] }) }} />)}</div>{data.elastics.map((elastic) => <div key={elastic.vector} className="flex flex-wrap items-center gap-1.5 rounded-control bg-white/70 p-2 text-xs"><span className="font-medium text-ink-strong">{elastic.vector}</span>{ELASTIC_SIZES.map((size) => <Chip key={size} label={size} active={elastic.size === size} onClick={() => patch({ elastics: data.elastics.map((e) => e.vector === elastic.vector ? { ...e, size } : e) })} />)}{FORCES.map((force) => <Chip key={force} label={force} active={elastic.force === force} onClick={() => patch({ elastics: data.elastics.map((e) => e.vector === elastic.vector ? { ...e, force } : e) })} />)}</div>)}</Section>
    <Section title="TADs"><div className="flex flex-wrap gap-1.5">{TAD_LOCATIONS.map((location) => <Chip key={location} label={location} active={data.tads.some((t) => t.location === location)} onClick={() => { const found = data.tads.find((t) => t.location === location); patch({ tads: found ? data.tads.filter((t) => t.location !== location) : [...data.tads, { location, size: TAD_SIZES[0] }] }) }} />)}</div>{data.tads.map((tad) => <div key={tad.location} className="flex flex-wrap items-center gap-1.5 rounded-control bg-white/70 p-2 text-xs"><span className="font-medium text-ink-strong">{tad.location}</span>{TAD_SIZES.map((size) => <Chip key={size} label={size} active={tad.size === size} onClick={() => patch({ tads: data.tads.map((t) => t.location === tad.location ? { ...t, size } : t) })} />)}</div>)}</Section>
    <Section title="Maintenance / repairs"><div className="flex flex-wrap gap-1.5">{REPAIRS.map((repair) => <Chip key={repair} label={repair} active={data.maintenance.includes(repair)} onClick={() => toggleRepair(repair)} />)}</div></Section>
    <div className="grid gap-5 sm:grid-cols-2"><Section title="Patient hygiene"><div className="flex flex-wrap gap-1.5">{['Good', 'Fair', 'Poor'].map((value) => <Chip key={value} label={value} active={data.hygiene === value} onClick={() => patch({ hygiene: data.hygiene === value ? null : value })} />)}</div></Section><Section title="Elastic compliance"><div className="flex flex-wrap gap-1.5">{['Compliant', 'Non-Compliant'].map((value) => <Chip key={value} label={value} active={data.elastic_compliance === value} onClick={() => patch({ elastic_compliance: data.elastic_compliance === value ? null : value })} />)}</div></Section></div>
    <Section title="Next visit"><div className="flex flex-wrap gap-1.5">{NEXT.map((weeks) => <Chip key={weeks} label={`${weeks} weeks`} active={data.next_visit_weeks === weeks} onClick={() => patch({ next_visit_weeks: data.next_visit_weeks === weeks ? null : weeks })} />)}</div></Section>
  </div>
}
