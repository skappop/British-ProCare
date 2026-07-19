// Single source of truth for tooth status → colours + labels, shared by the
// React glyph and the offline preview. Colours are the "Marble & Gold" tokens
// expressed as literals so the SVG is self-contained.

export type ToothStatus = 'healthy' | 'treated' | 'missing' | 'planned' | 'watch'

export type ToothStyle = {
  fill: string
  stroke: string
  line: string // cervix + occlusal detail
  label: string
}

export const TOOTH_STYLE: Record<ToothStatus, ToothStyle> = {
  healthy: { fill: '#FBFAF7', stroke: '#AEB6BD', line: '#CBD1D6', label: 'Healthy' },
  treated: { fill: '#E3F4F2', stroke: '#2FA6A2', line: '#7BD0CC', label: 'Treated' },
  planned: { fill: '#F4EBDA', stroke: '#A07B4A', line: '#CBB081', label: 'Planned' },
  watch: { fill: '#F6E5E0', stroke: '#C0654F', line: '#D69A8B', label: 'Watch' },
  missing: { fill: 'none', stroke: '#D2D6DA', line: '#D2D6DA', label: 'Missing' },
}

export const STATUS_ORDER: ToothStatus[] = ['healthy', 'treated', 'planned', 'watch', 'missing']
