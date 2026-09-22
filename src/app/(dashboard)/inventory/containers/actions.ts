'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createContainer(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  const { error } = await supabase
    .from('containers')
    .insert({
      name,
      description: description || null,
    })

  if (error) {
    console.error('Error creating container:', error)
    throw new Error('Failed to create container')
  }

  revalidatePath('/inventory/containers')
}

export async function updateContainer(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  const { error } = await supabase
    .from('containers')
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating container:', error)
    throw new Error('Failed to update container')
  }

  revalidatePath('/inventory/containers')
}

export async function deleteContainer(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string

  const { error } = await supabase
    .from('containers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting container:', error)
    throw new Error('Failed to delete container')
  }

  revalidatePath('/inventory/containers')
}

export async function addItemToContainer(formData: FormData) {
  const supabase = await createClient()

  const container_id = formData.get('container_id') as string
  const inventory_id = formData.get('inventory_id') as string
  const baseline_quantity = parseInt(formData.get('baseline_quantity') as string)
  const current_quantity = parseInt(formData.get('current_quantity') as string)
  const grid_section = formData.get('grid_section') as string

  const { error } = await supabase
    .from('container_items')
    .insert({
      container_id,
      inventory_id,
      baseline_quantity,
      current_quantity,
      grid_section: grid_section || null,
    })

  if (error) {
    console.error('Error adding item to container:', error)
    throw new Error('Failed to add item to container')
  }

  revalidatePath('/inventory/containers')
}

export async function updateContainerItem(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const baseline_quantity = parseInt(formData.get('baseline_quantity') as string)
  const current_quantity = parseInt(formData.get('current_quantity') as string)

  const { error } = await supabase
    .from('container_items')
    .update({
      baseline_quantity,
      current_quantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating container item:', error)
    throw new Error('Failed to update container item')
  }

  revalidatePath('/inventory/containers')
}

export async function removeItemFromContainer(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string

  const { error } = await supabase
    .from('container_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error removing item from container:', error)
    throw new Error('Failed to remove item from container')
  }

  revalidatePath('/inventory/containers')
}
