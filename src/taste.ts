// Taste: what keeps Randomize looking intentional instead of random.
//
// Only Randomize follows these rules. Anything someone picks by hand is always
// kept: they are defaults with good taste, not a lock.
//
// Two kinds of rule, all in the one TASTE list below:
//
//   ODDS    how likely each option is when rolling.
//             rareColors("skin", ["#9fb79a"], 0.05)   green skin ~1 portrait in 20
//             rarePieces("ears", ["ears-elf"], 0.1)    elf ears ~1 portrait in 10
//
//   CHECKS  things a finished roll must satisfy. When one fails, Randomize
//           re-rolls the color the rule names as `change` (never the other).
//             apart("hair", "skin", DISTINCT)          hair never melts into the face
//
// Adding a new CHECK kind: add its type to Check, a constructor, and an entry in
// CHECKS with `active` (does it apply to this look?) and `margin` (≥ 0 holds,
// < 0 broken, bigger = safer). The repair engine needs nothing else.

import { colorDistance } from "@/color"
import { COLOR_GROUPS, LAYERS, NONE, type Category, type ColorGroup, type Look } from "@/model"
import { PALETTES } from "@/palettes"
import { findPart, partsIn } from "@/parts/manifest"

// ── Rule types ───────────────────────────────────────────────────────────────

/** These options of a slot come up rarely: `chance` is how often ANY of them is rolled. */
export type Rare =
  | { kind: "rareColors"; group: ColorGroup; values: string[]; chance: number }
  | { kind: "rarePieces"; layer: Category; values: string[]; chance: number }

/** `change` must look at least `min` away from `from` (another group, or a color drawn in the art). */
export type Apart = { kind: "apart"; change: ColorGroup; from: ColorGroup | string; min: number; piece?: string }

/** Every check names the color group Randomize may re-roll to fix it. */
export type Check = Apart

export type Rule = Rare | Check

// ── Constructors (what TASTE is written with) ────────────────────────────────

export const rareColors = (group: ColorGroup, colors: string[], chance: number): Rare =>
  ({ kind: "rareColors", group, values: colors.map((c) => c.toLowerCase()), chance })

export const rarePieces = (layer: Category, ids: string[], chance: number): Rare =>
  ({ kind: "rarePieces", layer, values: ids, chance })

/** With `piece`, the rule only counts while that piece is worn. */
export const apart = (change: ColorGroup, from: ColorGroup | string, min: number, opts: { piece?: string } = {}): Apart =>
  ({ kind: "apart", change, from, min, ...opts })

/** Distance thresholds (see colorDistance), named so rules read as intent. */
const DISTINCT = 0.08 // clearly two colors
const CONTRAST = 0.15 // reads as a separate shape at a glance

// ── The rules ────────────────────────────────────────────────────────────────

export const TASTE: Rule[] = [
  // Most people look like people: fantasy traits stay a pleasant surprise.
  rareColors("skin", ["#9fb79a", "#a9b3d4"], 0.05), // green, blue (alien / fae)
  rareColors("hair", ["#4f6d8f"], 0.04), // dyed blue
  rareColors("eyes", ["#7d3fa0", "#a8322d"], 0.05), // violet, red
  rarePieces("ears", ["ears-elf", "ears-elf-bigger"], 0.1),

  // Colors that must not blend.
  apart("hair", "skin", DISTINCT), // hair (and beard) never melts into the face
  apart("eyes", "skin", DISTINCT),
  apart("outfit2", "outfit", DISTINCT), // trim / tie stands apart from the main cloth
  apart("accent", "outfit2", DISTINCT), // a pin on a tie must show
  apart("accent", "outfit", DISTINCT),
  // body-suit: the tie sits on a light shirt drawn in fixed colors.
  apart("outfit2", "#edd8cf", CONTRAST, { piece: "body-suit" }),
  apart("outfit2", "#b6aba7", CONTRAST, { piece: "body-suit" }),
]

// ── Odds engine ──────────────────────────────────────────────────────────────

/**
 * Options in a random order where likelier ones tend to come first (a weighted
 * shuffle). Common options weigh 1; each `rare` rule's options are weighted so
 * that together they come up `chance` of the time.
 */
function weightedOrder(options: string[], rares: Rare[], what: string): string[] {
  const weight = new Map(options.map((o) => [o, 1]))
  for (const r of rares) {
    const found = r.values.filter((v) => weight.has(v))
    if (found.length < r.values.length) {
      console.warn(`[portrait-maker] ${r.kind}(${what}): not found:`, r.values.filter((v) => !weight.has(v)))
    }
    const common = options.length - found.length
    if (!found.length || common <= 0) continue
    const each = (r.chance * common) / ((1 - r.chance) * found.length)
    found.forEach((v) => weight.set(v, each))
  }
  return options
    .map((o) => ({ o, key: Math.random() ** (1 / weight.get(o)!) })) // Efraimidis–Spirakis
    .sort((a, b) => b.key - a.key)
    .map(({ o }) => o)
}

const colorOrder = (group: ColorGroup, rules: Rule[]) =>
  weightedOrder(PALETTES[group].map((c) => c.toLowerCase()),
    rules.filter((r): r is Rare => r.kind === "rareColors" && r.group === group), group)

/** One swatch of `group`, honoring rareColors. */
export function rollColor(group: ColorGroup, rules: Rule[] = TASTE): string {
  return colorOrder(group, rules)[0]
}

/** One piece id for `layer` (never NONE; emptiness is the layer's own call), honoring rarePieces. */
export function rollPiece(layer: Category, rules: Rule[] = TASTE): string {
  const ids = partsIn(layer).map((p) => p.id)
  return weightedOrder(ids, rules.filter((r): r is Rare => r.kind === "rarePieces" && r.layer === layer), layer)[0] ?? NONE
}

// ── Check engine ─────────────────────────────────────────────────────────────

const isGroup = (v: string): v is ColorGroup => (COLOR_GROUPS as string[]).includes(v)

/** What a look shows: the color groups its pieces use, and the pieces worn. */
type Seen = { groups: Set<ColorGroup>; pieces: Set<string> }

function seen(look: Look): Seen {
  const groups = new Set<ColorGroup>()
  for (const layer of LAYERS) {
    const part = look.parts[layer.id] === NONE ? undefined : findPart(look.parts[layer.id])
    part?.zones.forEach((g) => groups.add(g))
    part?.regions?.forEach((r) => groups.add(r.group))
  }
  return { groups, pieces: new Set(Object.values(look.parts)) }
}

/** How each check kind works. A rule about something not on screen is moot (`active` false). */
const CHECKS: { [K in Check["kind"]]: {
  active: (rule: Extract<Check, { kind: K }>, s: Seen) => boolean
  margin: (rule: Extract<Check, { kind: K }>, colors: Look["colors"]) => number
} } = {
  apart: {
    active: (r, s) => s.groups.has(r.change) && (!isGroup(r.from) || s.groups.has(r.from)) && (!r.piece || s.pieces.has(r.piece)),
    margin: (r, colors) => colorDistance(colors[r.change], isGroup(r.from) ? colors[r.from] : r.from) - r.min,
  },
}

const isCheck = (r: Rule): r is Check => r.kind in CHECKS
const kindOf = <C extends Check>(r: C) => CHECKS[r.kind] as unknown as { active: (r: C, s: Seen) => boolean; margin: (r: C, c: Look["colors"]) => number }
const margin = (r: Check, colors: Look["colors"]) => kindOf(r).margin(r, colors)
/** Groups a check reads: re-rolling any of them can break or fix it. */
const reads = (r: Check): string[] => [r.change, r.from]

function activeChecks(look: Look, rules: Rule[]): Check[] {
  const s = seen(look)
  return rules.filter(isCheck).filter((r) => kindOf(r).active(r, s))
}

/**
 * Repair a rolled look: while a check fails, re-roll its `change` group, taking
 * the likeliest swatch (rareColors still apply) that keeps EVERY check reading
 * that group — so fixing the hair can't break something else. If no swatch
 * satisfies them all, take the one that comes closest. Pieces never change.
 */
export function withTaste(look: Look, rules: Rule[] = TASTE): Look {
  const active = activeChecks(look, rules)
  const colors = { ...look.colors }
  for (let pass = 0; pass < 8; pass++) {
    const broken = active.find((r) => margin(r, colors) < 0)
    if (!broken) break
    const group = broken.change
    const touching = active.filter((r) => reads(r).includes(group))
    const score = (hex: string) => Math.min(...touching.map((r) => margin(r, { ...colors, [group]: hex })))
    const options = colorOrder(group, rules)
    colors[group] = options.find((hex) => score(hex) >= 0) ??
      options.reduce((best, hex) => (score(hex) > score(best) ? hex : best))
  }
  return { ...look, colors }
}

/** The checks a look fails right now — for tests, and a future "this may clash" hint. */
export function brokenRules(look: Look, rules: Rule[] = TASTE): Check[] {
  return activeChecks(look, rules).filter((r) => margin(r, look.colors) < 0)
}
