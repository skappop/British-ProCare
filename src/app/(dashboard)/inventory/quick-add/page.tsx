import Link from 'next/link'
import QuickAddForm from './QuickAddForm'

const CATEGORIES = [
  'bracket', 'wire', 'elastic', 'power_chain', 'spring', 'ligature',
  'band', 'composite', 'impression', 'endo', 'bond', 'anesthetic',
  'disposable', 'other',
]
const UNITS = ['pc', 'g', 'ml', 'pack', 'cartridge']

export default function QuickAddPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Inventory</p>
          <h1 className="font-display text-2xl text-ink-strong mt-1">Quick Add</h1>
        </div>
        <Link href="/inventory" className="text-sm text-teal-deep hover:underline">
          ← Back to inventory
        </Link>
      </div>
      <p className="text-sm text-ink/55 max-w-2xl">
        Add many items at once — just the essentials. A unique SKU is generated automatically for each,
        and you can print all their QR labels from the QR Labels page afterwards.
      </p>
      <QuickAddForm categories={CATEGORIES} units={UNITS} />
    </div>
  )
}
