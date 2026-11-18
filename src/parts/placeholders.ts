// Test pieces drawn by code, so the whole pipeline can be tried before any real
// art exists. They are painted with the SAME marker colors an artist would use and
// turned into PNG data URLs, so they go through exactly the same path as real
// PNGs (load → recolor → compose). Delete this file once real pieces exist.
//
// They also document the TEMPLATE every piece must respect (96×128):
//   centre line      x = 48
//   head             y ≈ 30–90 (inside the top 96×96 square, so a round or
//                    square crop of the avatar still shows the whole face)
//   eyes             row 62, centred at x = 38 and x = 58
//   nose             rows 67–73        mouth   rows 78–84
//   shoulders        from y ≈ 94 down to the bottom edge

import type { RGB } from "@/color"
import { MARKERS, TONE } from "@/markers"
import { HEIGHT, WIDTH, type Category, type ColorGroup, type Part } from "@/model"

/** Fixed (non-marker) colors: never recolored. */
const OUTLINE: RGB = [42, 30, 24]
const WHITE: RGB = [240, 236, 228]
const LIPS: RGB = [120, 58, 52]
const MOUTH_DARK: RGB = [70, 30, 30]

/** A shape is "is this pixel inside?" — shapes combine with union/intersect. */
type Shape = (x: number, y: number) => boolean

const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => (x, y) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
const rect = (x0: number, y0: number, x1: number, y1: number): Shape => (x, y) =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1
const union = (...shapes: Shape[]): Shape => (x, y) => shapes.some((s) => s(x, y))
const intersect = (...shapes: Shape[]): Shape => (x, y) => shapes.every((s) => s(x, y))
const all: Shape = () => true

/** A tiny pixel painter that ends in a PNG data URL. */
class Painter {
  private img = new ImageData(WIDTH, HEIGHT)

  px(x: number, y: number, [r, g, b]: RGB) {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
    this.img.data.set([r, g, b, 255], (y * WIDTH + x) * 4)
  }

  /** A solid rectangle, corners inclusive. */
  block(x0: number, y0: number, x1: number, y1: number, color: RGB) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, color)
  }

  /** Marker tone of a zone (0 = zone 1, 1 = zone 2). */
  tone(zone: number, tone: number): RGB {
    return MARKERS[zone][tone]
  }

  /**
   * Fill a shape with a zone's marker ramp — light toward the top-left, dark
   * toward the bottom-right — with a dark outline on its rim.
   */
  fill(shape: Shape, zone: number, outline = true) {
    let x0 = WIDTH, y0 = HEIGHT, x1 = 0, y1 = 0
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      if (shape(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!shape(x, y)) continue
      const rim = !shape(x - 1, y) || !shape(x + 1, y) || !shape(x, y - 1) || !shape(x, y + 1)
      if (outline && rim) { this.px(x, y, OUTLINE); continue }
      const s = (x - cx) / hw + 1.2 * ((y - cy) / hh)
      this.px(x, y, this.tone(zone, s < -0.95 ? TONE.light : s > 1.0 ? TONE.dark : TONE.mid))
    }
  }

  /** Paint every pixel with whatever `color(x, y)` returns. */
  each(color: (x: number, y: number) => RGB) {
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) this.px(x, y, color(x, y))
  }

  toDataUrl(): string {
    const c = window.document.createElement("canvas")
    c.width = WIDTH
    c.height = HEIGHT
    c.getContext("2d")!.putImageData(this.img, 0, 0)
    return c.toDataURL("image/png")
  }
}

function piece(id: string, category: Category, zones: ColorGroup[], draw: (p: Painter) => void,
  drawBack?: (p: Painter) => void): Part {
  const p = new Painter()
  draw(p)
  const part: Part = { id, category, zones, src: p.toDataUrl() }
  if (drawBack) {
    const b = new Painter()
    drawBack(b)
    part.back = b.toDataUrl()
  }
  return part
}

// The shared template (see the header comment).
const EYES_X = [38, 58]
const head = ellipse(48, 60, 26, 30)
const ears = union(ellipse(22, 62, 6, 8), ellipse(74, 62, 6, 8))
const shoulders = intersect(ellipse(48, 140, 56, 46), rect(0, 94, WIDTH - 1, HEIGHT - 1))

export function placeholderParts(): Part[] {
  return [
    // Background (zone 1 = background color)
    piece("bg-halo", "background", ["background"], (p) => p.each((x, y) => {
      const d = Math.hypot(x - 48, y - 56)
      return p.tone(0, d < 40 ? TONE.light : d < 62 ? TONE.mid : TONE.dark)
    })),
    piece("bg-stripes", "background", ["background"], (p) =>
      p.each((x, y) => p.tone(0, (x + y) % 20 < 10 ? TONE.mid : TONE.dark))),
    piece("bg-plain", "background", ["background"], (p) => p.fill(all, 0, false)),

    // Shoulders / clothes (zone 1 = outfit, zone 2 = outfit2)
    piece("body-tunic", "body", ["outfit"], (p) => p.fill(shoulders, 0)),
    piece("body-collar", "body", ["outfit", "outfit2"], (p) => {
      p.fill(shoulders, 0)
      p.fill(ellipse(34, 102, 12, 8), 1)
      p.fill(ellipse(62, 102, 12, 8), 1)
    }),
    piece("body-armor", "body", ["outfit", "outfit2"], (p) => {
      p.fill(shoulders, 0)
      p.fill(rect(12, 116, 83, 120), 1)
      p.fill(ellipse(6, 110, 18, 14), 1)
      p.fill(ellipse(90, 110, 18, 14), 1)
    }),

    // Face + ears + neck (zone 1 = skin)
    piece("face-round", "face", ["skin"], (p) => p.fill(union(head, ears, rect(38, 76, 58, 98)), 0)),
    piece("face-long", "face", ["skin"], (p) =>
      p.fill(union(ellipse(48, 60, 24, 34), ellipse(24, 62, 6, 8), ellipse(72, 62, 6, 8), rect(40, 80, 56, 98)), 0)),
    piece("face-square", "face", ["skin"], (p) =>
      p.fill(union(intersect(ellipse(48, 60, 32, 38), rect(22, 28, 74, 88)), ears, rect(38, 80, 58, 98)), 0)),

    // Eyes (zone 1 = eyes)
    piece("eyes-round", "eyes", ["eyes"], (p) => {
      for (const cx of EYES_X) {
        p.block(cx - 3, 58, cx + 2, 58, OUTLINE)
        p.block(cx - 3, 59, cx + 2, 62, WHITE)
        p.block(cx - 1, 59, cx + 1, 59, p.tone(0, TONE.light))
        p.block(cx - 1, 60, cx + 1, 61, p.tone(0, TONE.mid))
        p.block(cx - 1, 62, cx + 1, 62, p.tone(0, TONE.dark))
      }
    }),
    piece("eyes-big", "eyes", ["eyes"], (p) => {
      for (const cx of EYES_X) {
        p.block(cx - 4, 56, cx + 3, 56, OUTLINE)
        p.block(cx - 4, 57, cx + 3, 63, WHITE)
        p.block(cx - 2, 57, cx + 1, 57, p.tone(0, TONE.light))
        p.block(cx - 2, 58, cx + 1, 61, p.tone(0, TONE.mid))
        p.block(cx - 2, 62, cx + 1, 63, p.tone(0, TONE.dark))
        p.block(cx - 2, 58, cx - 1, 59, WHITE) // highlight
      }
    }),
    piece("eyes-sleepy", "eyes", ["eyes"], (p) => {
      for (const cx of EYES_X) {
        p.block(cx - 4, 60, cx + 3, 61, OUTLINE)
        p.block(cx - 2, 62, cx - 1, 63, p.tone(0, TONE.mid))
        p.block(cx, 62, cx + 1, 63, p.tone(0, TONE.dark))
      }
    }),

    // Eyebrows (zone 1 = hair, so they match the hair)
    piece("brows-straight", "eyebrows", ["hair"], (p) => {
      for (const cx of EYES_X) {
        p.block(cx - 4, 51, cx + 3, 51, p.tone(0, TONE.mid))
        p.block(cx - 4, 52, cx + 3, 53, p.tone(0, TONE.dark))
      }
    }),
    piece("brows-arched", "eyebrows", ["hair"], (p) => {
      for (const cx of EYES_X) {
        p.block(cx - 5, 54, cx - 4, 55, p.tone(0, TONE.dark))
        p.block(cx - 3, 52, cx + 2, 53, p.tone(0, TONE.dark))
        p.block(cx + 3, 54, cx + 4, 55, p.tone(0, TONE.dark))
      }
    }),

    // Nose (zone 1 = skin: its shadow is the skin's own dark tone)
    piece("nose-line", "nose", ["skin"], (p) => p.block(47, 68, 48, 73, p.tone(0, TONE.dark))),
    piece("nose-button", "nose", ["skin"], (p) => {
      p.block(47, 67, 48, 68, p.tone(0, TONE.light))
      p.block(44, 72, 45, 73, p.tone(0, TONE.dark))
      p.block(51, 72, 52, 73, p.tone(0, TONE.dark))
    }),

    // Mouth (no zones: fixed colors)
    piece("mouth-smile", "mouth", [], (p) => {
      p.block(40, 78, 41, 79, LIPS)
      p.block(42, 80, 53, 81, LIPS)
      p.block(54, 78, 55, 79, LIPS)
    }),
    piece("mouth-neutral", "mouth", [], (p) => p.block(42, 80, 53, 81, LIPS)),
    piece("mouth-open", "mouth", [], (p) => {
      p.block(42, 78, 53, 79, LIPS)
      p.block(42, 80, 53, 82, MOUTH_DARK)
      p.block(42, 83, 53, 84, LIPS)
      p.block(44, 80, 47, 81, WHITE) // teeth
    }),

    // Hairstyles: a front image (on the forehead) + an optional back image
    // (behind the head and shoulders). One pick in the UI, two layers when drawn.
    piece("hair-long-bangs", "hair", ["hair"],
      (p) => p.fill(intersect(ellipse(48, 54, 32, 28), rect(0, 0, WIDTH - 1, 48)), 0),
      (p) => p.fill(intersect(ellipse(48, 68, 36, 46), rect(0, 0, WIDTH - 1, 112)), 0)),
    piece("hair-bun-swoop", "hair", ["hair"],
      (p) => p.fill(union(intersect(ellipse(48, 54, 32, 28), rect(0, 0, WIDTH - 1, 42)), intersect(ellipse(32, 44, 20, 12), rect(0, 0, WIDTH - 1, 54))), 0),
      (p) => p.fill(ellipse(48, 28, 14, 12), 0)),
    piece("hair-short-spiky", "hair", ["hair"], (p) =>
      p.fill(intersect(ellipse(48, 52, 32, 30), (x, y) => y <= 42 + (x % 8 < 4 ? 6 : 0)), 0)),

    // Accessories (zone 1 = accent)
    piece("acc-headband", "accessory", ["accent"], (p) =>
      p.fill(intersect(ellipse(48, 60, 30, 32), rect(0, 34, WIDTH - 1, 40)), 0)),
    piece("acc-earrings", "accessory", ["accent"], (p) => {
      p.fill(ellipse(22, 76, 3.5, 3.5), 0)
      p.fill(ellipse(74, 76, 3.5, 3.5), 0)
    }),
  ]
}
