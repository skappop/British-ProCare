'use client'

export type LogCategory = 'restorative' | 'endo' | 'surgical' | 'prosthetic'
export type ClinicalLogValue = string | string[]
export type StructuredClinicalLog = Record<string, ClinicalLogValue>

type Group = { key: string; label: string; options: string[]; multiple?: boolean }

const CONFIG: Record<LogCategory, { title: string; description: string; textFields: { key: string; label: string; placeholder: string }[]; groups: Group[] }> = {
  restorative: {
    title: 'Restorative log',
    description: 'Record the tooth, surfaces, material and finishing details for a restoration.',
    textFields: [{ key: 'tooth', label: 'Tooth / teeth', placeholder: 'e.g. 26 or 14, 15' }, { key: 'shade', label: 'Shade', placeholder: 'e.g. A2' }],
    groups: [
      { key: 'surfaces', label: 'Surfaces', options: ['O', 'M', 'D', 'B', 'L', 'MO', 'DO', 'MOD'], multiple: true },
      { key: 'material', label: 'Material', options: ['Composite', 'Amalgam', 'Glass ionomer', 'Ceramic / inlay', 'Temporary'] },
      { key: 'isolation', label: 'Isolation', options: ['Rubber dam', 'Cotton roll', 'Isolite', 'None'] },
      { key: 'liner', label: 'Liner / base', options: ['None', 'Calcium hydroxide', 'Glass ionomer', 'Bonding only'] },
      { key: 'matrix', label: 'Matrix / contact', options: ['Sectional matrix', 'Tofflemire', 'Mylar strip', 'No matrix'] },
      { key: 'occlusion', label: 'Occlusion', options: ['Adjusted', 'Checked - satisfactory', 'Not checked'] },
    ],
  },
  endo: {
    title: 'Endodontic log',
    description: 'Capture the diagnosis, working length, irrigation, obturation and next endodontic step.',
    textFields: [{ key: 'tooth', label: 'Tooth', placeholder: 'e.g. 36' }, { key: 'working_length', label: 'Working length', placeholder: 'e.g. MB 20 mm, ML 20 mm' }],
    groups: [
      { key: 'diagnosis', label: 'Diagnosis', options: ['Reversible pulpitis', 'Irreversible pulpitis', 'Pulp necrosis', 'Previously treated', 'Apical periodontitis', 'Abscess'] },
      { key: 'vitality', label: 'Pre-op vitality', options: ['Positive', 'Negative', 'Not tested'] },
      { key: 'isolation', label: 'Isolation', options: ['Rubber dam', 'Cotton roll', 'Not possible'] },
      { key: 'irrigation', label: 'Irrigation', options: ['NaOCl', 'CHX', 'EDTA', 'Saline', 'Other'] },
      { key: 'instrumentation', label: 'Instrumentation', options: ['Hand files', 'Rotary', 'Reciprocating', 'Retreatment'] },
      { key: 'obturation', label: 'Obturation', options: ['Not yet', 'Cold lateral', 'Warm vertical', 'Single cone', 'Temporary dressing'] },
      { key: 'temporary', label: 'Temporary seal', options: ['Cavit', 'IRM', 'Glass ionomer', 'None'] },
    ],
  },
  surgical: {
    title: 'Surgical log',
    description: 'Record the site, procedure, anaesthesia, closure and post-operative instructions.',
    textFields: [{ key: 'site', label: 'Tooth / site', placeholder: 'e.g. 48 or upper right mucosa' }, { key: 'specimen', label: 'Specimen / referral', placeholder: 'Optional details' }],
    groups: [
      { key: 'procedure', label: 'Procedure', options: ['Simple extraction', 'Surgical extraction', 'Incision and drainage', 'Frenectomy', 'Biopsy', 'Implant procedure', 'Other'] },
      { key: 'anaesthesia', label: 'Anaesthesia', options: ['Local infiltration', 'Nerve block', 'Local + sedation', 'General anaesthesia', 'None'] },
      { key: 'flap', label: 'Flap / bone', options: ['No flap', 'Full thickness flap', 'Osteotomy', 'Odontotomy', 'Alveoloplasty'] },
      { key: 'closure', label: 'Closure', options: ['No sutures', 'Simple interrupted', 'Figure eight', 'Resorbable', 'Non-resorbable'] },
      { key: 'haemostasis', label: 'Haemostasis', options: ['Routine', 'Surgicel', 'Collagen plug', 'Suture pressure'] },
      { key: 'instructions', label: 'Post-op instructions', options: ['Written instructions', 'Medication prescribed', 'Ice / pressure explained', 'Emergency contact explained'], multiple: true },
    ],
  },
  prosthetic: {
    title: 'Prosthetic log',
    description: 'Track preparation, impressions, shade, laboratory work and delivery details.',
    textFields: [{ key: 'teeth', label: 'Tooth / unit(s)', placeholder: 'e.g. 11-13 or lower partial' }, { key: 'shade', label: 'Shade', placeholder: 'e.g. A2 / BL2' }, { key: 'lab', label: 'Laboratory', placeholder: 'Optional lab name' }],
    groups: [
      { key: 'restoration', label: 'Restoration', options: ['Crown - PFM', 'Crown - zirconia', 'Crown - lithium disilicate', 'Bridge', 'Veneer', 'Complete denture', 'Partial denture', 'Temporary'] },
      { key: 'stage', label: 'Stage', options: ['Consultation', 'Preparation', 'Impression / scan', 'Try-in', 'Cementation / delivery', 'Adjustment / repair'] },
      { key: 'preparation', label: 'Preparation', options: ['No preparation', 'Tooth prepared', 'Core build-up', 'Post placed', 'Existing restoration removed'] },
      { key: 'impression', label: 'Impression / scan', options: ['Digital scan', 'PVS impression', 'Alginate', 'Bite record', 'Not taken'] },
      { key: 'occlusion', label: 'Occlusion', options: ['Checked', 'Adjusted', 'Not checked'] },
      { key: 'cement', label: 'Cement / delivery', options: ['Temporary cement', 'Resin cement', 'Glass ionomer', 'Not delivered'] },
    ],
  },
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? 'border-teal bg-teal text-white' : 'border-ink/15 bg-white text-ink/70 hover:border-teal'}`}>{label}</button>
}

function selected(value: ClinicalLogValue | undefined, option: string) {
  return Array.isArray(value) ? value.includes(option) : value === option
}

export default function StructuredTreatmentLog({ category, initial, onChange }: { category: LogCategory; initial?: StructuredClinicalLog; onChange: (value: StructuredClinicalLog) => void }) {
  const config = CONFIG[category]
  const value = initial || {}

  function setField(key: string, next: ClinicalLogValue) {
    onChange({ ...value, [key]: next })
  }

  function toggle(group: Group, option: string) {
    if (group.multiple) {
      const current = Array.isArray(value[group.key]) ? value[group.key] as string[] : []
      setField(group.key, current.includes(option) ? current.filter((item) => item !== option) : [...current, option])
      return
    }
    setField(group.key, value[group.key] === option ? '' : option)
  }

  return (
    <div className="space-y-5 bg-cream/50 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {config.textFields.map((field) => <label key={field.key} className="space-y-1.5 text-sm text-ink/70"><span>{field.label}</span><input value={typeof value[field.key] === 'string' ? value[field.key] as string : ''} onChange={(e) => setField(field.key, e.target.value)} placeholder={field.placeholder} className="w-full rounded-control border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" /></label>)}
      </div>
      {config.groups.map((group) => <div key={group.key} className="space-y-2"><span className="block text-sm text-ink/70">{group.label}{group.multiple ? ' - choose all that apply' : ''}</span><div className="flex flex-wrap gap-1.5">{group.options.map((option) => <Chip key={option} label={option} active={selected(value[group.key], option)} onClick={() => toggle(group, option)} />)}</div></div>)}
      <label className="block space-y-1.5 text-sm text-ink/70"><span>Clinical details</span><textarea value={typeof value.notes === 'string' ? value.notes : ''} onChange={(e) => setField('notes', e.target.value)} rows={3} placeholder="Add anything specific another clinician should know…" className="block w-full resize-y rounded-control border border-ink/15 bg-white px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-teal" /></label>
    </div>
  )
}
