// The vocabulary of a portrait: which layers exist, in what order they stack,
// and which color groups a piece can be tinted with.

/**
 * Every piece is drawn on the same fixed canvas. 3:4 is the shape of a vvd Card
 * image, so what you see in the frame is what the Card shows.
 */
export const WIDTH = 96
export const HEIGHT = 128

export type Category =
  | "background" | "body" | "face" | "eyes"
  | "eyebrows" | "nose" | "mouth" | "hair" | "accessory"

/**
 * Layers from BACK to FRONT — this array is the draw order (and the tab order).
 * A piece's optional `back` image is the exception: it is drawn right above the
 * background, behind everything else (that's how a hairstyle falls behind the
 * shoulders while its bangs sit on the forehead).
 */
export const LAYERS: { id: Category; optional: boolean }[] = [
  { id: "background", optional: false },
  { id: "body", optional: false },
  { id: "face", optional: false },
  { id: "eyes", optional: false },
  { id: "eyebrows", optional: false },
  { id: "nose", optional: false },
  { id: "mouth", optional: false },
  { id: "hair", optional: true },
  { id: "accessory", optional: true },
]

/**
 * A color group is a color the USER picks once and that every piece using it
 * shares — so the face and the nose always have the same skin, and the back and
 * front hair always match.
 */
export type ColorGroup = "background" | "skin" | "hair" | "eyes" | "outfit" | "outfit2" | "accent"

export const COLOR_GROUPS: ColorGroup[] = ["skin", "hair", "eyes", "outfit", "outfit2", "accent", "background"]

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
}

/** "No piece on this layer" — only allowed on optional layers. */
export const NONE = ""

/** A fully resolved portrait: a piece id per layer and a color per group. */
export type Look = {
  parts: Record<Category, string>
  colors: Record<ColorGroup, string>
}
