// THE LIST OF PIECES. To add a piece:
//
//   1. Draw a 96×128 PNG on the shared template, using the marker colors from
//      src/markers.ts for anything the user should be able to recolor.
//      (Sources like .aseprite live in /art, outside src, so they aren't bundled.)
//   2. Save it as   src/parts/<pack>/<category>/<category>-<name>.png
//        pack       "base" for now; a new pack is a new folder next to it
//        category   the LAYER id, which isn't always the UI label:
//                   body = Clothes, eyebrows = Brows (see LAYERS in src/model.ts)
//        name       what it looks like, never a number: eyebrows-thick, not brow_1.
//                   The file name IS the id, and saved portraits store ids — so a
//                   descriptive name never silently turns into another piece.
//      A back image (drawn behind body and face) sits next to it with ".back":
//        src/parts/base/hair/hair-long.png + hair-long.back.png
//   3. Import it below and add one line to DRAWN_PARTS:
//        id        the file name without .png
//        category  the layer it goes on
//        zones     which color group paints zone 1, then zone 2 (0–2 entries)
//        src       the imported PNG (the bundler turns it into a data URL)
//        back      optional: the ".back" PNG

import { type Part } from "@/model"
import { placeholderParts } from "@/parts/placeholders"

// import hairLong from "./base/hair/hair-long.png"
// import hairLongBack from "./base/hair/hair-long.back.png"
// import eyebrowsThick from "./base/eyebrows/eyebrows-thick.png"

const DRAWN_PARTS: Part[] = [
  // { id: "hair-long", category: "hair", zones: ["hair"], src: hairLong, back: hairLongBack },
  // { id: "eyebrows-thick", category: "eyebrows", zones: ["hair"], src: eyebrowsThick },
]

/** Turn off once your own pieces cover every required layer. */
const USE_PLACEHOLDERS = true

export const PARTS: Part[] = [...(USE_PLACEHOLDERS ? placeholderParts() : []), ...DRAWN_PARTS]

const byId = new Map(PARTS.map((p) => [p.id, p]))

export const findPart = (id: string): Part | undefined => byId.get(id)

export const partsIn = (category: Part["category"]): Part[] => PARTS.filter((p) => p.category === category)
