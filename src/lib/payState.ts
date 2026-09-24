// Where a seen patient stands with payment, the same on every screen that
// shows it (walk-in desk, appointments board, waiting list). Safe to import
// from client code.

export type PayState =
  | 'owes' // has something to pay
  | 'price_missing' // today's visit has no price yet: reception must set it
  | 'unknown' // the balance could not be read: never assume paid
  | 'paid' // charged and covered
  | 'no_charge' // nothing to charge (price set to 0, or nothing recorded)

/** Still on reception's list today. */
export function needsReception(state: PayState | null | undefined) {
  return state === 'owes' || state === 'price_missing' || state === 'unknown'
}

export function payLabel(state: PayState | null | undefined, due: number | null | undefined) {
  switch (state) {
    case 'owes':
      return `To pay · EGP ${Math.round(due ?? 0).toLocaleString()}`
    case 'price_missing':
      return 'Price not set'
    case 'unknown':
      return 'Check payment'
    case 'no_charge':
      return 'No charge'
    case 'paid':
      return 'Paid ✓'
    default:
      return ''
  }
}
