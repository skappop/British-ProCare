'use client'

import { useState } from 'react'
import { Package, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateContainerLabels } from './generateLabels'

interface Container {
  id: string
  name: string
  description: string | null
}

interface ContainerItem {
  id: string
  container_id: string
  inventory_id: string
  baseline_quantity: number
  grid_section: string | null
  inventory: {
    id: string
    name: string
    unit: string
  }
}

interface Props {
  containers: Container[]
  containerItems: ContainerItem[]
}

export default function ContainerLabelsClient({ containers, containerItems }: Props) {
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  // Group items by container
  const itemsByContainer = containerItems.reduce((acc, item) => {
    if (!acc[item.container_id]) acc[item.container_id] = []
    acc[item.container_id].push(item)
    return acc
  }, {} as Record<string, ContainerItem[]>)

  const toggleContainer = (id: string) => {
    const newSelected = new Set(selectedContainers)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedContainers(newSelected)
  }

  const selectAll = () => {
    setSelectedContainers(new Set(containers.map((c) => c.id)))
  }

  const deselectAll = () => {
    setSelectedContainers(new Set())
  }

  const handleGenerate = async () => {
    if (selectedContainers.size === 0) return

    setGenerating(true)
    try {
      const selectedContainerData = containers
        .filter((c) => selectedContainers.has(c.id))
        .map((container) => ({
          container,
          items: itemsByContainer[container.id] || [],
        }))

      await generateContainerLabels(selectedContainerData)
    } catch (error) {
      console.error('Error generating labels:', error)
      alert('Failed to generate labels')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Container Labels</h1>
        <p className="text-muted-foreground">
          Generate QR code stickers for rapid scanning. Select containers to print.
        </p>
      </div>

      {/* Actions */}
      <div className="bg-surface-2 border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedContainers.size === containers.length}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedContainers.size === 0}
            >
              Deselect All
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedContainers.size} of {containers.length} selected
            </span>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={selectedContainers.size === 0 || generating}
          >
            {generating ? (
              <>Generating...</>
            ) : (
              <>
                <Download className="mr-2" size={16} />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Container Grid */}
      {containers.length === 0 ? (
        <div className="bg-surface-2 border border-white/10 rounded-lg p-12 text-center">
          <Package className="mx-auto mb-3 text-muted-foreground" size={64} />
          <p className="text-muted-foreground mb-4">No containers available</p>
          <p className="text-sm text-muted-foreground">
            Create containers in Container Management first
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {containers.map((container) => {
            const items = itemsByContainer[container.id] || []
            const isSelected = selectedContainers.has(container.id)
            const hasGridItems = items.some((item) => item.grid_section)

            return (
              <button
                key={container.id}
                onClick={() => toggleContainer(container.id)}
                className={`bg-surface-2 border rounded-lg p-5 text-left transition-all ${
                  isSelected
                    ? 'border-gold-light ring-2 ring-gold-light/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package size={20} className="text-gold-light" />
                    <h3 className="font-semibold">{container.name}</h3>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-gold-light border-gold-light'
                        : 'border-white/20'
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-surface-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {container.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {container.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{items.length} items</span>
                  {hasGridItems && (
                    <span className="flex items-center gap-1 text-gold-light">
                      <Printer size={12} />
                      Dense Grid
                    </span>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-xs text-muted-foreground">
                      {items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="truncate">
                          • {item.inventory.name}
                          {item.grid_section && (
                            <span className="text-gold-light"> [{item.grid_section}]</span>
                          )}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="mt-1 text-muted-foreground/70">
                          +{items.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-surface-2 border border-white/10 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Label Printing Instructions</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Select the containers you want to print labels for</li>
          <li>2. Click "Generate PDF" to create printable sticker sheets</li>
          <li>
            3. Print on adhesive label paper (recommended: 2" × 2" or larger per label)
          </li>
          <li>
            4. Containers with grid sections (Endo, Ortho) will generate dense layouts showing
            all variants on one sticker
          </li>
          <li>5. Cut and apply labels to physical containers</li>
          <li>6. Use Rapid Scan to scan items during consumption or restocking</li>
        </ol>
      </div>
    </div>
  )
}
