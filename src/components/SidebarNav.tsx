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
  Settings as SettingsIcon,
} from 'lucide-react'

interface NavConfig {
  features_enabled?: {
    appointments?: boolean
    recall?: boolean
    inventory?: boolean
    lab_cases?: boolean
    staff?: boolean
    reports?: boolean
  }
  google_sheets_enabled?: boolean
}

interface SidebarNavProps {
  config?: NavConfig | null
}

export default function SidebarNav({ config }: SidebarNavProps) {
  const pathname = usePathname()

  // Define all possible navigation items with their visibility logic
  const NAV = [
    { href: '/reception', label: 'Walk-In', icon: DoorOpen, visible: true },
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    {
      href: '/appointments',
      label: 'Appointments',
      icon: CalendarDays,
      visible: config?.features_enabled?.appointments !== false
    },
    {
      href: '/recall',
      label: 'Recall',
      icon: BellRing,
      visible: config?.features_enabled?.recall !== false
    },
    { href: '/patients', label: 'Patients', icon: Users, visible: true },
    {
      href: '/lab-cases',
      label: 'Lab Cases',
      icon: FlaskConical,
      visible: config?.features_enabled?.lab_cases !== false
    },
    {
      href: '/inventory',
      label: 'Inventory',
      icon: Package,
      visible: config?.features_enabled?.inventory !== false
    },
    { href: '/procedures', label: 'Procedures', icon: Stethoscope, visible: true },
    {
      href: '/reports',
      label: 'Reports',
      icon: TrendingUp,
      visible: config?.features_enabled?.reports !== false
    },
    {
      href: '/staff',
      label: 'Staff',
      icon: UserCog,
      visible: config?.features_enabled?.staff !== false
    },
    {
      href: '/admin/sheets',
      label: 'Google Sheets',
      icon: Sheet,
      visible: config?.google_sheets_enabled === true
    },
    { href: '/settings', label: 'Settings', icon: SettingsIcon, visible: true },
  ]

  // Filter to only visible items
  const visibleNav = NAV.filter(item => item.visible)

  return (
    <nav className="flex flex-col gap-1 px-3 text-sm">
      {visibleNav.map(({ href, label, icon: Icon }) => {
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
