import type { RGB } from "@/color"

/**
 * The marker colors an artist paints with. Each zone is a 3-tone ramp:
 * [light, mid, dark]. At render time every pixel that EXACTLY matches one of
 * these is swapped for the same tone of the user's chosen color. Anything else
 * (outlines, highlights, the white of the eyes) is left untouched.
 *
 *            light      mid        dark
 *   zone 1   #FF8080    #FF0000    #800000
 *   zone 2   #80FF80    #00FF00    #008000
 */
export const MARKERS: [RGB, RGB, RGB][] = [
  [[255, 128, 128], [255, 0, 0], [128, 0, 0]],
  [[128, 255, 128], [0, 255, 0], [0, 128, 0]],
]

export const TONE = { light: 0, mid: 1, dark: 2 } as const
