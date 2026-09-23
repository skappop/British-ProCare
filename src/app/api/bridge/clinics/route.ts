import { NextResponse } from 'next/server'
import { bridgeAdminClient, bridgeAuthError, missingServiceRole, noStore } from '@/lib/bridge'

export const dynamic = 'force-dynamic'

/** Clinic list for the agent's settings window, so a PC can be assigned to one. */
export async function GET(request: Request) {
  const unauthorized = bridgeAuthError(request)
  if (unauthorized) return unauthorized

  const admin = bridgeAdminClient()
  if (!admin) return missingServiceRole()

  const { data, error } = await admin
    .from('clinics')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
  }

  return NextResponse.json({ clinics: data ?? [] }, { headers: noStore })
}
