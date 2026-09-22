import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContainersClient from './ContainersClient'

export default async function ContainersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all containers with their items
  const { data: containers } = await supabase
    .from('containers')
    .select(`
      id,
      name,
      description,
      created_at
    `)
    .order('name')

  // Fetch all inventory items for dropdown
  const { data: allInventory } = await supabase
    .from('inventory')
    .select('id, name, category, unit')
    .order('name')

  // Fetch container items with inventory details
  const { data: containerItemsRaw } = await supabase
    .from('container_items')
    .select(`
      id,
      container_id,
      inventory_id,
      baseline_quantity,
      current_quantity,
      grid_section,
      inventory:inventory_id (
        id,
        name,
        category,
        unit,
        current_stock
      )
    `)

  // Transform the data to match the expected type
  const containerItems = containerItemsRaw?.map((item: any) => ({
    ...item,
    inventory: Array.isArray(item.inventory) ? item.inventory[0] : item.inventory,
  }))

  return (
    <ContainersClient
      containers={containers || []}
      containerItems={containerItems || []}
      allInventory={allInventory || []}
      userEmail={user.email || ''}
    />
  )
}
