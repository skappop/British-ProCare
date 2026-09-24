'use client'

import { useEffect, useState } from 'react'
import { getSignedUrls } from '../imageActions'
import PatientReportButton from '@/components/PatientReportButton'

type ImageRecord = {
  id: string
  image_type: string
  storage_path: string
  taken_at: string
  is_baseline: boolean
  category?: 'radiograph' | 'intraoral' | 'document'
  notes?: string
}

type CategorizedGalleryProps = {
  images: ImageRecord[]
  patientId: string
}

export default function CategorizedGallery({ images, patientId }: CategorizedGalleryProps) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'all' | 'radiograph' | 'intraoral' | 'document'>('all')

  useEffect(() => {
    if (images.length > 0) {
      getSignedUrls(images.map((i) => i.storage_path)).then(setUrls)
    }
  }, [images])

  // Group by category
  const categorized = {
    radiograph: images.filter(img => img.category === 'radiograph'),
    intraoral: images.filter(img => img.category === 'intraoral'),
    document: images.filter(img => img.category === 'document'),
  }

  const displayImages = activeTab === 'all' ? images : categorized[activeTab]

  // Group by month for display
  const grouped = displayImages.reduce((acc, img) => {
    const month = new Date(img.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    acc[month] = acc[month] || []
    acc[month].push(img)
    return acc
  }, {} as Record<string, ImageRecord[]>)

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b border-ink/10">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'all'
                ? 'text-teal-deep border-b-2 border-teal-deep -mb-px'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            All ({images.length})
          </button>
          <button
            onClick={() => setActiveTab('radiograph')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'radiograph'
                ? 'text-teal-deep border-b-2 border-teal-deep -mb-px'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            Radiographs ({categorized.radiograph.length})
          </button>
          <button
            onClick={() => setActiveTab('intraoral')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'intraoral'
                ? 'text-teal-deep border-b-2 border-teal-deep -mb-px'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            Intraoral ({categorized.intraoral.length})
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'document'
                ? 'text-teal-deep border-b-2 border-teal-deep -mb-px'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            Documents ({categorized.document.length})
          </button>
        </div>

        {/* Images embedded, shrunk in the browser — the old server export only listed them. */}
        <PatientReportButton patientId={patientId} mode="images" label="Export images (PDF)" />
      </div>

      {/* Image Grid */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, imgs]) => (
          <div key={month}>
            <h3 className="text-sm font-mono text-ink/50 mb-3">{month}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {imgs.map((img) => (
                <div key={img.id} className="relative bg-white rounded-card shadow-soft overflow-hidden group">
                  {urls[img.storage_path] ? (
                    <img
                      src={urls[img.storage_path]}
                      alt={img.image_type}
                      className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(urls[img.storage_path], '_blank')}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-marble skeleton-pulse" />
                  )}
                  <div className="p-2">
                    <p className="text-xs text-ink/60 capitalize">{img.image_type.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {img.is_baseline && (
                        <span className="inline-block text-xs bg-gold/15 text-gold-deep px-2 py-0.5 rounded-full">
                          Baseline
                        </span>
                      )}
                      {img.category && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                          img.category === 'radiograph' ? 'bg-blue-500/10 text-blue-700' :
                          img.category === 'intraoral' ? 'bg-green-500/10 text-green-700' :
                          'bg-purple-500/10 text-purple-700'
                        }`}>
                          {img.category}
                        </span>
                      )}
                    </div>
                    {img.notes && (
                      <p className="text-xs text-ink/50 mt-1 line-clamp-2">{img.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {displayImages.length === 0 && (
          <div className="text-center text-ink/40 text-sm py-12">
            {activeTab === 'all' ? 'No images yet.' : `No ${activeTab} images yet.`}
          </div>
        )}
      </div>
    </div>
  )
}
