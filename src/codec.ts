import { defineStateCodec, field } from "@vvd/sdk"

// What a portrait document stores — and nothing else. The platform persists it,
// syncs it live between everyone who has the document open, and restores it when
// the document is reopened. We never write save/load code ourselves.
//
// Stored shape, e.g.:
//   parts:  { head: "head-human", hair: "hair-long", accessory: "" }
//   colors: { skin: "#e8b48f", hair: "#8a5a33" }
//
// Both are per-KEY maps: if one person changes the hair while another changes
// the eyes at the same moment, both edits land. Missing keys simply fall back to
// the defaults (see look.ts), so a brand-new document needs no setup.

export const codec = defineStateCodec({
  /** layer → piece id ("" = no piece on that optional layer) */
  parts: field.map<string>(),
  /** color group → "#rrggbb" */
  colors: field.map<string>(),
  /** layer → vertical nudge in pixels (only "movable" layers, ±OFFSET_RANGE; missing = 0) */
  offsets: field.map<number>(),
  /**
   * The Card this portrait belongs to — a reference (its id), never a copy of its
   * name. Set by "Add to card"; the name is always read live from the world.
   */
  cardId: field.value<string | null>(null),
})

export default codec
