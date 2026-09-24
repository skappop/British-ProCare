import { createClient } from '@/lib/supabase/server'
import LiveRefresh from '@/components/LiveRefresh'
import ReceptionFlow from './ReceptionFlow'
import type { Procedure, ReceptionPatient, TodayAppointment } from './types'

export const dynamic = 'force-dynamic'

export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; appt?: string }>
}) {
  const { patient: patientParam, appt: apptParam } = await searchParams
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const [{ data: procedures }, { data: appointments }] = await Promise.all([
    supabase
      .from('procedures')
      .select('id, code, name, base_fee, category')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('appointments')
      .select('id, scheduled_at, status, patients(id, full_name, phone, file_number, is_ortho)')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true }),
  ])

  let initialPatient: ReceptionPatient | null = null
  if (patientParam) {
    const { data: pp } = await supabase
      .from('patients')
      .select('id, full_name, phone, file_number, is_ortho')
      .eq('id', patientParam)
      .single()
    if (pp) initialPatient = { ...(pp as any), is_ortho: !!(pp as any).is_ortho }
  }

  const todayAppointments: TodayAppointment[] = ((appointments as any[]) || []).map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    patient: a.patients
      ? {
          id: a.patients.id,
          full_name: a.patients.full_name,
          phone: a.patients.phone,
          file_number: a.patients.file_number,
          is_ortho: !!a.patients.is_ortho,
        }
      : null,
  }))

  return (
    <>
      {/* The "Booked today" list updates itself as the doctors mark people seen. */}
      <div className="flex justify-end -mb-2">
        <LiveRefresh tables={['appointments', 'payments']} />
      </div>
      <ReceptionFlow
        procedures={(procedures as Procedure[]) || []}
        todayAppointments={todayAppointments}
        initialPatient={initialPatient}
        initialAppointmentId={initialPatient ? apptParam || null : null}
      />
    </>
  )
}
