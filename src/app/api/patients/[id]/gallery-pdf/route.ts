import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsPDF } from 'jspdf'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('full_name, date_of_birth, phone, email')
      .eq('id', id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch all images
    const { data: images, error: imagesError } = await supabase
      .from('image_records')
      .select('*')
      .eq('patient_id', id)
      .order('taken_at', { ascending: false })

    if (imagesError) {
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    // Categorize images
    const categorized = {
      radiograph: images?.filter(img => img.category === 'radiograph') || [],
      intraoral: images?.filter(img => img.category === 'intraoral') || [],
      document: images?.filter(img => img.category === 'document') || [],
    }

    // Generate PDF
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPos = 20

    // Header
    pdf.setFontSize(20)
    pdf.text('Patient Gallery Summary', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    // Patient Info
    pdf.setFontSize(12)
    pdf.text(`Patient: ${patient.full_name}`, 20, yPos)
    yPos += 7
    if (patient.date_of_birth) {
      pdf.text(`DOB: ${new Date(patient.date_of_birth).toLocaleDateString()}`, 20, yPos)
      yPos += 7
    }
    pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 20, yPos)
    yPos += 15

    // Summary Stats
    pdf.setFontSize(14)
    pdf.text('Summary', 20, yPos)
    yPos += 10
    pdf.setFontSize(11)
    pdf.text(`Total Images: ${images?.length || 0}`, 25, yPos)
    yPos += 6
    pdf.text(`Radiographs: ${categorized.radiograph.length}`, 25, yPos)
    yPos += 6
    pdf.text(`Intraoral Photos: ${categorized.intraoral.length}`, 25, yPos)
    yPos += 6
    pdf.text(`Documents: ${categorized.document.length}`, 25, yPos)
    yPos += 15

    // Radiographs Section
    if (categorized.radiograph.length > 0) {
      pdf.setFontSize(14)
      pdf.text('Radiographs', 20, yPos)
      yPos += 10
      pdf.setFontSize(10)

      for (const img of categorized.radiograph) {
        if (yPos > pageHeight - 20) {
          pdf.addPage()
          yPos = 20
        }
        const date = new Date(img.taken_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        pdf.text(`• ${img.image_type.replace(/_/g, ' ')} - ${date}${img.is_baseline ? ' (Baseline)' : ''}`, 25, yPos)
        yPos += 6
      }
      yPos += 5
    }

    // Intraoral Section
    if (categorized.intraoral.length > 0) {
      if (yPos > pageHeight - 40) {
        pdf.addPage()
        yPos = 20
      }
      pdf.setFontSize(14)
      pdf.text('Intraoral Photos', 20, yPos)
      yPos += 10
      pdf.setFontSize(10)

      for (const img of categorized.intraoral) {
        if (yPos > pageHeight - 20) {
          pdf.addPage()
          yPos = 20
        }
        const date = new Date(img.taken_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        pdf.text(`• ${img.image_type.replace(/_/g, ' ')} - ${date}${img.is_baseline ? ' (Baseline)' : ''}`, 25, yPos)
        yPos += 6
      }
      yPos += 5
    }

    // Documents Section
    if (categorized.document.length > 0) {
      if (yPos > pageHeight - 40) {
        pdf.addPage()
        yPos = 20
      }
      pdf.setFontSize(14)
      pdf.text('Documents', 20, yPos)
      yPos += 10
      pdf.setFontSize(10)

      for (const img of categorized.document) {
        if (yPos > pageHeight - 20) {
          pdf.addPage()
          yPos = 20
        }
        const date = new Date(img.taken_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        pdf.text(`• ${img.image_type.replace(/_/g, ' ')} - ${date}`, 25, yPos)
        yPos += 6
      }
    }

    // Footer on all pages
    const pageCount = pdf.internal.pages.length - 1
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(9)
      pdf.setTextColor(150)
      pdf.text(
        `ProCare Clinic - Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
    }

    // Generate PDF buffer
    const pdfBuffer = pdf.output('arraybuffer')

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${patient.full_name.replace(/[^a-z0-9]/gi, '_')}_gallery_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
