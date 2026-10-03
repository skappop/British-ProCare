export type ClinicalTaskCategory = 'general' | 'restorative' | 'endo' | 'surgical' | 'prosthetic' | 'ortho'
export type ClinicalTaskStatus = 'open' | 'in_progress' | 'completed' | 'deferred' | 'cancelled'
export type ClinicalTaskPriority = 'low' | 'normal' | 'high'

export type ClinicalTask = {
  id: string
  patient_id: string
  category: ClinicalTaskCategory
  title: string
  tooth_fdi: string | null
  site: string | null
  finding_code: string | null
  procedure_id: string | null
  status: ClinicalTaskStatus
  priority: ClinicalTaskPriority
  source_visit_id: string | null
  completed_visit_id: string | null
  details: Record<string, unknown>
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export const TASK_CATEGORY_LABELS: Record<ClinicalTaskCategory, string> = {
  general: 'General',
  restorative: 'Restorative',
  endo: 'Endodontic',
  surgical: 'Surgical',
  prosthetic: 'Prosthetic',
  ortho: 'Orthodontic',
}

export const TASK_STATUS_LABELS: Record<ClinicalTaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  deferred: 'Deferred',
  cancelled: 'Cancelled',
}

export const TASK_CATEGORY_ORDER: ClinicalTaskCategory[] = ['restorative', 'endo', 'surgical', 'prosthetic', 'ortho', 'general']

export function taskIsOpen(task: Pick<ClinicalTask, 'status'>) {
  return task.status === 'open' || task.status === 'in_progress' || task.status === 'deferred'
}

export function taskSummary(task: Pick<ClinicalTask, 'title' | 'tooth_fdi' | 'site'>) {
  if (task.tooth_fdi) return `${task.title} · ${task.tooth_fdi}`
  if (task.site) return `${task.title} · ${task.site}`
  return task.title
}
