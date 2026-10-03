'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidFdi } from '@/components/dental/charting'
import type { ClinicalTask, ClinicalTaskCategory, ClinicalTaskPriority, ClinicalTaskStatus } from '@/lib/clinicalTasks'

type TaskInput = {
  category: ClinicalTaskCategory
  title: string
  toothFdi?: string | null
  site?: string | null
  findingCode?: string | null
  procedureId?: string | null
  priority?: ClinicalTaskPriority
  dueAt?: string | null
  details?: Record<string, unknown>
}

const categories = new Set<ClinicalTaskCategory>(['general', 'restorative', 'endo', 'surgical', 'prosthetic', 'ortho'])
const priorities = new Set<ClinicalTaskPriority>(['low', 'normal', 'high'])

function cleanTask(row: unknown): ClinicalTask | null {
  if (!row || typeof row !== 'object') return null
  const value = row as Record<string, unknown>
  if (typeof value.id !== 'string' || typeof value.patient_id !== 'string' || typeof value.category !== 'string') return null
  return {
    id: value.id,
    patient_id: value.patient_id,
    category: value.category as ClinicalTask['category'],
    title: String(value.title || 'Clinical task'),
    tooth_fdi: value.tooth_fdi ? String(value.tooth_fdi) : null,
    site: value.site ? String(value.site) : null,
    finding_code: value.finding_code ? String(value.finding_code) : null,
    procedure_id: value.procedure_id ? String(value.procedure_id) : null,
    status: (value.status || 'open') as ClinicalTask['status'],
    priority: (value.priority || 'normal') as ClinicalTask['priority'],
    source_visit_id: value.source_visit_id ? String(value.source_visit_id) : null,
    completed_visit_id: value.completed_visit_id ? String(value.completed_visit_id) : null,
    details: value.details && typeof value.details === 'object' && !Array.isArray(value.details) ? value.details as Record<string, unknown> : {},
    due_at: value.due_at ? String(value.due_at) : null,
    completed_at: value.completed_at ? String(value.completed_at) : null,
    created_at: String(value.created_at || ''),
    updated_at: String(value.updated_at || ''),
  }
}

export async function getClinicalTasks(patientId: string, includeClosed = false): Promise<ClinicalTask[]> {
  const supabase = await createClient()
  let query = supabase.from('clinical_tasks').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
  if (!includeClosed) query = query.in('status', ['open', 'in_progress', 'deferred'])
  const { data, error } = await query
  if (error || !data) return []
  return (data as unknown[]).map(cleanTask).filter((task): task is ClinicalTask => !!task)
}

export async function createClinicalTask(patientId: string, input: TaskInput): Promise<{ ok: boolean; message?: string; task?: ClinicalTask }> {
  if (!categories.has(input.category)) return { ok: false, message: 'Choose a valid treatment category' }
  if (!input.title.trim()) return { ok: false, message: 'Add a short treatment plan' }
  if (input.toothFdi && !isValidFdi(input.toothFdi)) return { ok: false, message: 'Choose a valid FDI tooth' }

  const supabase = await createClient()
  const row = {
    patient_id: patientId,
    category: input.category,
    title: input.title.trim().slice(0, 160),
    tooth_fdi: input.toothFdi || null,
    site: input.site?.trim().slice(0, 160) || null,
    finding_code: input.findingCode?.trim().slice(0, 40) || null,
    procedure_id: input.procedureId || null,
    priority: input.priority && priorities.has(input.priority) ? input.priority : 'normal',
    due_at: input.dueAt || null,
    details: input.details || {},
  }
  const { data, error } = await supabase.from('clinical_tasks').insert(row).select('*').single()
  if (error || !data) return { ok: false, message: error?.message || 'Could not create the treatment task' }
  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/recall')
  return { ok: true, task: cleanTask(data) || undefined }
}

export async function updateClinicalTask(
  patientId: string,
  taskId: string,
  update: { status?: ClinicalTaskStatus; title?: string; priority?: ClinicalTaskPriority; dueAt?: string | null; details?: Record<string, unknown> }
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  const next: Record<string, unknown> = {}
  if (update.status) next.status = update.status
  if (update.title !== undefined) next.title = update.title.trim().slice(0, 160)
  if (update.priority) next.priority = priorities.has(update.priority) ? update.priority : 'normal'
  if (update.dueAt !== undefined) next.due_at = update.dueAt || null
  if (update.details) next.details = update.details
  if (update.status === 'completed') next.completed_at = new Date().toISOString()
  if (update.status && update.status !== 'completed') next.completed_at = null
  const { error } = await supabase.from('clinical_tasks').update(next).eq('id', taskId).eq('patient_id', patientId)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/recall')
  return { ok: true }
}

export async function completeClinicalTasks(
  patientId: string,
  taskIds: string[],
  visitId: string,
  details: Record<string, unknown> = {}
): Promise<{ ok: boolean; message?: string }> {
  if (taskIds.length === 0) return { ok: true }
  const supabase = await createClient()
  const { data: tasks, error: readError } = await supabase
    .from('clinical_tasks')
    .select('id, details')
    .eq('patient_id', patientId)
    .in('id', taskIds)
  if (readError) return { ok: false, message: readError.message }
  for (const task of tasks || []) {
    const existing = task.details && typeof task.details === 'object' && !Array.isArray(task.details) ? task.details as Record<string, unknown> : {}
    const { error } = await supabase.from('clinical_tasks').update({
      status: 'completed',
      completed_visit_id: visitId,
      completed_at: new Date().toISOString(),
      details: { ...existing, completion: details },
    }).eq('id', task.id).eq('patient_id', patientId)
    if (error) return { ok: false, message: error.message }
  }
  revalidatePath(`/patients/${patientId}`)
  revalidatePath('/recall')
  return { ok: true }
}
