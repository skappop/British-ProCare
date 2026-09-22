import jsPDF from 'jspdf'
import QRCode from 'qrcode'

interface Container {
  id: string
  name: string
  description: string | null
}

interface ContainerItem {
  id: string
  container_id: string
  inventory_id: string
  baseline_quantity: number
  grid_section: string | null
  inventory: {
    id: string
    name: string
    unit: string
  }
}

interface ContainerWithItems {
  container: Container
  items: ContainerItem[]
}

/**
 * Generate PDF with QR code labels for containers
 * Supports both single-item labels and dense grid layouts for Endo/Ortho containers
 */
export async function generateContainerLabels(
  containersWithItems: ContainerWithItems[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 8.5" × 11" = 215.9mm × 279.4mm
  })

  let isFirstPage = true

  for (const { container, items } of containersWithItems) {
    if (!isFirstPage) {
      doc.addPage()
    }
    isFirstPage = false

    // Check if this container has grid items (dense layout needed)
    const gridItems = items.filter((item) => item.grid_section)
    const hasGridLayout = gridItems.length > 0

    if (hasGridLayout) {
      // Dense grid layout for Endo/Ortho containers
      await generateDenseGridLabel(doc, container, items)
    } else {
      // Standard layout: one QR code per item
      await generateStandardLabels(doc, container, items)
    }
  }

  // Save PDF
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`container-labels-${timestamp}.pdf`)
}

/**
 * Dense grid layout: All items from one container on a single sticker
 * For containers like Endo (GP 20 T2, GP 25 T2...) or Ortho (Elastics Blue 1/4...)
 */
async function generateDenseGridLabel(
  doc: jsPDF,
  container: Container,
  items: ContainerItem[]
) {
  const pageWidth = 215.9
  const pageHeight = 279.4
  const margin = 20

  // Label dimensions for a large sticker (can fit on one sheet)
  const labelWidth = pageWidth - 2 * margin
  const labelHeight = 120

  const x = margin
  const y = margin

  // Draw border
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.rect(x, y, labelWidth, labelHeight)

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(container.name, x + labelWidth / 2, y + 10, { align: 'center' })

  // Grid of items with QR codes
  const qrSize = 20 // mm
  const itemSpacing = 5
  const cols = Math.floor((labelWidth - 20) / (qrSize + itemSpacing))
  const startX = x + 10
  let currentX = startX
  let currentY = y + 20

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Generate QR code payload
    const payload = JSON.stringify({
      c: container.id,
      i: item.inventory_id,
    })

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    })

    // Add QR code
    doc.addImage(qrDataUrl, 'PNG', currentX, currentY, qrSize, qrSize)

    // Add item label below QR code
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    const label = item.grid_section
      ? item.grid_section
      : item.inventory.name.substring(0, 15)

    // Center text under QR code
    doc.text(label, currentX + qrSize / 2, currentY + qrSize + 4, {
      align: 'center',
      maxWidth: qrSize,
    })

    // Move to next position
    currentX += qrSize + itemSpacing

    // Wrap to next row if needed
    if ((i + 1) % cols === 0) {
      currentX = startX
      currentY += qrSize + 10
    }

    // If we've filled the label, break
    if (currentY + qrSize > y + labelHeight - 10) {
      break
    }
  }

  // Footer instructions
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Scan any item QR code with Rapid Scan in CONSUME or RESTOCK mode',
    x + labelWidth / 2,
    y + labelHeight - 5,
    { align: 'center' }
  )
}

/**
 * Standard layout: Individual QR codes for each item
 * Used when container has no grid sections
 */
async function generateStandardLabels(
  doc: jsPDF,
  container: Container,
  items: ContainerItem[]
) {
  const pageWidth = 215.9
  const pageHeight = 279.4
  const margin = 15

  // Label dimensions: 50mm × 50mm stickers, 3 per row, 4 rows per page
  const labelSize = 50
  const labelSpacing = 8
  const cols = 3
  const rows = 4

  let currentItem = 0

  for (let row = 0; row < rows && currentItem < items.length; row++) {
    for (let col = 0; col < cols && currentItem < items.length; col++) {
      const item = items[currentItem]

      const x = margin + col * (labelSize + labelSpacing)
      const y = margin + row * (labelSize + labelSpacing)

      // Draw label border
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(x, y, labelSize, labelSize)

      // Container name at top
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(container.name, x + labelSize / 2, y + 5, { align: 'center' })

      // Generate QR code payload
      const payload = JSON.stringify({
        c: container.id,
        i: item.inventory_id,
      })

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M',
      })

      // Add QR code centered
      const qrSize = 30
      const qrX = x + (labelSize - qrSize) / 2
      const qrY = y + 8
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      // Item name below QR code
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(item.inventory.name, x + labelSize / 2, y + qrY + qrSize + 4, {
        align: 'center',
        maxWidth: labelSize - 4,
      })

      // Baseline quantity
      doc.setFontSize(6)
      doc.text(
        `Baseline: ${item.baseline_quantity} ${item.inventory.unit}`,
        x + labelSize / 2,
        y + labelSize - 3,
        { align: 'center' }
      )

      currentItem++
    }
  }

  // If more items remain, add a new page
  if (currentItem < items.length) {
    doc.addPage()
    await generateStandardLabels(
      doc,
      container,
      items.slice(currentItem)
    )
  }
}
