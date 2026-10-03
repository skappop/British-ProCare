'use client'

import DentalChart, { type OdontogramData } from '@/components/dental/DentalChart'
import { saveTeeth } from './odontogramActions'
import ClinicalTaskPanel from './ClinicalTaskPanel'
import type { ClinicalTask } from '@/lib/clinicalTasks'
import type { ClinicalTaskCategory } from '@/lib/clinicalTasks'
import type { Finding } from '@/components/dental/charting'
import { useState } from 'react'

// Thin wrapper: the chart lives in @/components/dental so the reception
// walk-in panel can reuse it. Saves only the teeth that changed.
export default function Odontogram({
  patientId,
  initialOdontogram,
  initialTasks,
  large = false,
}: {
  patientId: string
  initialOdontogram: OdontogramData
  initialTasks?: ClinicalTask[]
  large?: boolean
}) {
  const [plannedTooth, setPlannedTooth] = useState<string | null>(null)
  const [plannedCategory, setPlannedCategory] = useState<ClinicalTaskCategory | null>(null)
  function planFromChart(fdi: string, findings: Finding[]) {
    const codes = findings.map((finding) => finding.code)
    const category: ClinicalTaskCategory = codes.includes('need_rct')
      ? 'endo'
      : codes.includes('need_crown')
        ? 'prosthetic'
        : codes.includes('extract') || codes.includes('impacted')
          ? 'surgical'
          : 'restorative'
    setPlannedTooth(fdi)
    setPlannedCategory(category)
  }
  return (
    <div className="space-y-4">
      <ClinicalTaskPanel
        patientId={patientId}
        initialTasks={initialTasks || []}
        plannedTooth={plannedTooth}
        plannedCategory={plannedCategory || undefined}
        onClearPlannedTooth={() => { setPlannedTooth(null); setPlannedCategory(null) }}
      />
      <DentalChart
        initial={initialOdontogram || {}}
        large={large}
        onSave={(changes) => saveTeeth(patientId, changes)}
        onPlanTreatment={planFromChart}
      />
    </div>
  )
}
