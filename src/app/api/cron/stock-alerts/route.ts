import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Runs daily via Vercel Cron (see vercel.json).
// Sends one summary email via Resend if there's anything to flag.
// Requires env vars: RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM
export async function GET(request: Request) {
  // Vercel sets this header on cron-triggered requests; guards against public hits.
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: items } = await supabase
    .from('inventory')
    .select('name, stock, unit, reorder_level')
    .eq('is_active', true)

  const { data: expiring } = await supabase
    .from('expiring_batches')
    .select('item_name, quantity, unit, expiry_date, days_until_expiry')

  const lowStock = items?.filter((i) => i.stock <= i.reorder_level) || []

  if (lowStock.length === 0 && (!expiring || expiring.length === 0)) {
    return NextResponse.json({ ok: true, message: 'Nothing to report today', sent: false })
  }

  const lowStockRows = lowStock
    .map((i) => `<tr><td style="padding:4px 8px;">${i.name}</td><td style="padding:4px 8px;">${i.stock} ${i.unit}</td><td style="padding:4px 8px;">reorder at ${i.reorder_level}</td></tr>`)
    .join('')

  const expiringRows = (expiring || [])
    .map(
      (b: any) =>
        `<tr><td style="padding:4px 8px;">${b.item_name}</td><td style="padding:4px 8px;">${b.quantity} ${b.unit}</td><td style="padding:4px 8px;">expires ${new Date(b.expiry_date).toLocaleDateString('en-GB')} (${b.days_until_expiry}d)</td></tr>`
    )
    .join('')

  const html = `
    <h2>Procare Clinic — Daily Inventory Alert</h2>
    ${
      lowStock.length > 0
        ? `<h3>Low Stock (${lowStock.length})</h3><table>${lowStockRows}</table>`
        : ''
    }
    ${
      expiring && expiring.length > 0
        ? `<h3>Expiring Soon (${expiring.length})</h3><table>${expiringRows}</table>`
        : ''
    }
  `

  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL_TO) {
    return NextResponse.json({
      ok: false,
      message: 'RESEND_API_KEY or ALERT_EMAIL_TO not configured — skipping send',
      wouldHaveSent: { lowStock: lowStock.length, expiring: expiring?.length ?? 0 },
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || 'Procare Clinic <alerts@yourclinic.com>',
      to: process.env.ALERT_EMAIL_TO,
      subject: `Inventory Alert: ${lowStock.length} low stock, ${expiring?.length ?? 0} expiring`,
      html,
    }),
  })

  const sent = res.ok

  return NextResponse.json({
    ok: sent,
    sent,
    lowStockCount: lowStock.length,
    expiringCount: expiring?.length ?? 0,
  })
}
