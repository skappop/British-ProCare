'use client'

import DentalChart, { type OdontogramData } from '@/components/dental/DentalChart'
import { saveTeeth } from './odontogramActions'

// Thin wrapper: the chart lives in @/components/dental so the reception
// walk-in panel can reuse it. Saves only the teeth that changed.
export default function Odontogram({
  patientId,
  initialOdontogram,
}: {
  patientId: string
  initialOdontogram: OdontogramData
}) {
  return <DentalChart initial={initialOdontogram || {}} onSave={(changes) => saveTeeth(patientId, changes)} />
}
