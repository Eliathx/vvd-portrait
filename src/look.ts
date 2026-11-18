// Between the stored document and a drawable portrait: fill in defaults, and roll
// random portraits.

import { COLOR_GROUPS, LAYERS, NONE, type Category, type ColorGroup, type Look } from "@/model"
import { DEFAULT_COLORS, PALETTES } from "@/palettes"
import { findPart, partsIn } from "@/parts/manifest"

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)

/**
 * Stored maps → a complete Look. Anything missing or no longer valid (a piece
 * that was removed from the manifest, a malformed color) falls back to the default,
 * so old documents always open.
 */
export function resolveLook(
  storedParts: Readonly<Record<string, string>>,
  storedColors: Readonly<Record<string, string>>,
): Look {
  const parts = {} as Record<Category, string>
  for (const layer of LAYERS) {
    const id = storedParts[layer.id]
    const valid = (id === NONE && layer.optional) || (id !== undefined && findPart(id)?.category === layer.id)
    parts[layer.id] = valid ? id : (partsIn(layer.id)[0]?.id ?? NONE)
  }
  const colors = {} as Record<ColorGroup, string>
  for (const group of COLOR_GROUPS) {
    const hex = storedColors[group]
    colors[group] = isHex(hex) ? hex.toLowerCase() : DEFAULT_COLORS[group]
  }
  return { parts, colors }
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

/** Chance that an optional layer (back hair, front hair, accessory) comes out empty. */
const EMPTY_CHANCE = 0.3

function rollLook(): Look {
  const parts = {} as Record<Category, string>
  for (const layer of LAYERS) {
    const ids = partsIn(layer.id).map((p) => p.id)
    const empty = layer.optional && (ids.length === 0 || Math.random() < EMPTY_CHANCE)
    parts[layer.id] = empty ? NONE : (pick(ids) ?? NONE)
  }
  const colors = {} as Record<ColorGroup, string>
  for (const group of COLOR_GROUPS) colors[group] = pick(PALETTES[group])
  return { parts, colors }
}

export function sameLook(a: Look, b: Look): boolean {
  return LAYERS.every((l) => a.parts[l.id] === b.parts[l.id]) &&
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
