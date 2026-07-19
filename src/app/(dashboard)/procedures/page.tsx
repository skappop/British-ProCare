import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProceduresPage() {
  const supabase = await createClient()

  const { data: procedures } = await supabase
  .from('procedures')
  .select('*, procedure_bom(count)')
  .eq('is_active', true)
  .order('category')
  .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-ink-strong">Procedures</h1>
        <Link
          href="/procedures/new"
          className="bg-teal hover:bg-teal-deep text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          + New Procedure
        </Link>
      </div>

      <div className="bg-white rounded-card shadow-soft overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-ink/8 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Procedure</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Base Fee</th>
              <th className="px-4 py-3 font-medium">BOM Items</th>
            </tr>
          </thead>
          <tbody>
            {procedures?.map((p: any) => (
              <tr key={p.id} className="border-b border-ink/5 last:border-0 hover:bg-marble/60">
                <td className="px-4 py-3">
                  <Link href={`/procedures/${p.id}`} className="text-ink-strong hover:text-teal-deep font-medium">
                    {p.name}
                  </Link>
                  <div className="text-ink/40 text-xs font-mono">{p.code}</div>
                </td>
                <td className="px-4 py-3 text-ink/70 capitalize">{p.category}</td>
                <td className="px-4 py-3 font-mono text-ink-strong">
                  {p.base_fee ? `EGP ${p.base_fee}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-sage/20 text-ink-strong text-xs px-2 py-1 rounded-full">
                    {p.procedure_bom?.[0]?.count ?? 0} items
                  </span>
                </td>
              </tr>
            ))}
            {(!procedures || procedures.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink/40">
                  No procedures yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}