import { createClient } from '@/lib/supabase/server'
import { createSupplier } from '../poActions'
import Link from 'next/link'

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: suppliers } = await supabase.from('suppliers').select('*').order('name')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/inventory" className="text-xs text-teal-deep hover:underline">
            ← Inventory
          </Link>
          <h1 className="font-display text-2xl text-ink-strong mt-1">Suppliers</h1>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      <form action={createSupplier} className="bg-white rounded-card shadow-soft p-6 space-y-4 mb-6">
        <h2 className="font-display text-base text-ink-strong">Add Supplier</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Name *</label>
            <input
              name="name"
              required
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Phone</label>
            <input
              name="phone"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">WhatsApp</label>
            <input
              name="whatsapp"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Email</label>
            <input
              name="email"
              type="email"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink/70">Notes</label>
          <input
            name="notes"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>
        <button
          type="submit"
          className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          Add Supplier
        </button>
      </form>

      <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
        {suppliers?.map((s) => (
          <div key={s.id} className="px-4 py-3">
            <p className="text-sm text-ink-strong font-medium">{s.name}</p>
            <div className="flex gap-4 text-xs text-ink/50 font-mono mt-1">
              {s.phone && <span>{s.phone}</span>}
              {s.whatsapp && <span>WA: {s.whatsapp}</span>}
              {s.email && <span>{s.email}</span>}
            </div>
          </div>
        ))}
        {(!suppliers || suppliers.length === 0) && (
          <div className="px-4 py-8 text-center text-ink/40 text-sm">No suppliers yet.</div>
        )}
      </div>
    </div>
  )
}
