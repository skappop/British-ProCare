import { createProcedure } from '../actions'

export default async function NewProcedurePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink-strong mb-6">New Procedure</h1>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      <form action={createProcedure} className="bg-white rounded-card shadow-soft p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Code *</label>
            <input
              name="code"
              required
              placeholder="ORTHO-WIRE-CHG"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Name *</label>
            <input
              name="name"
              required
              placeholder="Wire Change"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Category</label>
            <select
              name="category"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="general">General</option>
              <option value="ortho">Ortho</option>
              <option value="endo">Endo</option>
              <option value="surgical">Surgical</option>
              <option value="restorative">Restorative</option>
              <option value="prosthetic">Prosthetic</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/70">Base Fee (EGP)</label>
            <input
              name="base_fee"
              type="number"
              step="0.01"
              className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-2.5 text-sm font-medium transition-colors"
        >
          Create Procedure
        </button>
      </form>
    </div>
  )
}