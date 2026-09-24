'use server'

import { findingLabel, palmer, type OdontogramData } from '@/components/dental/charting'
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

export type ReportImage = {
  id: string
  url: string | null
  filename: string
  category: 'radiograph' | 'intraoral' | 'document' | string
  image_type: string
  taken_at: string
  is_baseline: boolean
  notes: string | null
}

export type ReportPlan = {
  status: string
  started_at: string | null
  notes: string | null
  phases: { name: string; status: string; planned_weeks: number | null; start: string | null; end: string | null }[]
}

export type ReportLab = {
  case_type: string
  lab_name: string | null
  sent_at: string | null
  due_at: string | null
  status: string
  notes: string | null
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
    health_note: string | null
  }
  visits: ReportVisit[]
  findings: ReportFinding[]
  plan: ReportPlan | null
  labs: ReportLab[]
  images: ReportImage[]
  /** Set when the image list itself could not be read. */
  imagesError: string | null
  nextVisit: string | null
}

type Joined<T> = T | T[] | null | undefined
const one = <T,>(v: Joined<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/**
 * Everything for the printable patient report. Deliberately no fees or
 * payments: this is a clinical record, handed to patients and other dentists.
 * Images come as short-lived signed links; the browser downloads and shrinks
 * them before they go into the PDF.
 */
export async function getPatientReportData(patientId: string): Promise<PatientReport | null> {
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name, file_number, phone, date_of_birth, gender, is_ortho, medical_history, odontogram')
    .eq('id', patientId)
    .single()

  if (!patient) return null

  const [visitsRes, planRes, labsRes, imagesRes, nextRes] = await Promise.all([
    supabase
      .from('visits')
      .select('visit_date, notes, visit_procedures(procedures(name))')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false }),
    supabase
      .from('treatment_plans')
      .select('status, started_at, notes, treatment_plan_phases(name, status, planned_weeks, actual_start_date, actual_end_date, order_index)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lab_cases')
      .select('case_type, lab_name, sent_at, due_at, status, notes')
      .eq('patient_id', patientId)
      .order('sent_at', { ascending: false }),
    supabase
      .from('image_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('taken_at', { ascending: true }),
    supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('patient_id', patientId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  type VisitRow = { visit_date: string; notes: string | null; visit_procedures: { procedures: Joined<{ name: string }> }[] | null }
  const visits: ReportVisit[] = ((visitsRes.data ?? []) as unknown as VisitRow[]).map((v) => ({
    date: v.visit_date,
    notes: v.notes || null,
    procedures: (v.visit_procedures ?? []).map((vp) => one(vp.procedures)?.name).filter((n): n is string => !!n),
  }))

  const odo = (patient.odontogram as OdontogramData) || {}
  const findings: ReportFinding[] = Object.entries(odo)
    .filter(([, v]) => v && v.status && (v.status !== 'healthy' || v.note))
    .map(([fdi, v]) => ({
      fdi: `${fdi} (${palmer(fdi)})`,
      status: v.status,
      // What was charted, e.g. "Caries Class II (MO), Root canal treated".
      note: [v.findings?.length ? v.findings.map(findingLabel).join(', ') : '', v.note ?? '']
        .filter(Boolean)
        .join(' — ') || undefined,
    }))
    .sort((a, b) => a.fdi.localeCompare(b.fdi, undefined, { numeric: true }))

  type PlanRow = {
    status: string; started_at: string | null; notes: string | null
    treatment_plan_phases: { name: string; status: string; planned_weeks: number | null; actual_start_date: string | null; actual_end_date: string | null; order_index: number }[] | null
  }
  const planRow = planRes.data as unknown as PlanRow | null
  const plan: ReportPlan | null = planRow
    ? {
        status: planRow.status,
        started_at: planRow.started_at,
        notes: planRow.notes,
        phases: [...(planRow.treatment_plan_phases ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((p) => ({ name: p.name, status: p.status, planned_weeks: p.planned_weeks, start: p.actual_start_date, end: p.actual_end_date })),
      }
    : null

  type ImageRow = {
    id: string; storage_path: string; category: string | null; image_type: string; taken_at: string
    is_baseline: boolean | null; notes: string | null; metadata: { original_filename?: string } | null
  }
  if (imagesRes.error) console.error('report: image list failed', imagesRes.error.message)
  const imageRows = (imagesRes.data ?? []) as unknown as ImageRow[]
  // One link per file, the same way the gallery gets its (working) links; a
  // batch request matched back by path could silently leave images out.
  const bucket = supabase.storage.from('patient-images')
  const signed = await Promise.all(
    imageRows.map(async (r) => {
      const { data } = await bucket.createSignedUrl(r.storage_path, 900)
      return data?.signedUrl ?? null
    })
  )

  const mh = (patient.medical_history as Record<string, unknown>) || {}
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

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
      allergies: text(mh.allergies),
      conditions: text(mh.conditions),
      medications: text(mh.medications),
      pregnant: !!mh.pregnant,
      health_note: text(mh.notes),
    },
    visits,
    findings,
    plan,
    labs: (labsRes.data ?? []) as ReportLab[],
    imagesError: imagesRes.error?.message ?? null,
    images: imageRows.map((r, i) => ({
      id: r.id,
      url: signed[i],
      filename: r.metadata?.original_filename || r.storage_path.split('/').pop() || 'image',
      category: r.category || 'intraoral',
      image_type: r.image_type,
      taken_at: r.taken_at,
      is_baseline: !!r.is_baseline,
      notes: r.notes,
    })),
    nextVisit: (nextRes.data as { scheduled_at: string } | null)?.scheduled_at ?? null,
  }
}
