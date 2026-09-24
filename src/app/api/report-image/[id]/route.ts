import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', bmp: 'image/bmp', webp: 'image/webp', gif: 'image/gif',
}

/**
 * One patient image, served from this site. The PDF normally downloads images
 * straight from storage; this is its fallback when that download is blocked,
 * so the report does not come out without pictures. Signed-in staff only.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: row, error } = await supabase.from('image_records').select('storage_path').eq('id', id).maybeSingle()
  if (error || !row?.storage_path) return NextResponse.json({ error: error?.message || 'Image not found' }, { status: 404 })

  const { data: file, error: downloadError } = await supabase.storage.from('patient-images').download(row.storage_path)
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message || 'Could not read the file' }, { status: 502 })
  }

  const ext = row.storage_path.split('.').pop()?.toLowerCase() ?? ''
  return new NextResponse(file, {
    headers: {
      'Content-Type': file.type && file.type !== 'application/octet-stream' ? file.type : TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    },
  })
}
