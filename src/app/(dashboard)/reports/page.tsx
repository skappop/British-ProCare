import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/auth/role'
import { fetchAll } from '@/lib/supabase/fetchAll'

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  restorative: 'Restorative',
  endo: 'Endo',
  surgical: 'Surgical',
  prosthetic: 'Prosthetic',
  ortho: 'Ortho',
}

function monthRange(monthParam?: string) {
  const now = new Date()
  const [y, m] = (monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start, end, label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }
}

function dateKey(d: string | Date) {
  const dt = new Date(d)
  return dt.toISOString().slice(0, 10)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const authorized = await isOwner()
  if (!authorized) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-sm text-ink/50">
          Financial reports are restricted to the clinic owner.
        </p>
      </div>
    )
  }

  const { month } = await searchParams
  const { start, end, label } = monthRange(month)
  const monthValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`

  const supabase = await createClient()

  // All of the month, however busy (not just the first 1,000 rows).
  const [{ data: visits }, { data: payments }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('visits')
        .select('id, visit_date, fee_charged, visit_procedures(procedures(name, category, base_fee))')
        .gte('visit_date', start.toISOString())
        .lt('visit_date', end.toISOString())
        .order('visit_date')
        .order('id')
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from('payments')
        .select('amount, paid_at')
        .gte('paid_at', start.toISOString())
        .lt('paid_at', end.toISOString())
        .order('paid_at')
        .order('id')
        .range(from, to)
    ),
  ])

  const totalCharged = (visits || []).reduce((s, v: any) => s + (Number(v.fee_charged) || 0), 0)
  const totalCollected = (payments || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0)

  // Daily collected totals
  const dailyCollected: Record<string, number> = {}
  for (const p of (payments as any[]) || []) {
    const key = dateKey(p.paid_at)
    dailyCollected[key] = (dailyCollected[key] || 0) + Number(p.amount)
  }
  const maxDaily = Math.max(1, ...Object.values(dailyCollected))
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400000)
  const dailyBars = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = dateKey(d)
    return { day: d.getDate(), amount: dailyCollected[key] || 0 }
  })

  // Busiest days by visit count
  const visitsByDay: Record<string, number> = {}
  for (const v of (visits as any[]) || []) {
    const key = dateKey(v.visit_date)
    visitsByDay[key] = (visitsByDay[key] || 0) + 1
  }
  const busiestDays = Object.entries(visitsByDay)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Revenue by category (approximation: sum of procedure base_fee for procedures logged this month)
  const categoryRevenue: Record<string, number> = {}
  for (const v of (visits as any[]) || []) {
    for (const vp of v.visit_procedures || []) {
      const cat = vp.procedures?.category || 'general'
      categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (Number(vp.procedures?.base_fee) || 0)
    }
  }
  const categoryEntries = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1])
  const maxCategory = Math.max(1, ...categoryEntries.map(([, v]) => v))

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Revenue Reports</p>
          <h1 className="font-display text-3xl text-ink-strong mt-1.5">{label}</h1>
        </div>
        <form className="flex gap-2">
          <input
            type="month"
            name="month"
            defaultValue={monthValue}
            className="rounded-control border border-ink/15 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button
            type="submit"
            className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-card shadow-soft p-5">
          <p className="text-xs text-ink/45 uppercase tracking-wider">Charged</p>
          <p className="font-mono text-2xl mt-2 text-ink-strong">EGP {totalCharged.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-card shadow-soft p-5">
          <p className="text-xs text-ink/45 uppercase tracking-wider">Collected</p>
          <p className="font-mono text-2xl mt-2 text-success">EGP {totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-card shadow-soft p-5">
          <p className="text-xs text-ink/45 uppercase tracking-wider">Outstanding (this month)</p>
          <p className="font-mono text-2xl mt-2 text-danger">
            EGP {(totalCharged - totalCollected).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-card shadow-soft p-5">
          <p className="text-xs text-ink/45 uppercase tracking-wider">Visits</p>
          <p className="font-mono text-2xl mt-2 text-ink-strong">{visits?.length ?? 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-soft p-6">
        <h2 className="font-display text-lg text-ink-strong mb-1">Daily Collected Income</h2>
        <div className="gold-hairline mb-6" />
        <div className="flex items-end gap-[3px] h-40">
          {dailyBars.map((b) => (
            <div key={b.day} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div
                className="w-full bg-teal/70 hover:bg-teal rounded-t-sm transition-colors"
                style={{ height: `${Math.max(2, (b.amount / maxDaily) * 100)}%` }}
                title={`Day ${b.day}: EGP ${b.amount.toLocaleString()}`}
              />
              <span className="text-[9px] text-ink/30 font-mono">{b.day}</span>
            </div>
          ))}
          {dailyBars.every((b) => b.amount === 0) && (
            <p className="text-sm text-ink/40 mx-auto">No payments collected this month.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="font-display text-lg text-ink-strong mb-1">Revenue by Category</h2>
          <p className="text-xs text-ink/40 mb-4">Estimated from procedure base fees logged this month</p>
          <div className="space-y-3">
            {categoryEntries.map(([cat, amount]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ink-strong capitalize">{CATEGORY_LABELS[cat] || cat}</span>
                  <span className="font-mono text-ink/60">EGP {amount.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-marble rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-deep rounded-full"
                    style={{ width: `${(amount / maxCategory) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {categoryEntries.length === 0 && (
              <p className="text-sm text-ink/40 text-center py-6">No procedures logged this month.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="font-display text-lg text-ink-strong mb-1">Busiest Days</h2>
          <div className="gold-hairline mb-4" />
          <div className="divide-y divide-ink/5">
            {busiestDays.map(([day, count]) => (
              <div key={day} className="py-3 flex justify-between items-center">
                <span className="text-sm text-ink-strong">
                  {new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                <span className="font-mono text-sm text-ink/60">{count} visit{count > 1 ? 's' : ''}</span>
              </div>
            ))}
            {busiestDays.length === 0 && (
              <p className="text-sm text-ink/40 text-center py-6">No visits this month.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
