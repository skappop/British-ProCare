// Framework-agnostic tooth geometry for the odontogram.
// Each tooth is authored in "upper orientation" (root at the top, crown at the
// bottom) inside a local viewBox of `width` x VIEW_H. Lower-arch teeth reuse the
// same paths flipped vertically. Keeping this pure (no JSX) means the exact same
// silhouettes can be previewed/rasterised and rendered in React from one source.

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

export const VIEW_H = 78

// Vertical anatomy (upper orientation)
const TIP = 6 // root apex
const ROOT_BASE = 46 // where roots fan into the crown (overlaps crown top)
export const CROWN_TOP = 38
export const CROWN_BOT = 73
const CERVIX = 41 // gum line

export type ToothPaths = {
  width: number
  roots: string[]
  crown: string
  cervix: string
  occlusal: string[]
}

function num(n: number): string {
  return Number(n.toFixed(2)).toString()
}

// A single rounded-apex root cone centred on `cx`.
function root(cx: number, hw: number, tipY = TIP, baseY = ROOT_BASE): string {
  const mid = baseY - (baseY - tipY) * 0.52
  return [
    `M${num(cx - hw)},${num(baseY)}`,
    `C${num(cx - hw)},${num(mid)} ${num(cx - hw * 0.4)},${num(tipY + 4)} ${num(cx)},${num(tipY)}`,
    `C${num(cx + hw * 0.4)},${num(tipY + 4)} ${num(cx + hw)},${num(mid)} ${num(cx + hw)},${num(baseY)}`,
    'Z',
  ].join(' ')
}

function roundedCrown(w: number, rTop: number, rBot: number): string {
  const x = 3
  const right = w - 3
  const yT = CROWN_TOP
  const yB = CROWN_BOT
  return [
    `M${num(x + rTop)},${num(yT)}`,
    `L${num(right - rTop)},${num(yT)}`,
    `Q${num(right)},${num(yT)} ${num(right)},${num(yT + rTop)}`,
    `L${num(right)},${num(yB - rBot)}`,
    `Q${num(right)},${num(yB)} ${num(right - rBot)},${num(yB)}`,
    `L${num(x + rBot)},${num(yB)}`,
    `Q${num(x)},${num(yB)} ${num(x)},${num(yB - rBot)}`,
    `L${num(x)},${num(yT + rTop)}`,
    `Q${num(x)},${num(yT)} ${num(x + rTop)},${num(yT)}`,
    'Z',
  ].join(' ')
}

function canineCrown(w: number): string {
  const cx = w / 2
  return [
    `M4,${num(CROWN_TOP + 6)}`,
    `Q4,${num(CROWN_TOP)} 9,${num(CROWN_TOP)}`,
    `L${num(w - 9)},${num(CROWN_TOP)}`,
    `Q${num(w - 4)},${num(CROWN_TOP)} ${num(w - 4)},${num(CROWN_TOP + 6)}`,
    `L${num(w - 5)},${num(CROWN_BOT - 14)}`,
    `Q${num(w - 6)},${num(CROWN_BOT - 4)} ${num(cx)},${num(CROWN_BOT)}`,
    `Q6,${num(CROWN_BOT - 4)} 5,${num(CROWN_BOT - 14)}`,
    'Z',
  ].join(' ')
}

function cervixArc(w: number): string {
  return `M4,${num(CERVIX)} Q${num(w / 2)},${num(CERVIX + 4)} ${num(w - 4)},${num(CERVIX)}`
}

const WIDTHS: Record<ToothType, number> = {
  incisor: 22,
  canine: 24,
  premolar: 28,
  molar: 38,
}

const PRIMARY_WIDTHS: Record<ToothType, number> = {
  incisor: 18,
  canine: 20,
  premolar: 22,
  molar: 30,
}

export function toothPaths(type: ToothType, primary = false): ToothPaths {
  const w = (primary ? PRIMARY_WIDTHS : WIDTHS)[type]
  const cx = w / 2

  switch (type) {
    case 'incisor':
      return {
        width: w,
        roots: [root(cx, 5)],
        crown: roundedCrown(w, 4, 6),
        cervix: cervixArc(w),
        occlusal: [],
      }
    case 'canine':
      return {
        width: w,
        roots: [root(cx, 5.5, TIP - 1)],
        crown: canineCrown(w),
        cervix: cervixArc(w),
        occlusal: [],
      }
    case 'premolar':
      return {
        width: w,
        roots: [root(cx, 7)],
        crown: roundedCrown(w, 6, 9),
        cervix: cervixArc(w),
        occlusal: [
          `M8,${num(CROWN_BOT - 9)} Q${num(cx)},${num(CROWN_BOT - 4)} ${num(w - 8)},${num(CROWN_BOT - 9)}`,
        ],
      }
    case 'molar':
    default:
      return {
        width: w,
        roots: [root(w * 0.3, 7, TIP + 1), root(w * 0.7, 7, TIP + 1)],
        crown: roundedCrown(w, 7, 10),
        cervix: cervixArc(w),
        occlusal: [
          `M7,${num(CROWN_BOT - 10)} Q${num(cx)},${num(CROWN_BOT - 5)} ${num(w - 7)},${num(CROWN_BOT - 10)}`,
          `M${num(cx)},${num(CROWN_BOT - 17)} L${num(cx)},${num(CROWN_BOT - 4)}`,
        ],
      }
  }
}

// ---- FDI arch layouts -------------------------------------------------------

// Permanent dentition (FDI two-digit notation)
export const PERMANENT_UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
export const PERMANENT_LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']

// Primary dentition (FDI: quadrants 5–8)
export const PRIMARY_UPPER = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65']
export const PRIMARY_LOWER = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']

export function toothTypeFor(fdi: string, primary: boolean): ToothType {
  const pos = parseInt(fdi[1], 10)
  if (primary) {
    if (pos <= 2) return 'incisor'
    if (pos === 3) return 'canine'
    return 'molar' // primary teeth 4 & 5 are molars (no premolars)
  }
  if (pos <= 2) return 'incisor'
  if (pos === 3) return 'canine'
  if (pos <= 5) return 'premolar'
  return 'molar'
}
