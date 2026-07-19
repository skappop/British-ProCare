import { toothPaths, CROWN_TOP, CROWN_BOT, VIEW_H, type ToothType } from './toothGeometry'
import { TOOTH_STYLE, type ToothStatus } from './toothStatus'

// Draws a single tooth. Authored upper-orientation; lower teeth flip vertically.
export default function ToothGlyph({
  type,
  status,
  upper,
  primary = false,
  scale = 1,
}: {
  type: ToothType
  status: ToothStatus
  upper: boolean
  primary?: boolean
  scale?: number
}) {
  const p = toothPaths(type, primary)
  const st = TOOTH_STYLE[status]
  const sw = 1.6
  const hcx = p.width / 2
  const hcy = (CROWN_TOP + CROWN_BOT) / 2

  const body = (
    <>
      {p.roots.map((d, i) => (
        <path key={`r${i}`} d={d} fill={st.fill} stroke={st.stroke} strokeWidth={sw} strokeLinejoin="round" />
      ))}
      <path d={p.crown} fill={st.fill} stroke={st.stroke} strokeWidth={sw} strokeLinejoin="round" />
      {st.fill !== 'none' && (
        <path
          d={p.crown}
          transform={`translate(${hcx} ${hcy}) scale(0.74) translate(${-hcx} ${-hcy})`}
          fill="#ffffff"
          opacity={0.45}
        />
      )}
      <path d={p.cervix} fill="none" stroke={st.line} strokeWidth={1.1} />
      {p.occlusal.map((d, i) => (
        <path key={`o${i}`} d={d} fill="none" stroke={st.line} strokeWidth={1.1} strokeLinecap="round" />
      ))}
      {status === 'missing' && (
        <>
          <line x1={4} y1={12} x2={p.width - 4} y2={VIEW_H - 8} stroke="#C0654F" strokeWidth={1.6} opacity={0.5} />
          <line x1={p.width - 4} y1={12} x2={4} y2={VIEW_H - 8} stroke="#C0654F" strokeWidth={1.6} opacity={0.5} />
        </>
      )}
    </>
  )

  return (
    <svg
      viewBox={`0 0 ${p.width} ${VIEW_H}`}
      width={p.width * scale}
      height={VIEW_H * scale}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {upper ? body : <g transform={`translate(0 ${VIEW_H}) scale(1 -1)`}>{body}</g>}
    </svg>
  )
}
