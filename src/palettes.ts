import type { ArtRamp } from "@/color"
import type { ColorGroup } from "@/model"

// Suggested colors per group: muted, slightly warm, so any combination sits well
// on vvd's dark surfaces. The free color picker covers everything else.

const CLOTH = ["#7a2e2a", "#2f4f6b", "#3e5a3a", "#5b4370", "#a07a3a", "#4a4a52", "#8a6a50", "#c9b89a"]

export const PALETTES: Record<ColorGroup, string[]> = {
  skin: ["#f4d3b5", "#f0ae93", "#d39a6a", "#b97a4f", "#8d5a3b", "#5e3b26", "#9fb79a", "#a9b3d4"],
  hair: ["#2b2220", "#5a3a26", "#8a5a33", "#c08a4a", "#e3c27a", "#d9d4c7", "#9b3b2e", "#4f6d8f"],
  eyes: ["#3b5f8a", "#4f7a4a", "#7a5230", "#8a8f98", "#b8892e", "#7d3fa0", "#a8322d", "#3a2a22"],
  outfit: CLOTH,
  outfit2: CLOTH,
  accent: ["#d9a441", "#c8ccd4", "#b8693a", "#4fa38a", "#b8324a", "#3a5fb8", "#e6dcc4", "#3a3440"],
  background: ["#3b2f2a", "#2a3240", "#2f3a2f", "#40303a", "#4a3b28", "#1f2a2e", "#5a4632", "#6b5a4a"],
}

/** What a brand-new portrait looks like before anyone touches it. */
export const DEFAULT_COLORS: Record<ColorGroup, string> = {
  skin: PALETTES.skin[1],
  hair: PALETTES.hair[2],
  eyes: PALETTES.eyes[1],
  outfit: PALETTES.outfit[1],
  outfit2: PALETTES.outfit2[4],
  accent: PALETTES.accent[0],
  background: PALETTES.background[0],
}

/**
 * How the artist shades each group, taken from the real pieces (see makeRamp).
 * The user's pick stands for the `anchor` tone; the others keep the artist's
 * distance from it. Groups without an entry use the generic shading.
 * skin: head-human-man-40s (base, soft shadow, deep shadow) + the mouth's line,
 *       and the nose's highlight.
 * hair: hair-male-long (highlight, base, shadow); darkest is extrapolated.
 * eyes: eyes-human-man-2's iris (light, shadow); the pick is the light tone.
 */
export const ART_RAMPS: Partial<Record<ColorGroup, ArtRamp>> = {
  skin: { tones: ["#f0ae93", "#e49684", "#ba756a", "#8e5252"], highlight: "#f5c19c", anchor: 0 },
  hair: { tones: ["#b1aa9e", "#999388", "#767169"], anchor: 1 },
  // Third tone extrapolated the same way makeRamp does (mid → dark step repeated).
  eyes: { tones: ["#52677c", "#343f4b", "#1f262d"], anchor: 0 },
}
