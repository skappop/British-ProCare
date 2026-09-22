import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import UploadForm from './UploadForm'
import CategorizedGallery from './CategorizedGallery'
import ActivePatientSync from '@/components/ActivePatientSync'

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: patient } = await supabase.from('patients').select('full_name').eq('id', id).single()
  if (!patient) notFound()

  const { data: images } = await supabase
    .from('image_records')
    .select('*')
    .eq('patient_id', id)
    .order('taken_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/patients/${id}`} className="text-sm text-teal-deep hover:underline">
            ← Back to {patient.full_name}
          </Link>
          <h1 className="font-display text-2xl text-ink-strong mt-2">Progress Gallery</h1>
          <div className="mt-2">
            <ActivePatientSync patientId={id} />
          </div>
        </div>
      </div>

      <UploadForm patientId={id} />

      <CategorizedGallery images={images || []} patientId={id} />
    </div>
  )
}