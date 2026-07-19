import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('patients').select('*').order('created_at', { ascending: false })
  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,file_number.ilike.%${q}%`)
  }

  const { data: patients } = await query.limit(100)

  const patientIds = (patients || []).map((p) => p.id)
  const categoryMap: Record<string, Set<string>> = {}

  if (patientIds.length > 0) {
    const { data: visitRows } = await supabase
      .from('visits')
      .select('patient_id, visit_procedures(procedures(category))')
      .in('patient_id', patientIds)

    for (const row of (visitRows as any[]) || []) {
      const cats = (row.visit_procedures || [])
        .map((vp: any) => vp.procedures?.category)
        .filter(Boolean)
      if (cats.length === 0) continue
      if (!categoryMap[row.patient_id]) categoryMap[row.patient_id] = new Set()
      cats.forEach((c: string) => categoryMap[row.patient_id].add(c))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-ink-strong">Patients</h1>
        <Link
          href="/patients/new"
          className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          + New Patient
        </Link>
      </div>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone, or file number..."
          className="w-full max-w-md rounded-control border border-ink/15 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </form>

      <div className="bg-white rounded-card shadow-soft overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-ink/8 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">File #</th>
              <th className="px-4 py-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {patients?.map((p) => (
              <tr key={p.id} className="border-b border-ink/5 last:border-0 hover:bg-marble/60">
                <td className="px-4 py-3">
                  <Link href={`/patients/${p.id}`} className="text-ink-strong hover:text-teal-deep font-medium">
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-ink/70">{p.phone || '—'}</td>
                <td className="px-4 py-3 font-mono text-ink/70">{p.file_number || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.is_ortho && (
                      <span className="bg-gold/15 text-gold-deep text-xs px-2 py-1 rounded-full">Ortho</span>
                    )}
                    {Array.from(categoryMap[p.id] || [])
                      .filter((c) => c !== 'ortho' && c !== 'general')
                      .map((c) => (
                        <span key={c} className="bg-sage/20 text-ink-strong text-xs px-2 py-1 rounded-full capitalize">
                          {c}
                        </span>
                      ))}
                    {!p.is_ortho && (!categoryMap[p.id] || categoryMap[p.id].size === 0) && (
                      <span className="text-ink/40 text-xs">General</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!patients || patients.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink/40">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}