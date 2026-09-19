import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.BRIDGE_API_KEY

    // Validate bridge service authentication
    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const patientId = formData.get('patient_id') as string
    const imageType = formData.get('image_type') as string
    const file = formData.get('file') as File
    const metadata = formData.get('metadata') as string

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate storage path
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = `${patientId}/${timestamp}-${crypto.randomUUID()}.${ext}`

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('patient-images')
      .upload(path, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Determine image category based on type or file extension
    const category = determineCategory(imageType, file.name, ext)

    // Create database record
    const insertData: any = {
      patient_id: patientId,
      image_type: imageType || 'other',
      storage_path: path,
      is_baseline: false,
      category, // 'radiograph', 'intraoral', 'document'
    }

    // Parse metadata if provided
    if (metadata) {
      try {
        const meta = JSON.parse(metadata)
        if (meta.is_baseline) insertData.is_baseline = meta.is_baseline
        if (meta.notes) insertData.notes = meta.notes
      } catch (e) {
        console.warn('Failed to parse metadata:', e)
      }
    }

    const { error: dbError, data } = await supabase
      .from('image_records')
      .insert(insertData)
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      // Cleanup uploaded file
      await supabase.storage.from('patient-images').remove([path])
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Image uploaded successfully',
      image_id: data[0].id,
      storage_path: path,
      category,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function determineCategory(
  imageType: string | null,
  filename: string,
  ext: string
): 'radiograph' | 'intraoral' | 'document' {
  const lower = filename.toLowerCase()
  const type = imageType?.toLowerCase() || ''

  // Check for DICOM or X-ray patterns
  if (ext === 'dcm' || lower.includes('xray') || lower.includes('x-ray') ||
      lower.includes('panoramic') || lower.includes('ceph') ||
      type.includes('panoramic') || type.includes('ceph') || type.includes('xray')) {
    return 'radiograph'
  }

  // Check for intraoral camera patterns
  if (lower.includes('intraoral') || lower.includes('occlusal') ||
      type.includes('intraoral') || type.includes('occlusal')) {
    return 'intraoral'
  }

  // Check for document patterns
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx' ||
      lower.includes('consent') || lower.includes('form')) {
    return 'document'
  }

  // Default to intraoral for image files
  if (['jpg', 'jpeg', 'png', 'bmp'].includes(ext)) {
    return 'intraoral'
  }

  return 'document'
}
