// THE LIST OF PIECES. To add a piece:
//
//   1. Draw a 96×128 PNG on the shared template, using the marker colors from
//      src/markers.ts for anything the user should be able to recolor.
//   2. Save it as src/parts/<category>/<id>.png
//   3. Import it below and add one line to DRAWN_PARTS:
//        id        unique name, kebab-case
//        category  which layer it goes on (see LAYERS in src/model.ts)
//        zones     which color group paints zone 1, then zone 2 (0–2 entries)
//        src       the imported PNG (the bundler turns it into a data URL)
//        back      optional: a second PNG drawn behind the body and face
//                  (a hairstyle = front PNG + optional back PNG)

import { type Part } from "@/model"
import { placeholderParts } from "@/parts/placeholders"

// import hairLong from "./hair/hair-long.png"
// import hairLongBack from "./hair/hair-long-back.png"

const DRAWN_PARTS: Part[] = [
  // { id: "hair-long", category: "hair", zones: ["hair"], src: hairLong, back: hairLongBack },
]

/** Turn off once your own pieces cover every required layer. */
const USE_PLACEHOLDERS = true

export const PARTS: Part[] = [...(USE_PLACEHOLDERS ? placeholderParts() : []), ...DRAWN_PARTS]

const byId = new Map(PARTS.map((p) => [p.id, p]))

export const findPart = (id: string): Part | undefined => byId.get(id)

export const partsIn = (category: Part["category"]): Part[] => PARTS.filter((p) => p.category === category)
