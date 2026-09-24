import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { isOwner, guardPage } from '@/lib/auth/role'
import { DoorOpen } from 'lucide-react'
import StorageGauge from '@/components/StorageGauge'

export default async function DashboardPage() {
  // Takings and totals: the owner's view. Everyone else starts on their own page.
  await guardPage('/')

  const supabase = await createClient()
  const canSeeFinancials = await isOwner()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const [
    { data: todayVisits },
    { data: todayPayments },
    { count: patientCount },
    { data: allItems },
    { data: recentVisits },
    { data: todayAppointments },
  ] = await Promise.all([
    supabase.from('visits').select('id').gte('visit_date', todayStart.toISOString()),
    canSeeFinancials
      ? supabase.from('payments').select('amount').gte('paid_at', todayStart.toISOString())
      : Promise.resolve({ data: null }),
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('inventory').select('id, name, stock, unit, reorder_level').eq('is_active', true),
    supabase
      .from('visits')
      .select('id, visit_date, fee_charged, notes, patients(full_name)')
      .order('visit_date', { ascending: false })
      .limit(6),
    supabase
      .from('appointments')
      .select('id, scheduled_at, status, patients(full_name)')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true }),
  ])

  const lowStock = allItems?.filter((i) => i.stock <= i.reorder_level) || []
  const todayRevenue = todayPayments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { label: "Today's Visits", value: todayVisits?.length ?? 0 },
    ...(canSeeFinancials
      ? [{ label: "Today's Revenue", value: `EGP ${todayRevenue.toLocaleString()}` }]
      : []),
    { label: 'Total Patients', value: patientCount ?? 0 },
    { label: 'Low Stock Items', value: lowStock.length, danger: lowStock.length > 0 },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="font-display text-3xl text-ink-strong mt-1.5">{greeting}, Doctor</h1>
        </div>
        <Link
          href="/reception"
          className="group inline-flex items-center gap-2.5 rounded-control bg-marquina hover:bg-marquina-soft text-gold-light px-5 py-3 shadow-soft transition-colors"
        >
          <DoorOpen size={18} strokeWidth={1.8} />
          <span className="font-display tracking-wide uppercase text-sm">Start Walk-In</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 reveal-stagger">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-card shadow-soft card-lift p-5">
            <p className="text-xs text-ink/45 uppercase tracking-wider">{s.label}</p>
            <p className={`font-mono text-2xl mt-2 ${s.danger ? 'text-danger' : 'text-ink-strong'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-card shadow-soft p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg text-ink-strong">Today's Appointments</h2>
            <Link href="/appointments" className="text-xs text-teal-deep hover:underline">
              View all →
            </Link>
          </div>
          <div className="gold-hairline mb-4" />
          <div className="divide-y divide-ink/5">
            {todayAppointments?.map((a: any) => (
              <div key={a.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <p className="text-sm text-ink-strong font-medium">{a.patients?.full_name}</p>
                  <p className="text-xs text-ink/40 font-mono mt-0.5">
                    {new Date(a.scheduled_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${
                    a.status === 'completed'
                      ? 'bg-success/10 text-success'
                      : a.status === 'cancelled' || a.status === 'no_show'
                        ? 'bg-ink/10 text-ink/40'
                        : 'bg-teal/10 text-teal-deep'
                  }`}
                >
                  {a.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {(!todayAppointments || todayAppointments.length === 0) && (
              <p className="py-6 text-center text-sm text-ink/40">Nothing booked today.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="font-display text-lg text-ink-strong mb-1">Recent Visits</h2>
          <div className="gold-hairline mb-4" />
          <div className="divide-y divide-ink/5">
            {recentVisits?.map((v: any) => (
              <div key={v.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm text-ink-strong font-medium">{v.patients?.full_name}</p>
                  <p className="text-xs text-ink/40 font-mono mt-0.5">
                    {new Date(v.visit_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
                {v.fee_charged && canSeeFinancials && (
                  <span className="font-mono text-sm text-ink/70">EGP {v.fee_charged}</span>
                )}
              </div>
            ))}
            {(!recentVisits || recentVisits.length === 0) && (
              <p className="py-6 text-center text-sm text-ink/40">No visits yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="font-display text-lg text-ink-strong mb-1">Stock Alerts</h2>
          <div className="gold-hairline mb-4" />
          <div className="divide-y divide-ink/5">
            {lowStock.map((i) => (
              <div key={i.id} className="py-3 flex justify-between items-center">
                <p className="text-sm text-ink-strong">{i.name}</p>
                <span className="font-mono text-sm text-danger">
                  {i.stock} {i.unit} left
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="py-6 text-center text-sm text-success">All stock levels healthy ✦</p>
            )}
          </div>
          <Link href="/inventory" className="block text-center text-xs text-teal-deep hover:underline mt-4">
            Manage inventory →
          </Link>
        </div>
      </div>

      <StorageGauge />
    </div>
  )
}
