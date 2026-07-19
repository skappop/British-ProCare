'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const DEFAULT_PHASES = [
  { name: 'Leveling', planned_weeks: 16 },
  { name: 'Working', planned_weeks: 24 },
  { name: 'Finishing', planned_weeks: 12 },
  { name: 'Retention', planned_weeks: null },
]

export async function createTreatmentPlan(patientId: string, useDefaultPhases: boolean) {
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('treatment_plans')
    .insert({ patient_id: patientId, status: 'active' })
    .select('id')
    .single()

  if (error || !plan) {
    return { ok: false, message: error?.message || 'Failed to create plan' }
  }

  if (useDefaultPhases) {
    await supabase.from('treatment_plan_phases').insert(
      DEFAULT_PHASES.map((p, i) => ({
        treatment_plan_id: plan.id,
        name: p.name,
        order_index: i,
        planned_weeks: p.planned_weeks,
        status: i === 0 ? 'active' : 'pending',
        actual_start_date: i === 0 ? new Date().toISOString().slice(0, 10) : null,
      }))
    )
  }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Treatment plan created' }
}

export async function addPhase(formData: FormData) {
  const supabase = await createClient()

  const treatmentPlanId = formData.get('treatment_plan_id') as string
  const patientId = formData.get('patient_id') as string
  const name = formData.get('name') as string
  const plannedWeeks = formData.get('planned_weeks') as string

  const { data: existing } = await supabase
    .from('treatment_plan_phases')
    .select('order_index')
    .eq('treatment_plan_id', treatmentPlanId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const nextIndex = existing ? existing.order_index + 1 : 0

  const { error } = await supabase.from('treatment_plan_phases').insert({
    treatment_plan_id: treatmentPlanId,
    name,
    order_index: nextIndex,
    planned_weeks: plannedWeeks ? parseInt(plannedWeeks) : null,
    status: 'pending',
  })

  if (error) return { ok: false, message: error.message }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Phase added' }
}

export async function advancePhase(phaseId: string, patientId: string) {
  const supabase = await createClient()

  // Mark this phase completed
  await supabase
    .from('treatment_plan_phases')
    .update({ status: 'completed', actual_end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', phaseId)

  const { data: currentPhase } = await supabase
    .from('treatment_plan_phases')
    .select('treatment_plan_id, order_index')
    .eq('id', phaseId)
    .single()

  if (currentPhase) {
    const { data: nextPhase } = await supabase
      .from('treatment_plan_phases')
      .select('id')
      .eq('treatment_plan_id', currentPhase.treatment_plan_id)
      .eq('order_index', currentPhase.order_index + 1)
      .single()

    if (nextPhase) {
      await supabase
        .from('treatment_plan_phases')
        .update({ status: 'active', actual_start_date: new Date().toISOString().slice(0, 10) })
        .eq('id', nextPhase.id)
    } else {
      // No next phase — mark the whole plan completed
      await supabase
        .from('treatment_plans')
        .update({ status: 'completed' })
        .eq('id', currentPhase.treatment_plan_id)
    }
  }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Advanced to next phase' }
}

export async function assignVisitToPhase(visitId: string, phaseId: string, patientId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .update({ treatment_plan_phase_id: phaseId })
    .eq('id', visitId)

  if (error) return { ok: false, message: error.message }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Visit linked to phase' }
}
