import { notFound } from 'next/navigation'
import { getContainers } from '../../data'
import ContainerCheck from './ContainerCheck'

export const dynamic = 'force-dynamic'

/** One container's end-of-day check. The container's QR sticker opens this. */
export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ready, containers } = await getContainers()
  if (!ready) {
    return (
      <p className="mx-auto max-w-xl rounded-card bg-white p-6 text-sm text-ink/60 shadow-soft">
        Stock check is not set up yet — run <span className="font-mono">migrations/18_stock_routines.sql</span> in Supabase.
      </p>
    )
  }
  const container = containers.find((c) => c.id === id)
  if (!container) notFound()
  // After saving, offer the next container nobody has checked today.
  const index = containers.findIndex((c) => c.id === id)
  const next =
    [...containers.slice(index + 1), ...containers.slice(0, index)].find((c) => !c.checked_today) ?? null
  return <ContainerCheck key={container.id} container={container} next={next ? { id: next.id, name: next.name } : null} />
}
