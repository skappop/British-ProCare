'use server'

import { createClient } from '@/lib/supabase/server'

export type ReportVisit = {
  date: string
  procedures: string[]
  notes: string | null
}

export type ReportFinding = {
  fdi: string
  status: string
  note?: string
}

export type PatientReport = {
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
  visits: ReportVisit[]
  findings: ReportFinding[]
}

// Everything needed for the printable patient report. Deliberately excludes
// fees/payments — those live on the receipt.
export async function getPatientReportData(patientId: string): Promise<PatientReport | null> {
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name, file_number, phone, date_of_birth, gender, is_ortho, medical_history, odontogram')
    .eq('id', patientId)
    .single()

  if (!patient) return null

  const { data: visits } = await supabase
    .from('visits')
    .select('visit_date, notes, visit_procedures(procedures(name, code))')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })

  const reportVisits: ReportVisit[] = ((visits as any[]) || []).map((v) => ({
    date: v.visit_date,
    notes: v.notes || null,
    procedures: (v.visit_procedures || [])
      .map((vp: any) => vp.procedures?.name)
      .filter((n: any): n is string => !!n),
  }))

  const odo = (patient.odontogram as Record<string, { status: string; note?: string }>) || {}
  const findings: ReportFinding[] = Object.entries(odo)
    .filter(([, v]) => v && v.status && v.status !== 'healthy')
    .map(([fdi, v]) => ({ fdi, status: v.status, note: v.note }))
    .sort((a, b) => a.fdi.localeCompare(b.fdi))

  const mh = (patient.medical_history as any) || {}

  return {
    clinic: 'British ProCare Dental Clinics',
    generatedAt: new Date().toISOString(),
    patient: {
      full_name: patient.full_name,
      file_number: patient.file_number || null,
      phone: patient.phone || null,
      date_of_birth: patient.date_of_birth || null,
      gender: patient.gender || null,
      is_ortho: !!patient.is_ortho,
      allergies: mh.allergies || null,
      conditions: mh.conditions || null,
      medications: mh.medications || null,
      pregnant: !!mh.pregnant,
    },
    visits: reportVisits,
    findings,
  }
}
