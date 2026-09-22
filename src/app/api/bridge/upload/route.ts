import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
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
    const metadataStr = formData.get('metadata') as string

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }

    // Verify patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Collect all files from formData (file_0, file_1, etc.)
    const files: Array<{ key: string; file: File }> = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push({ key, file: value })
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Parse shared metadata
    let sharedMetadata: any = {}
    if (metadataStr) {
      try {
        sharedMetadata = JSON.parse(metadataStr)
      } catch (e) {
        console.warn('Failed to parse metadata:', e)
      }
    }

    // Upload all files
    const uploadedImages = []
    const errors = []

    for (const { key, file } of files) {
      try {
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
          errors.push({ file: file.name, error: uploadError.message })
          continue
        }

        // Determine image category based on file extension and name
        const category = determineCategory(null, file.name, ext)

        // Create database record with source tracking
        const insertData: any = {
          patient_id: patientId,
          image_type: category,
          storage_path: path,
          is_baseline: sharedMetadata.is_baseline || false,
          category,
          source: sharedMetadata.source || 'bridge',
          metadata: {
            original_filename: file.name,
            file_size: file.size,
            ...sharedMetadata,
          },
        }

        if (sharedMetadata.notes) {
          insertData.notes = sharedMetadata.notes
        }

        const { error: dbError, data } = await supabase
          .from('image_records')
          .insert(insertData)
          .select()

        if (dbError) {
          console.error('Database error:', dbError)
          // Cleanup uploaded file
          await supabase.storage.from('patient-images').remove([path])
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        uploadedImages.push({
          id: data[0].id,
          filename: file.name,
          storage_path: path,
          category,
        })
      } catch (error: any) {
        errors.push({ file: file.name, error: error.message })
      }
    }

    // Return results
    if (uploadedImages.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'All uploads failed', details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Uploaded ${uploadedImages.length} of ${files.length} files`,
      uploaded: uploadedImages.length,
      failed: errors.length,
      images: uploadedImages,
      errors: errors.length > 0 ? errors : undefined,
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

  // Check for EzDent-i X-ray patterns (from Dental Agent)
  if (lower.includes('temp_iosensor') || lower.includes('ezdent')) {
    return 'radiograph'
  }

  // Check for DICOM or X-ray patterns
  if (ext === 'dcm' || lower.includes('xray') || lower.includes('x-ray') ||
      lower.includes('panoramic') || lower.includes('ceph') ||
      type.includes('panoramic') || type.includes('ceph') || type.includes('xray')) {
    return 'radiograph'
  }

  // Check for One2 intraoral camera patterns (from Dental Agent)
  if (lower.includes('one2') || lower.includes('oov')) {
    return 'intraoral'
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
