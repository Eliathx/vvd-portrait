// Between the stored document and a drawable portrait: fill in defaults, and roll
// random portraits.

import { COLOR_GROUPS, LAYERS, NONE, OFFSET_RANGE, type Category, type ColorGroup, type Look } from "@/model"
import { DEFAULT_COLORS } from "@/palettes"
import { findPart, partsIn } from "@/parts/manifest"
import { rollColor, rollPiece, withTaste } from "@/taste"

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)

/**
 * Stored maps → a complete Look. Anything missing or no longer valid (a piece
 * that was removed from the manifest, a malformed color) falls back to the default,
 * so old documents always open.
 */
/** A stored nudge → a whole number within range; 0 for layers that can't move. */
export function clampOffset(layer: (typeof LAYERS)[number], value: unknown): number {
  if (!layer.movable || typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(-OFFSET_RANGE, Math.min(OFFSET_RANGE, Math.round(value)))
}

export function resolveLook(
  storedParts: Readonly<Record<string, string>>,
  storedColors: Readonly<Record<string, string>>,
  storedOffsets: Readonly<Record<string, number>> = {},
): Look {
  const parts = {} as Record<Category, string>
  for (const layer of LAYERS) {
    const id = storedParts[layer.id]
    const valid = (id === NONE && layer.optional) || (id !== undefined && findPart(id)?.category === layer.id)
    const fallback = layer.startsEmpty ? NONE : (partsIn(layer.id)[0]?.id ?? NONE)
    parts[layer.id] = valid ? id : fallback
  }
  const colors = {} as Record<ColorGroup, string>
  for (const group of COLOR_GROUPS) {
    const hex = storedColors[group]
    colors[group] = isHex(hex) ? hex.toLowerCase() : DEFAULT_COLORS[group]
  }
  const offsets = {} as Record<Category, number>
  for (const layer of LAYERS) offsets[layer.id] = clampOffset(layer, storedOffsets[layer.id])
  return { parts, colors, offsets }
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

/** Default chance that an optional layer comes out empty (see `emptyChance` in LAYERS). */
const EMPTY_CHANCE = 0.3

function rollLook(): Look {
  const parts = {} as Record<Category, string>
  for (const layer of LAYERS) {
    const none = partsIn(layer.id).length === 0
    const empty = layer.optional && (none || Math.random() < (layer.emptyChance ?? EMPTY_CHANCE))
    parts[layer.id] = empty ? NONE : rollPiece(layer.id) // rare pieces stay rare (taste.ts)
  }
  const colors = {} as Record<ColorGroup, string>
  for (const group of COLOR_GROUPS) colors[group] = rollColor(group) // rare swatches stay rare (taste.ts)
  // Features land where the template puts them; only the brows get a little
  // play (±1px), which is enough to change the expression.
  const offsets = {} as Record<Category, number>
  for (const layer of LAYERS) offsets[layer.id] = layer.id === "eyebrows" ? pick([-1, 0, 0, 1]) : 0
  // Colors are rolled independently, then the taste rules fix clashes (see taste.ts).
  return withTaste({ parts, colors, offsets })
}

export function sameLook(a: Look, b: Look): boolean {
  return LAYERS.every((l) => a.parts[l.id] === b.parts[l.id] && a.offsets[l.id] === b.offsets[l.id]) &&
    COLOR_GROUPS.every((g) => a.colors[g] === b.colors[g])
}

/**
 * A random portrait that is never exactly the current one. With thousands of
 * possible combinations a repeat is rare, so we simply re-roll when it happens.
 */
export function randomLook(current: Look): Look {
  let next = rollLook()
  for (let tries = 0; tries < 50 && sameLook(next, current); tries++) next = rollLook()
  return next
}
