'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Package, Edit2, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createContainer,
  updateContainer,
  deleteContainer,
  addItemToContainer,
  updateContainerItem,
  removeItemFromContainer,
} from './actions'

interface Container {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface ContainerItem {
  id: string
  container_id: string
  inventory_id: string
  baseline_quantity: number
  current_quantity: number
  grid_section: string | null
  inventory: {
    id: string
    name: string
    category: string
    unit: string
    current_stock: number
  }
}

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
}

interface Props {
  containers: Container[]
  containerItems: ContainerItem[]
  allInventory: InventoryItem[]
  userEmail: string
}

export default function ContainersClient({
  containers,
  containerItems,
  allInventory,
  userEmail,
}: Props) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingContainer, setEditingContainer] = useState<Container | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [showAddItemModal, setShowAddItemModal] = useState(false)

  // Group items by container
  const itemsByContainer = containerItems.reduce((acc, item) => {
    if (!acc[item.container_id]) acc[item.container_id] = []
    acc[item.container_id].push(item)
    return acc
  }, {} as Record<string, ContainerItem[]>)

  const selectedContainerData = containers.find((c) => c.id === selectedContainer)
  const selectedContainerItems = selectedContainer ? itemsByContainer[selectedContainer] || [] : []

  // Calculate stock level status
  const getStockStatus = (current: number, baseline: number) => {
    const percentage = (current / baseline) * 100
    if (percentage === 0) return { label: 'Empty', color: 'text-red-500', bg: 'bg-red-500/10' }
    if (percentage < 50) return { label: 'Low', color: 'text-orange-500', bg: 'bg-orange-500/10' }
    if (percentage < 100) return { label: 'Partial', color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
    return { label: 'Full', color: 'text-green-500', bg: 'bg-green-500/10' }
  }

  const handleCreateContainer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await createContainer(formData)
    setShowCreateModal(false)
    router.refresh()
  }

  const handleUpdateContainer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingContainer) return
    const formData = new FormData(e.currentTarget)
    formData.append('id', editingContainer.id)
    await updateContainer(formData)
    setEditingContainer(null)
    router.refresh()
  }

  const handleDeleteContainer = async (id: string) => {
    if (!confirm('Delete this container? All item associations will be removed.')) return
    const formData = new FormData()
    formData.append('id', id)
    await deleteContainer(formData)
    if (selectedContainer === id) setSelectedContainer(null)
    router.refresh()
  }

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedContainer) return
    const formData = new FormData(e.currentTarget)
    formData.append('container_id', selectedContainer)
    await addItemToContainer(formData)
    setShowAddItemModal(false)
    router.refresh()
  }

  const handleUpdateItem = async (itemId: string, baseline: number, current: number) => {
    const formData = new FormData()
    formData.append('id', itemId)
    formData.append('baseline_quantity', baseline.toString())
    formData.append('current_quantity', current.toString())
    await updateContainerItem(formData)
    router.refresh()
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Remove this item from the container?')) return
    const formData = new FormData()
    formData.append('id', itemId)
    await removeItemFromContainer(formData)
    router.refresh()
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Container Management</h1>
          <p className="text-muted-foreground">
            Manage physical clinical containers and their inventory items
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2" size={16} />
          New Container
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Container List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-semibold mb-4">Containers ({containers.length})</h2>
          {containers.length === 0 ? (
            <div className="bg-surface-2 border border-white/10 rounded-lg p-8 text-center">
              <Package className="mx-auto mb-3 text-muted-foreground" size={48} />
              <p className="text-muted-foreground mb-4">No containers yet</p>
              <Button variant="outline" onClick={() => setShowCreateModal(true)}>
                Create First Container
              </Button>
            </div>
          ) : (
            containers.map((container) => {
              const items = itemsByContainer[container.id] || []
              const totalItems = items.length
              const lowStock = items.filter(
                (i) => i.current_quantity < i.baseline_quantity * 0.5
              ).length
              const emptyStock = items.filter((i) => i.current_quantity === 0).length

              return (
                <div
                  key={container.id}
                  className={`bg-surface-2 border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedContainer === container.id
                      ? 'border-gold-light ring-1 ring-gold-light'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                  onClick={() => setSelectedContainer(container.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={20} className="text-gold-light" />
                      <h3 className="font-semibold">{container.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingContainer(container)
                        }}
                        className="p-1 hover:text-gold-light transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteContainer(container.id)
                        }}
                        className="p-1 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {container.description && (
                    <p className="text-sm text-muted-foreground mb-3">{container.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{totalItems} items</span>
                    {emptyStock > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle size={12} />
                        {emptyStock} empty
                      </span>
                    )}
                    {lowStock > 0 && emptyStock === 0 && (
                      <span className="text-orange-500">{lowStock} low</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right: Container Details */}
        <div className="lg:col-span-2">
          {!selectedContainer ? (
            <div className="bg-surface-2 border border-white/10 rounded-lg p-12 text-center">
              <Package className="mx-auto mb-3 text-muted-foreground" size={64} />
              <p className="text-muted-foreground">Select a container to view details</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold">{selectedContainerData?.name}</h2>
                  {selectedContainerData?.description && (
                    <p className="text-muted-foreground mt-1">{selectedContainerData.description}</p>
                  )}
                </div>
                <Button onClick={() => setShowAddItemModal(true)} variant="outline">
                  <Plus className="mr-2" size={16} />
                  Add Item
                </Button>
              </div>

              {selectedContainerItems.length === 0 ? (
                <div className="bg-surface-2 border border-white/10 rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">No items in this container</p>
                  <Button variant="outline" onClick={() => setShowAddItemModal(true)}>
                    Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedContainerItems.map((item) => {
                    const status = getStockStatus(item.current_quantity, item.baseline_quantity)
                    return (
                      <div
                        key={item.id}
                        className="bg-surface-2 border border-white/10 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{item.inventory.name}</h3>
                              {item.grid_section && (
                                <span className="text-xs bg-white/5 px-2 py-0.5 rounded">
                                  {item.grid_section}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>
                                {status.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div>
                                <span className="text-muted-foreground">Current: </span>
                                <span className="font-medium">{item.current_quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Baseline: </span>
                                <span className="font-medium">{item.baseline_quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Unit: </span>
                                <span>{item.inventory.unit}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Central Stock: </span>
                                <span>{item.inventory.current_stock}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Quick adjust buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={() =>
                              handleUpdateItem(
                                item.id,
                                item.baseline_quantity,
                                Math.max(0, item.current_quantity - 1)
                              )
                            }
                            className="px-3 py-1 bg-surface-3 hover:bg-surface-4 rounded text-sm transition-colors"
                          >
                            -1
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateItem(
                                item.id,
                                item.baseline_quantity,
                                item.current_quantity + 1
                              )
                            }
                            className="px-3 py-1 bg-surface-3 hover:bg-surface-4 rounded text-sm transition-colors"
                          >
                            +1
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateItem(item.id, item.baseline_quantity, item.baseline_quantity)
                            }
                            className="px-3 py-1 bg-gold-light/10 hover:bg-gold-light/20 text-gold-light rounded text-sm transition-colors"
                          >
                            Fill to Baseline
                          </button>
                          <button
                            onClick={() => handleUpdateItem(item.id, item.baseline_quantity, 0)}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-sm transition-colors ml-auto"
                          >
                            Empty
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Container Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Container</h2>
            <form onSubmit={handleCreateContainer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Container Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g., Implant Kit"
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Brief description of this container"
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Create Container
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Container Modal */}
      {editingContainer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Container</h2>
            <form onSubmit={handleUpdateContainer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Container Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingContainer.name}
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingContainer.description || ''}
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Update Container
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingContainer(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item to Container Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Item to Container</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Inventory Item</label>
                <select
                  name="inventory_id"
                  required
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                >
                  <option value="">Select an item...</option>
                  {allInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Baseline Quantity</label>
                <input
                  type="number"
                  name="baseline_quantity"
                  required
                  min="1"
                  defaultValue="1"
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Quantity</label>
                <input
                  type="number"
                  name="current_quantity"
                  required
                  min="0"
                  defaultValue="0"
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Grid Section (Optional)
                </label>
                <input
                  type="text"
                  name="grid_section"
                  placeholder="e.g., GP 20 T2, Elastics Blue 1/4"
                  className="w-full bg-surface-1 border border-white/20 rounded-md px-3 py-2 focus:border-gold-light focus:ring-1 focus:ring-gold-light outline-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Add Item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddItemModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
