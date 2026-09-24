// Who can open what. Used by the menu (to show only what someone can use) and
// by every page (so typing an address does not get around it). Safe to import
// from client code: no server calls in here.

export type StaffRole = 'owner' | 'dentist' | 'assistant'

/** "assistant" in the database is the front desk. */
export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  dentist: 'Dentist',
  assistant: 'Reception',
}

export const ROLE_SUMMARY: Record<StaffRole, string> = {
  owner: 'Everything, including the dashboard, money, reports, staff and settings.',
  dentist: 'Patients, charting, appointments, lab work and stock — no dashboard, no fees or payments.',
  assistant: 'Walk-in desk, appointments, patients and taking payments — no dashboard, reports or settings.',
}

/** Where each role lands after signing in, or when sent away from a page. */
export const HOME: Record<StaffRole, string> = {
  owner: '/',
  dentist: '/patients',
  assistant: '/reception',
}

const ALL: StaffRole[] = ['owner', 'dentist', 'assistant']

// Most specific first. Anything not listed is open to every role.
const RULES: [prefix: string, roles: StaffRole[]][] = [
  ['/inventory/purchase-orders', ['owner']], // supplier prices
  ['/inventory', ['owner', 'dentist']],
  ['/procedures', ['owner']], // the price list
  ['/reception', ['owner', 'assistant']], // includes taking payment
  ['/reports', ['owner']],
  ['/staff', ['owner']],
  ['/settings', ['owner']],
  ['/admin', ['owner']],
  ['/appointments', ALL],
  ['/recall', ALL],
  ['/patients', ALL],
  ['/chart', ALL],
  ['/lab-cases', ALL],
  ['/stock/setup', ['owner', 'dentist']], // deciding what each container holds
  ['/stock', ALL], // the closing routine: whoever closes up does it
]

/** A role we do not recognise is treated as the front desk, the least privileged. */
export function asRole(role: string | null | undefined): StaffRole {
  return role === 'owner' || role === 'dentist' ? role : 'assistant'
}

export function canOpen(role: string | null | undefined, path: string): boolean {
  const r = asRole(role)
  if (r === 'owner') return true
  if (path === '/') return false // the dashboard: takings and totals
  if (/^\/patients\/[^/]+\/billing/.test(path)) return r === 'assistant'
  const rule = RULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return rule ? rule[1].includes(r) : true
}
