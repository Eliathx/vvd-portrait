// THE LIST OF PIECES. To add a piece:
//
//   1. Draw a 96×128 PNG on the shared template, using the marker colors from
//      src/markers.ts for anything the user should be able to recolor.
//      (Sources like .aseprite live in /art, outside src, so they aren't bundled.)
//   2. Save it as   src/parts/<pack>/<category>/<category>-<name>.png
//        pack       "base" for now; a new pack is a new folder next to it
//        category   the LAYER id, which isn't always the UI label:
//                   body = Clothes, eyebrows = Brows, beard = Facial hair, head = Head (see LAYERS in src/model.ts)
//        name       what it looks like, never a number: eyebrows-thick, not brow_1.
//                   The file name IS the id, and saved portraits store ids — so a
//                   descriptive name never silently turns into another piece.
//      A back image (drawn behind body and face) sits next to it with ".back":
//        src/parts/base/hair/hair-long.png + hair-long.back.png
//   3. Import it below and add one line to PARTS:
//        id        the file name without .png
//        category  the layer it goes on
//        zones     which color group paints zone 1, then zone 2 (0–2 entries)
//        src       the imported PNG (the bundler turns it into a data URL)
//        back      optional: the ".back" PNG
//        regions   optional: recolorable areas left in their DRAWN colors, each
//                  with a name for the editor — no marker repaint needed:
//                    regions: [
//                      region("tie", "outfit2", ["#6a4535", "#40291f"]),
//                      region("pin", "accent", ["#db9f40"]),
//                    ]
//                  label ("tie") → its text in src/locales/en.json under "region";
//                  group → the stored color it follows (shared with other pieces);
//                  tones → the exact colors in the PNG, MAIN color first.

import { region, type Part } from "@/model"

import backgroundCircle from "./base/background/background-circle.png"
import backgroundDither from "./base/background/background-dither.png"
import backgroundScribble from "./base/background/background-scribble.png"
import backgroundSolid from "./base/background/background-solid.png"
import bodyDarkArmor from "./base/body/body-dark-armor.png"
import bodyDarkMetal from "./base/body/body-dark-metal.png"
import bodySuit from "./base/body/body-suit.png"
import beardBalbo from "./base/beard/beard-balbo.png"
import beardMoustache from "./base/beard/beard-moustache.png"
import beardMuttonChops from "./base/beard/beard-mutton-chops.png"
import beardSmallGoatee from "./base/beard/beard-small-goatee.png"
import beardSmallGoateeMoustache from "./base/beard/beard-small-goatee-moustache.png"
import earsElf from "./base/ears/ears-elf.png"
import earsElfBigger from "./base/ears/ears-elf-bigger.png"
import earsHuman from "./base/ears/ears-human.png"
import earsHumanBigger from "./base/ears/ears-human-bigger.png"
import eyebrowsNormal from "./base/eyebrows/eyebrows-normal.png"
import eyebrowsSlit from "./base/eyebrows/eyebrows-slit.png"
import eyebrowsThick from "./base/eyebrows/eyebrows-thick.png"
import eyebrowsThin from "./base/eyebrows/eyebrows-thin.png"
import eyesHumanMan from "./base/eyes/eyes-human-man.png"
import eyesHumanMan2 from "./base/eyes/eyes-human-man-2.png"
import hairMaleBalding from "./base/hair/hair-male-balding.png"
import hairMaleLong from "./base/hair/hair-male-long.png"
import hairMaleMessy from "./base/hair/hair-male-messy.png"
import hairMaleShort from "./base/hair/hair-male-short.png"
import headHuman from "./base/head/head-human.png"
import headHumanMale2 from "./base/head/head-human-male-2.png"
import headHumanMan40s from "./base/head/head-human-man-40s.png"
import headHumanYoungMale from "./base/head/head-human-young-male.png"
import mouthNormalMale from "./base/mouth/mouth-normal-male.png"
import noseLonger from "./base/nose/nose-longer.png"
import noseNormal from "./base/nose/nose-normal.png"
import noseWider from "./base/nose/nose-wider.png"
import noseWider2 from "./base/nose/nose-wider-2.png"

export const PARTS: Part[] = [
  // zones: [] + no regions = fixed colors, drawn as is.
  // Backgrounds: the base tone first (what the swatch shows), then the pattern tone.
  { id: "background-solid", category: "background", zones: [], src: backgroundSolid, regions: [
    region("background", "background", ["#4a5647"]),
  ] },
  { id: "background-circle", category: "background", zones: [], src: backgroundCircle, regions: [
    region("background", "background", ["#4a5647", "#40493d"]),
  ] },
  { id: "background-dither", category: "background", zones: [], src: backgroundDither, regions: [
    region("background", "background", ["#4a5647", "#40493d"]),
  ] },
  { id: "background-scribble", category: "background", zones: [], src: backgroundScribble, regions: [
    region("background", "background", ["#333941", "#434d5b"]),
  ] },
  { id: "body-suit", category: "body", zones: ["skin"], src: bodySuit, regions: [
    region("suit", "outfit", ["#c47f59", "#e9915c", "#b5704a", "#855337"]),
    region("tie", "outfit2", ["#6a4535", "#40291f"], { shadows: ["#573729"] }), // the pin's shadow on the tie
    region("pin", "accent", ["#db9f40"]),
  ] },
  // The neck is painted with the skin's dark + darkest markers, so it follows the
  // skin color one shade below the face (it sits in the head's shadow).
  { id: "body-dark-metal", category: "body", zones: ["skin"], src: bodyDarkMetal },
  { id: "body-dark-armor", category: "body", zones: ["skin"], src: bodyDarkArmor },
  { id: "head-human", category: "head", zones: ["skin"], src: headHuman },
  { id: "head-human-man-40s", category: "head", zones: ["skin"], src: headHumanMan40s },
  { id: "head-human-young-male", category: "head", zones: ["skin"], src: headHumanYoungMale },
  { id: "head-human-male-2", category: "head", zones: ["skin"], src: headHumanMale2 },
  { id: "ears-human", category: "ears", zones: ["skin"], src: earsHuman },
  { id: "ears-human-bigger", category: "ears", zones: ["skin"], src: earsHumanBigger },
  { id: "ears-elf", category: "ears", zones: ["skin"], src: earsElf },
  { id: "ears-elf-bigger", category: "ears", zones: ["skin"], src: earsElfBigger },
  { id: "eyes-human-man", category: "eyes", zones: ["skin"], src: eyesHumanMan },
  { id: "eyes-human-man-2", category: "eyes", zones: ["skin", "eyes"], src: eyesHumanMan2 },
  { id: "eyebrows-normal", category: "eyebrows", zones: [], src: eyebrowsNormal },
  { id: "eyebrows-slit", category: "eyebrows", zones: [], src: eyebrowsSlit },
  { id: "eyebrows-thick", category: "eyebrows", zones: [], src: eyebrowsThick },
  { id: "eyebrows-thin", category: "eyebrows", zones: [], src: eyebrowsThin },
  { id: "mouth-normal-male", category: "mouth", zones: ["skin"], src: mouthNormalMale },
  { id: "nose-normal", category: "nose", zones: ["skin"], src: noseNormal },
  { id: "nose-longer", category: "nose", zones: ["skin"], src: noseLonger },
  { id: "nose-wider", category: "nose", zones: ["skin"], src: noseWider },
  { id: "nose-wider-2", category: "nose", zones: ["skin"], src: noseWider2 },
  { id: "beard-moustache", category: "beard", zones: ["hair"], src: beardMoustache },
  { id: "beard-small-goatee", category: "beard", zones: ["hair"], src: beardSmallGoatee },
  { id: "beard-small-goatee-moustache", category: "beard", zones: ["hair"], src: beardSmallGoateeMoustache },
  { id: "beard-balbo", category: "beard", zones: ["hair", "skin"], src: beardBalbo },
  { id: "beard-mutton-chops", category: "beard", zones: ["hair", "skin"], src: beardMuttonChops },
  { id: "hair-male-short", category: "hair", zones: ["hair", "skin"], src: hairMaleShort },
  { id: "hair-male-messy", category: "hair", zones: ["hair", "skin"], src: hairMaleMessy },
  { id: "hair-male-long", category: "hair", zones: ["hair", "skin"], src: hairMaleLong },
  { id: "hair-male-balding", category: "hair", zones: ["hair", "skin"], src: hairMaleBalding },
]

const byId = new Map(PARTS.map((p) => [p.id, p]))

// Two pieces with the same id are one piece to a saved portrait: picking either
// selects both, and only the last one ever draws. Say so loudly while drawing.
if (byId.size !== PARTS.length) {
  const seen = new Set<string>()
  const dupes = PARTS.filter((p) => seen.has(p.id) || !seen.add(p.id)).map((p) => p.id)
  console.error(`[portrait-maker] duplicate piece ids: ${[...new Set(dupes)].join(", ")}`)
}

export const findPart = (id: string): Part | undefined => byId.get(id)

export const partsIn = (category: Part["category"]): Part[] => PARTS.filter((p) => p.category === category)
