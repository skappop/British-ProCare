'use client'

import { useEffect, useState } from 'react'
import { getSignedUrls } from '../imageActions'

type ImageRecord = {
  id: string
  image_type: string
  storage_path: string
  taken_at: string
  is_baseline: boolean
}

export default function GalleryGrid({ images }: { images: ImageRecord[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (images.length > 0) {
      getSignedUrls(images.map((i) => i.storage_path)).then(setUrls)
    }
  }, [images])

  const grouped = images.reduce((acc, img) => {
    const month = new Date(img.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    acc[month] = acc[month] || []
    acc[month].push(img)
    return acc
  }, {} as Record<string, ImageRecord[]>)

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, imgs]) => (
        <div key={month}>
          <h3 className="text-sm font-mono text-ink/50 mb-3">{month}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {imgs.map((img) => (
              <div key={img.id} className="relative bg-white rounded-card shadow-soft overflow-hidden">
                {urls[img.storage_path] ? (
                  <img
                    src={urls[img.storage_path]}
                    alt={img.image_type}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-marble animate-pulse" />
                )}
                <div className="p-2">
                  <p className="text-xs text-ink/60 capitalize">{img.image_type.replace(/_/g, ' ')}</p>
                  {img.is_baseline && (
                    <span className="inline-block mt-1 text-xs bg-gold/15 text-gold-deep px-2 py-0.5 rounded-full">
                      Baseline
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {images.length === 0 && (
        <div className="text-center text-ink/40 text-sm py-12">No photos yet.</div>
      )}
    </div>
  )
}