import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchAll'
import RecallBoard, { type RecallItem } from './RecallBoard'

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

export default async function RecallPage() {
  const supabase = await createClient()

  // Every patient with only their latest visit, a page at a time: all of
  // them, however many (a single request stops at 1,000 rows).
  type Row = { id: string; full_name: string; phone: string | null; is_ortho: boolean; visits: { visit_date: string; ortho_quick_log: any }[] }
  type TaskRow = { patient_id: string; category: string; title: string; tooth_fdi: string | null; due_at: string | null }
  const [{ data: patients }, { data: futureAppts }, { data: clinicalTasks }] = await Promise.all([
    fetchAll<Row>((from, to) =>
      supabase
        .from('patients')
        .select('id, full_name, phone, is_ortho, visits(visit_date, ortho_quick_log)')
        .order('visit_date', { referencedTable: 'visits', ascending: false })
        .limit(1, { referencedTable: 'visits' })
        .order('id')
        .range(from, to)
    ),
    fetchAll<{ patient_id: string }>((from, to) =>
      supabase
        .from('appointments')
        .select('patient_id')
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('id')
        .range(from, to)
    ),
    supabase
      .from('clinical_tasks')
      .select('patient_id, category, title, tooth_fdi, due_at')
      .in('status', ['open', 'in_progress', 'deferred'])
      .order('due_at', { ascending: true }),
  ])

  const lastVisitByPatient: Record<string, { visit_date: string; ortho_quick_log: any }> = {}
  for (const p of patients) {
    if (p.visits?.[0]) lastVisitByPatient[p.id] = p.visits[0]
  }

  const bookedPatientIds = new Set(futureAppts.map((a) => a.patient_id))
  const tasksByPatient = new Map<string, TaskRow[]>()
  for (const task of ((clinicalTasks || []) as TaskRow[])) {
    const list = tasksByPatient.get(task.patient_id) || []
    list.push(task)
    tasksByPatient.set(task.patient_id, list)
  }
  const now = Date.now()

  const overdue: RecallItem[] = []

  for (const p of patients) {
    if (bookedPatientIds.has(p.id)) continue
    const lastVisit = lastVisitByPatient[p.id]
    if (!lastVisit) continue // never had a visit — not a recall case

    const lastVisitDate = new Date(lastVisit.visit_date)
    const tasks = tasksByPatient.get(p.id) || []

    if (tasks.length > 0) {
      const first = tasks[0]
      const dueDate = first.due_at ? new Date(first.due_at) : lastVisitDate
      overdue.push({
        id: p.id,
        name: p.full_name,
        phone: p.phone,
        kind: p.is_ortho ? 'ortho' : 'general',
        dueSince: dueDate.toISOString(),
        reason: `${tasks.length} open treatment task${tasks.length === 1 ? '' : 's'} · ${first.title}${first.tooth_fdi ? ` on tooth ${first.tooth_fdi}` : ''}`,
        lastVisit: lastVisitDate.toISOString(),
        taskCount: tasks.length,
      })
      continue
    }

    if (p.is_ortho && lastVisit.ortho_quick_log?.next_visit_weeks) {
      const dueDate = new Date(
        lastVisitDate.getTime() + lastVisit.ortho_quick_log.next_visit_weeks * 7 * 24 * 60 * 60 * 1000
      )
      if (dueDate.getTime() < now + 30 * 24 * 60 * 60 * 1000) {
        overdue.push({
          id: p.id,
          name: p.full_name,
          phone: p.phone,
          kind: 'ortho',
          dueSince: dueDate.toISOString(),
          reason: dueDate.getTime() < now ? 'Orthodontic follow-up overdue' : 'Orthodontic follow-up due soon',
          lastVisit: lastVisitDate.toISOString(),
        })
      }
    } else if (!p.is_ortho) {
      const dueDate = new Date(lastVisitDate.getTime() + SIX_MONTHS_MS)
      if (dueDate.getTime() < now + 30 * 24 * 60 * 60 * 1000) {
        overdue.push({
          id: p.id,
          name: p.full_name,
          phone: p.phone,
          kind: 'general',
          dueSince: dueDate.toISOString(),
          reason: dueDate.getTime() < now ? '6-month checkup overdue' : '6-month checkup due soon',
          lastVisit: lastVisitDate.toISOString(),
        })
      }
    }
  }

  overdue.sort((a, b) => new Date(a.dueSince).getTime() - new Date(b.dueSince).getTime())
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Recall</p>
        <h1 className="font-display text-2xl text-ink-strong mt-1">Patients Due for Follow-up</h1>
        <p className="text-sm text-ink/50 mt-1">Follow up with patients who are overdue or due within the next 30 days.</p>
      </div>
      <RecallBoard items={overdue} />
    </div>
  )
}
