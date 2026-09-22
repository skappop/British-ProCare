'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface LogRapidScanInput {
  containerId: string
  itemId: string
  scanMode: 'consume' | 'restock'
  userEmail: string
}

interface LogRapidScanResult {
  success: boolean
  message: string
  itemName?: string
  newQuantity?: number
}

/**
 * Log a rapid scan operation and update inventory
 * CONSUME: Deduct 1 from container, deduct 1 from central stock (FEFO)
 * RESTOCK: Add 1 to container, deduct 1 from central stock (FEFO)
 */
export async function logRapidScan(
  input: LogRapidScanInput
): Promise<LogRapidScanResult> {
  const supabase = await createClient()

  try {
    // Get user ID from email
    const { data: userData } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', input.userEmail)
      .single()

    const userId = userData?.id

    // Fetch container item
    const { data: containerItem, error: fetchError } = await supabase
      .from('container_items')
      .select(`
        id,
        current_quantity,
        baseline_quantity,
        inventory:inventory_id (
          id,
          name,
          current_stock
        )
      `)
      .eq('container_id', input.containerId)
      .eq('inventory_id', input.itemId)
      .single()

    if (fetchError || !containerItem) {
      return {
        success: false,
        message: 'Item not found in container',
      }
    }

    const inventory = Array.isArray(containerItem.inventory)
      ? containerItem.inventory[0]
      : containerItem.inventory

    const itemName = inventory.name

    // Validate operation
    if (input.scanMode === 'consume') {
      if (containerItem.current_quantity <= 0) {
        return {
          success: false,
          message: 'Container is empty',
          itemName,
        }
      }
    }

    if (input.scanMode === 'restock') {
      if (inventory.current_stock <= 0) {
        return {
          success: false,
          message: 'No stock available in central inventory',
          itemName,
        }
      }
    }

    // Calculate new quantities
    const quantityChange = input.scanMode === 'consume' ? -1 : 1
    const newContainerQuantity = containerItem.current_quantity + quantityChange

    // Update container item quantity
    const { error: updateContainerError } = await supabase
      .from('container_items')
      .update({ current_quantity: newContainerQuantity })
      .eq('id', containerItem.id)

    if (updateContainerError) {
      throw updateContainerError
    }

    // FEFO Logic: Find oldest batch with stock
    const { data: batches, error: batchError } = await supabase
      .from('inventory_batches')
      .select('id, quantity_remaining, expiry_date')
      .eq('inventory_id', input.itemId)
      .gt('quantity_remaining', 0)
      .order('expiry_date', { ascending: true })
      .limit(1)

    let batchId = null

    if (batches && batches.length > 0) {
      const oldestBatch = batches[0]
      batchId = oldestBatch.id

      // Deduct from batch
      const { error: batchUpdateError } = await supabase
        .from('inventory_batches')
        .update({
          quantity_remaining: oldestBatch.quantity_remaining - 1,
        })
        .eq('id', batchId)

      if (batchUpdateError) {
        throw batchUpdateError
      }
    }

    // Deduct from central inventory stock
    const { error: inventoryUpdateError } = await supabase
      .from('inventory')
      .update({
        current_stock: inventory.current_stock - 1,
      })
      .eq('id', input.itemId)

    if (inventoryUpdateError) {
      throw inventoryUpdateError
    }

    // Log the scan
    const { error: logError } = await supabase
      .from('rapid_scan_log')
      .insert({
        container_id: input.containerId,
        inventory_id: input.itemId,
        scan_mode: input.scanMode,
        quantity_change: quantityChange,
        batch_id: batchId,
        scanned_by: userId,
      })

    if (logError) {
      console.error('Failed to log scan:', logError)
      // Don't fail the operation if logging fails
    }

    // Check if container needs restocking
    const stockPercentage =
      (newContainerQuantity / containerItem.baseline_quantity) * 100

    let message = `${input.scanMode === 'consume' ? 'Consumed' : 'Restocked'} 1 unit`

    if (input.scanMode === 'consume' && stockPercentage <= 25) {
      message += ` ⚠️ Container low (${newContainerQuantity}/${containerItem.baseline_quantity})`
    }

    if (input.scanMode === 'restock' && newContainerQuantity >= containerItem.baseline_quantity) {
      message += ` ✓ Container full`
    }

    revalidatePath('/inventory/rapid-scan')
    revalidatePath('/inventory/containers')

    return {
      success: true,
      message,
      itemName,
      newQuantity: newContainerQuantity,
    }
  } catch (error: any) {
    console.error('Rapid scan error:', error)
    return {
      success: false,
      message: error.message || 'Operation failed',
    }
  }
}
