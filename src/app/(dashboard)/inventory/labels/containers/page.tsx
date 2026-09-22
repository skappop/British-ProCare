import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContainerLabelsClient from './ContainerLabelsClient'

export default async function ContainerLabelsPage() {
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
      description
    `)
    .order('name')

  // Fetch container items with inventory details
  const { data: containerItemsRaw } = await supabase
    .from('container_items')
    .select(`
      id,
      container_id,
      inventory_id,
      baseline_quantity,
      grid_section,
      inventory:inventory_id (
        id,
        name,
        unit
      )
    `)

  // Transform the data to match the expected type
  const containerItems = containerItemsRaw?.map((item: any) => ({
    ...item,
    inventory: Array.isArray(item.inventory) ? item.inventory[0] : item.inventory,
  }))

  return (
    <ContainerLabelsClient
      containers={containers || []}
      containerItems={containerItems || []}
    />
  )
}
