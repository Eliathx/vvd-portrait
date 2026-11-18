// Turning ONE color the user picked into a 3-tone ramp (light, mid, dark).
//
// We work in HSL because "lighter" and "darker" are just the L channel there.
// On top of that we do a little hue shifting, the classic pixel-art trick:
// highlights lean warm (toward yellow) and shadows lean cool (toward blue),
// so the shading looks painted instead of just "the same color, greyer".

export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

/** RGB 0–255 → [hue 0–360, saturation 0–1, lightness 0–1]. */
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l] // a grey: no hue
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Nudge hue `h` up to `amount` degrees toward `target`, the short way round the wheel. */
function hueToward(h: number, target: number, amount: number): number {
  const diff = ((target - h + 540) % 360) - 180
  const step = Math.sign(diff) * Math.min(Math.abs(diff), amount)
  return (h + step + 360) % 360
}

// ── HSV, for the color picker ────────────────────────────────────────────────
// The picker's square is saturation (x) × value/brightness (y), and its strip is
// hue — HSV maps onto that layout directly.

export type HSV = { h: number; s: number; v: number } // h 0–360, s and v 0–1

export function hsvToHex({ h, s, v }: HSV): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return rgbToHex([f(5), f(3), f(1)])
}

export function hexToHsv(hex: string): HSV {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

/**
 * The artist's own shading for a color group: the tones they painted with
 * (light, mid, dark, and optionally darkest), and which of them the user's pick
 * stands for (`anchor`, usually the dominant tone, so the swatch you click is
 * the color you see on the face). Without a darkest tone, one is extrapolated
 * by repeating the mid → dark step; without a highlight, by repeating mid → light.
 */
export type ArtRamp = {
  tones: [string, string, string] | [string, string, string, string]
  highlight?: string
  anchor: 0 | 1 | 2
}

type HSL = [number, number, number]

/**
 * The user's color → a 5-tone ramp [light, mid, dark, darkest, highlight].
 *
 * With an `art` ramp, each tone keeps the SAME distance from the user's pick
 * that it has from the anchor in the artist's original (hue shift, saturation
 * ratio, lightness step) — so the default color reproduces the drawing exactly,
 * and any other color is shaded the way the artist shades.
 * Without one, the user's color is the mid tone and a generic shading is used.
 */
/**
 * The user's color, moved the way `tone` sits relative to `anchor` in the
 * artist's drawing (hue shift, saturation ratio, lightness step).
 */
function shiftLike([h, s, l]: HSL, [ah, as, al]: HSL, [th, ts, tl]: HSL): RGB {
  const sat = as > 0 ? s * (ts / as) : ts
  // Lightness as a PROPORTION, not a fixed step: a shadow is "x% of the way
  // to black", a highlight "x% of the way to white". So near-black hair still
  // gets visible shading instead of collapsing to pure black.
  const light = tl < al ? l * (tl / al) : al < 1 ? l + (1 - l) * ((tl - al) / (1 - al)) : l
  return hslToRgb((h + (th - ah) + 360) % 360, clamp01(sat), clamp01(light))
}

/**
 * Repaint an artist's own tones with the user's color: `tones[0]` becomes
 * exactly `hex`, and every other tone keeps its distance from `tones[0]`.
 * So the drawing's own colors reproduce it exactly, and any other pick is
 * shaded the way the artist shaded.
 */
export function shadeLike(hex: string, tones: string[]): RGB[] {
  const pick = rgbToHsl(hexToRgb(hex))
  const hsl = tones.map((t) => rgbToHsl(hexToRgb(t)))
  return hsl.map((tone) => shiftLike(pick, hsl[0], tone))
}

export function makeRamp(hex: string, art?: ArtRamp): RGB[] {
  if (art) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex))
    const tones: HSL[] = art.tones.map((t) => rgbToHsl(hexToRgb(t)))
    if (tones.length === 3) {
      const [mh, ms, ml] = tones[1]
      const [dh, ds, dl] = tones[2]
      tones.push([dh + (dh - mh), ms > 0 ? ds * (ds / ms) : ds, ml > 0 ? dl * (dl / ml) : dl])
    }
    if (art.highlight) tones.push(rgbToHsl(hexToRgb(art.highlight)))
    else {
      const [mh, ms, ml] = tones[1]
      const [lh, ls, ll] = tones[0]
      tones.push([lh + (lh - mh), ms > 0 ? ls * (ls / ms) : ls, ml < 1 ? ll + (1 - ll) * ((ll - ml) / (1 - ml)) : ll])
    }
    return tones.map((tone) => shiftLike([h, s, l], tones[art.anchor], tone))
  }
  const mid = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(mid)
  const light = hslToRgb(hueToward(h, 50, 8), clamp01(s * 0.95), clamp01(l + 0.13))
  const dark = hslToRgb(hueToward(h, 250, 12), clamp01(s * 1.05 + 0.03), clamp01(l - 0.17))
  const darkest = hslToRgb(hueToward(h, 250, 20), clamp01(s * 1.1 + 0.05), clamp01(l - 0.32))
  const highlight = hslToRgb(hueToward(h, 50, 14), clamp01(s * 0.9), clamp01(l + 0.24))
  return [light, mid, dark, darkest, highlight]
}
