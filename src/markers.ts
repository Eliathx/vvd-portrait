import type { RGB } from "@/color"

/**
 * The marker colors an artist paints with. Each zone is a 5-tone ramp:
 * [light, mid, dark, darkest, highlight] (highlight was added last, so it sits
 * at the end — the order is just an index). At render time every pixel that EXACTLY matches
 * one of these is swapped for the same tone of the user's chosen color. Anything
 * else (outlines, the white of the eyes) is left untouched. A piece doesn't have
 * to use all four.
 *
 *            highlight  light      mid        dark       darkest
 *   zone 1   #FFC0C0    #FF8080    #FF0000    #800000    #400000
 *   zone 2   #C0FFC0    #80FF80    #00FF00    #008000    #004000
 */
export const MARKERS: RGB[][] = [
  [[255, 128, 128], [255, 0, 0], [128, 0, 0], [64, 0, 0], [255, 192, 192]],
  [[128, 255, 128], [0, 255, 0], [0, 128, 0], [0, 64, 0], [192, 255, 192]],
]

export const TONE = { light: 0, mid: 1, dark: 2, darkest: 3, highlight: 4 } as const
