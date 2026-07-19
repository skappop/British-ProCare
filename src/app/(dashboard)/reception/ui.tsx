'use client'

// Small presentational primitives shared across the Walk-In steps.
// Styling is derived entirely from the existing "Marble & Gold" tokens in
// globals.css so the flow feels native to the rest of the app.

import { ChevronLeft } from 'lucide-react'

export function StepCard({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-card shadow-soft p-6 sm:p-8">
      <div className="flex items-start gap-3 mb-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 -ml-1 flex h-7 w-7 items-center justify-center rounded-control text-ink/40 hover:text-teal-deep hover:bg-marble transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div>
          <h2 className="font-display text-xl text-ink-strong leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="gold-hairline my-5" />
      {children}
    </div>
  )
}

export function Chip({
  label,
  sublabel,
  active,
  onClick,
  mono = false,
}: {
  label: string
  sublabel?: string
  active: boolean
  onClick: () => void
  mono?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3.5 py-2 rounded-full border transition-colors ${
        mono ? 'font-mono text-xs' : ''
      } ${
        active
          ? 'bg-teal text-white border-teal'
          : 'bg-white text-ink/70 border-ink/15 hover:border-teal'
      }`}
    >
      {label}
      {sublabel ? <span className="opacity-60 ml-1">· {sublabel}</span> : null}
    </button>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-wider text-ink/40 font-mono">
      {children}
    </span>
  )
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
  full = false,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  full?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${
        full ? 'w-full' : ''
      } bg-teal hover:bg-teal-deep disabled:bg-ink/20 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-control transition-colors font-medium`}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm px-4 py-2.5 rounded-control text-ink/60 hover:text-ink-strong hover:bg-marble transition-colors"
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink/70">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal'
export const inputMonoClass =
  'w-full rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal'
