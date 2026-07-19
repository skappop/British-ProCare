// Shared types for the guided Walk-In (reception) flow.
// This flow orchestrates existing clinic features — it does not replace them.

export type ReceptionPatient = {
  id: string
  full_name: string
  phone: string | null
  file_number: string | null
  is_ortho: boolean
}

export type Procedure = {
  id: string
  code: string
  name: string
  base_fee: number | null
  category: string
}

export type TodayAppointment = {
  id: string
  scheduled_at: string
  status: string
  patient: ReceptionPatient | null
}

export type MedicalHistory = {
  allergies?: string | null
  conditions?: string | null
  medications?: string | null
  pregnant?: boolean
  notes?: string | null
}

export type PatientSafety = {
  medical_history: MedicalHistory | null
  consent_signed_at: string | null
  is_ortho: boolean
}

// What the flow keeps in view once a visit is saved.
export type SavedVisit = {
  id: string
  fee: number | null
  procedures: string[]
}

export type PaymentSummary = {
  amount: number
  method: string
}

// Safety flags surfaced as a persistent banner from the History step onward.
export type SafetyAlerts = {
  allergies?: string | null
  conditions?: string | null
  pregnant?: boolean
}

export const STEPS = [
  { key: 'identify', label: 'Patient', hint: 'Who walked in' },
  { key: 'safety', label: 'History', hint: 'Allergies & consent' },
  { key: 'visit', label: 'Treatment', hint: "Today's work" },
  { key: 'payment', label: 'Payment', hint: 'Collect & receipt' },
  { key: 'done', label: 'Done', hint: 'Wrap up' },
] as const

export type StepKey = (typeof STEPS)[number]['key']

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'installment', label: 'Installment' },
  { value: 'other', label: 'Other' },
]
