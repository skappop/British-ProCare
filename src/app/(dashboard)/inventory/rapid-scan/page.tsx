import { redirect } from 'next/navigation'

// Replaced by the closing-routine stock check (one sticker per container,
// checked at the end of the day), which lives under /stock.
export default function Page() {
  redirect('/stock')
}
