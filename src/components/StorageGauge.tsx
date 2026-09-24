import { createClient } from '@/lib/supabase/server'

// Supabase free plan: 1 GB of files, 500 MB of database.
const IMAGES_LIMIT = 1_000_000_000
const DATABASE_LIMIT = 500_000_000

function mb(bytes: number) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`
}

function Bar({ label, used, limit, detail }: { label: string; used: number; limit: number; detail?: string }) {
  const pct = Math.min(100, (used / limit) * 100)
  const tone = pct >= 85 ? 'bg-danger' : pct >= 70 ? 'bg-gold' : 'bg-teal'
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-strong">{label}</span>
        <span className="font-mono text-xs text-ink/55">
          {mb(used)} of {mb(limit)} · {Math.round(pct)}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      {detail && <p className="mt-1 text-xs text-ink/45">{detail}</p>}
    </div>
  )
}

/**
 * How full the free plan is, for the owner. Warns early enough to act —
 * shrink more, move images to cheaper storage, or upgrade — before uploads
 * start failing.
 */
export default async function StorageGauge() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('storage_usage')
  const row = (Array.isArray(data) ? data[0] : data) as
    | { images_bytes: number; images_count: number; database_bytes: number }
    | null

  if (error || !row) {
    return (
      <div className="rounded-card bg-white p-5 text-sm text-ink/50 shadow-soft">
        Online storage: run <span className="font-mono">migrations/17_storage_usage.sql</span> in Supabase to see how full the free plan is.
      </div>
    )
  }

  const images = Number(row.images_bytes) || 0
  const database = Number(row.database_bytes) || 0
  const worst = Math.max(images / IMAGES_LIMIT, database / DATABASE_LIMIT)

  return (
    <div className="space-y-4 rounded-card bg-white p-6 shadow-soft">
      <div>
        <h2 className="font-display text-lg text-ink-strong">Online storage</h2>
        <p className="text-xs text-ink/45">Supabase free plan</p>
      </div>
      <Bar
        label="Patient images"
        used={images}
        limit={IMAGES_LIMIT}
        detail={`${Number(row.images_count).toLocaleString()} files${
          row.images_count ? ` · about ${mb(images / Number(row.images_count))} each` : ''
        }`}
      />
      <Bar label="Records (database)" used={database} limit={DATABASE_LIMIT} />
      {worst >= 0.8 && (
        <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
          Getting full. Before it reaches 100%, move images to cheaper storage or upgrade the Supabase plan — uploads will fail once it is full.
        </p>
      )}
    </div>
  )
}
