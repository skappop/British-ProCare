'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Package,
  Stethoscope,
  TrendingUp,
  CalendarDays,
  BellRing,
  FlaskConical,
  UserCog,
  DoorOpen,
  Sheet,
} from 'lucide-react'

const NAV = [
  { href: '/reception', label: 'Walk-In', icon: DoorOpen },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/recall', label: 'Recall', icon: BellRing },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/lab-cases', label: 'Lab Cases', icon: FlaskConical },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/procedures', label: 'Procedures', icon: Stethoscope },
  { href: '/reports', label: 'Reports', icon: TrendingUp },
  { href: '/staff', label: 'Staff', icon: UserCog },
  { href: '/admin/sheets', label: 'Google Sheets', icon: Sheet },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3 text-sm">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-control transition-colors duration-150 ${
              active
                ? 'bg-white/[0.06] text-gold-light'
                : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2.5px] rounded-full bg-gradient-to-b from-gold-light to-gold-deep origin-center transition-[opacity,transform] duration-200 ${
                active ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'
              }`}
            />
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
