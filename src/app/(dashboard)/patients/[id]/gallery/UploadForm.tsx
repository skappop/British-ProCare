'use client'

import { useState, useTransition } from 'react'
import { uploadImage } from '../imageActions'

const IMAGE_TYPES = [
  'intraoral_front', 'intraoral_left', 'intraoral_right',
  'occlusal_upper', 'occlusal_lower', 'panoramic', 'cephalometric',
  'extraoral', 'other',
]

export default function UploadForm({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleSubmit(formData: FormData) {
    formData.set('patient_id', patientId)
    startTransition(async () => {
      const res = await uploadImage(formData)
      setResult(res)
      if (res.ok) {
        const form = document.getElementById('upload-form') as HTMLFormElement
        form?.reset()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <h3 className="font-display text-base text-ink-strong mb-3">Upload Photo</h3>

      {result && (
        <div className={`text-sm px-3 py-2 rounded-control mb-3 ${result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </div>
      )}

      <form id="upload-form" action={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-ink/60">Photo</label>
          <input
            name="file"
            type="file"
            accept="image/*"
            capture="environment"
            required
            className="text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-ink/60">Type</label>
          <select
            name="image_type"
            className="rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            {IMAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink/60 pb-2.5">
          <input type="checkbox" name="is_baseline" className="rounded" />
          Baseline
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="bg-teal hover:bg-teal-deep disabled:bg-ink/20 text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          {isPending ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  )
}