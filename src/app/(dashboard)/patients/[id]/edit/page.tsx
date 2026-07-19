import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updatePatient, deletePatient } from '../../actions'
import DeleteButton from '@/components/DeleteButton'

export default async function EditPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: p } = await supabase.from('patients').select('*').eq('id', id).single()
  if (!p) notFound()

  const updateWithId = updatePatient.bind(null, id)
  const deleteWithId = deletePatient.bind(null, id)

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink-strong mb-6">Edit Patient</h1>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">{error}</div>
      )}

      <form action={updateWithId} className="bg-white rounded-card shadow-soft p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm text-ink/70">Full Name *</label>
          <input name="full_name" required defaultValue={p.full_name}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Phone</label>
            <input name="phone" defaultValue={p.phone || ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">File Number</label>
            <input name="file_number" defaultValue={p.file_number || ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Date of Birth</label>
            <input name="date_of_birth" type="date" defaultValue={p.date_of_birth || ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Gender</label>
            <select name="gender" defaultValue={p.gender || ''}
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal">
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Notes</label>
          <textarea name="notes" rows={2} defaultValue={p.notes || ''}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" name="is_ortho" defaultChecked={p.is_ortho} className="rounded" />
          This patient is an orthodontic case
        </label>

        <button type="submit"
          className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-2.5 text-sm font-medium transition-colors">
          Save Changes
        </button>
      </form>

      <div className="mt-6 flex justify-end">
        <DeleteButton
          action={deleteWithId}
          label="Delete Patient"
          warning="This deletes all visits & records — confirm?"
        />
      </div>
    </div>
  )
}