'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createProcedure(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('procedures').insert({
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    base_fee: formData.get('base_fee') ? parseFloat(formData.get('base_fee') as string) : null,
  })

  if (error) {
    redirect('/procedures/new?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/procedures')
  redirect('/procedures')
}

export async function updateProcedure(id: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('procedures').update({
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    base_fee: formData.get('base_fee') ? parseFloat(formData.get('base_fee') as string) : null,
  }).eq('id', id)

  if (error) {
    redirect(`/procedures/${id}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/procedures/${id}`)
  revalidatePath('/procedures')
  redirect(`/procedures/${id}`)
}

export async function deactivateProcedure(id: string) {
  const supabase = await createClient()
  await supabase.from('procedures').update({ is_active: false }).eq('id', id)
  revalidatePath('/procedures')
  redirect('/procedures')
}

export async function addBomItem(formData: FormData) {
  const supabase = await createClient()

  const procedureId = formData.get('procedure_id') as string
  const inventoryId = formData.get('inventory_id') as string
  const quantity = parseFloat(formData.get('quantity') as string)
  const isOptional = formData.get('is_optional') === 'on'

  if (!inventoryId || !quantity || quantity <= 0) {
    redirect(`/procedures/${procedureId}?error=` + encodeURIComponent('Select an item and a positive quantity'))
  }

  const { error } = await supabase.from('procedure_bom').insert({
    procedure_id: procedureId,
    inventory_id: inventoryId,
    quantity,
    is_optional: isOptional,
  })

  if (error) {
    redirect(`/procedures/${procedureId}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/procedures/${procedureId}`)
}

export async function removeBomItem(formData: FormData) {
  const supabase = await createClient()

  const bomId = formData.get('bom_id') as string
  const procedureId = formData.get('procedure_id') as string

  await supabase.from('procedure_bom').delete().eq('id', bomId)

  revalidatePath(`/procedures/${procedureId}`)
}