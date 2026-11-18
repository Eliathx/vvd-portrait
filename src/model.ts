// The vocabulary of a portrait: which layers exist, in what order they stack,
// and which color groups a piece can be tinted with.

/**
 * Every piece is drawn on the same fixed canvas. 3:4 is the shape of a vvd Card
 * image, so what you see in the frame is what the Card shows.
 */
export const WIDTH = 96
export const HEIGHT = 128

export type Category =
  | "background" | "body" | "head" | "ears" | "eyes"
  | "eyebrows" | "nose" | "mouth" | "beard" | "hair" | "hat" | "accessory"

/**
 * Layers from BACK to FRONT — this array is the draw order (and the tab order).
 *
 * A piece's optional `back` image is the exception: backs are drawn right above
 * the background, behind everything else, in MIRRORED order — the outermost
 * piece's back goes furthest back. So a hood's back sits behind the long hair
 * that falls inside it, while the hair's front still covers the ears.
 *
 * `emptyChance`: how often Randomize leaves an optional layer empty.
 * `startsEmpty`: a portrait that never chose this layer has nothing on it (so a
 * new layer added later doesn't suddenly put a hat on every existing portrait).
 * `movable`: the user can nudge it up/down (see OFFSET_RANGE). Only facial
 * features: the structure (head, hair, hat, body) stays where the template says.
 */
export const LAYERS: {
  id: Category
  optional: boolean
  emptyChance?: number
  startsEmpty?: boolean
  movable?: boolean
}[] = [
  { id: "background", optional: false },
  { id: "body", optional: false },
  { id: "head", optional: false },
  { id: "ears", optional: false, movable: true },
  { id: "eyes", optional: false, movable: true },
  { id: "eyebrows", optional: false, movable: true },
  { id: "nose", optional: false, movable: true },
  { id: "mouth", optional: false, movable: true },
  // Beard + mustache as ONE layer: each combination is its own piece (over the
  // mouth, under the hair so side locks can fall over it).
  { id: "beard", optional: true, emptyChance: 0.65, startsEmpty: true },
  { id: "hair", optional: true, emptyChance: 0.15 },
  { id: "hat", optional: true, emptyChance: 0.7, startsEmpty: true },
  { id: "accessory", optional: true, emptyChance: 0.6, startsEmpty: true },
]

/**
 * A color group is a color the USER picks once and that every piece using it
 * shares — so the face and the nose always have the same skin, and the back and
 * front hair always match.
 */
export type ColorGroup = "background" | "skin" | "hair" | "eyes" | "outfit" | "outfit2" | "accent"

export const COLOR_GROUPS: ColorGroup[] = ["skin", "hair", "eyes", "outfit", "outfit2", "accent", "background"]

/**
 * Where a group's color is edited. A group with a home shows its swatches only
 * on that tab; other pieces that use it (hair's scalp, a collar's neck) just
 * point there. Groups without one show on every piece that uses them.
 */
export const COLOR_HOME: Partial<Record<ColorGroup, Category>> = {
  skin: "head",
}

/**
 * One piece of art. `zones[0]` says which color group paints the zone-1 markers,
 * `zones[1]` the zone-2 markers (max 2). A piece with no zones is never recolored.
 */
export type Part = {
  id: string
  category: Category
  zones: ColorGroup[]
  /** PNG as a URL (data URL when imported, see parts/manifest.ts). */
  src: string
  /**
   * Optional second PNG drawn BEHIND the body and face (e.g. the long hair that
   * falls behind the shoulders). Same template, same marker colors, same zones.
   */
  back?: string
  /** Recolorable areas painted in the artist's own colors (no markers). See Region. */
  regions?: Region[]
}

/**
 * A recolorable area of a piece, declared by the colors it was DRAWN with, so
 * the art needs no marker repaint:
 *
 *   region("tie", "outfit2", ["#6a4535", "#40291f"])
 *
 * - `label`  names it in the editor: a key under "region" in src/locales/*.json
 *            ("tie" → "Tie"). Two pieces can say "tie" and share the text.
 * - `group`  the stored color it follows. Pieces that use the same group share
 *            the color, so swapping a suit for a tunic keeps your outfit color.
 * - `tones`  the exact colors used in the PNG. The FIRST is the main one (the
 *            color the swatch stands for); the others are its highlights and
 *            shadows, in any order, and keep their distance from it.
 */
export type Region = { label: string; group: ColorGroup; tones: string[]; shadows?: string[] }

/**
 * `shadows`: colors in the PNG that are a shadow cast ON this region (say, under
 * a pin on the tie). They're painted as the region's main color under a 25%
 * black veil, so the shadow reads right whatever color the region is.
 */
export const region = (label: string, group: ColorGroup, tones: string[], opts: { shadows?: string[] } = {}): Region =>
  ({ label, group, tones, ...opts })

/** How dark a region's `shadows` are: the opacity of the black veil over its main color. */
export const SHADOW_OPACITY = 0.25

/**
 * How far (in pixels, up or down) a movable layer can be nudged. Vertical only:
 * pieces are symmetric, a sideways nudge would break the face's symmetry.
 */
export const OFFSET_RANGE = 3

/** "No piece on this layer" — only allowed on optional layers. */
export const NONE = ""

/** A fully resolved portrait: a piece id per layer, a color per group, a nudge per layer. */
export type Look = {
  parts: Record<Category, string>
  colors: Record<ColorGroup, string>
  /** Vertical pixel offset per layer (0 for layers that aren't movable). */
  offsets: Record<Category, number>
}
