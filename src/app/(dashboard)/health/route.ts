import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { error } = await supabase.from('patients').select('id').limit(1)
  return NextResponse.json({ ok: !error, timestamp: new Date().toISOString() })
}