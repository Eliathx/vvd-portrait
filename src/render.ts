// From a Look (piece ids + colors) to pixels.
//
//   1. load each piece's PNG into raw pixels (cached — each PNG is decoded once)
//   2. recolor: swap marker colors for the user's ramp
//   3. compose: stack the layers back to front
//
// Everything works on 96×128 ImageData; scaling up happens only on screen (CSS
// `image-rendering: pixelated`) or on export, so pixels always stay crisp.

import { makeRamp, type RGB } from "@/color"
import { MARKERS } from "@/markers"
import { HEIGHT, LAYERS, NONE, WIDTH, type Look, type Part } from "@/model"
import { findPart } from "@/parts/manifest"

function makeCanvas(width = WIDTH, height = HEIGHT): HTMLCanvasElement {
  const c = window.document.createElement("canvas")
  c.width = width
  c.height = height
  return c
}

// ── 1. Loading ───────────────────────────────────────────────────────────────

const pixelCache = new Map<string, Promise<ImageData>>()

/** Decode a PNG into its raw RGBA pixels. */
export function loadPixels(src: string): Promise<ImageData> {
  let cached = pixelCache.get(src)
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        if (img.width !== WIDTH || img.height !== HEIGHT) {
          console.warn(`[portrait-maker] piece is ${img.width}×${img.height}, expected ${WIDTH}×${HEIGHT}`)
        }
        const ctx = makeCanvas().getContext("2d")!
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, WIDTH, HEIGHT))
      }
      img.onerror = reject
      img.src = src
    })
    pixelCache.set(src, cached)
  }
  return cached
}

// ── 2. Recoloring ────────────────────────────────────────────────────────────

/**
 * How far (per channel) a pixel may be from a marker and still count as it.
 * Browsers with canvas anti-fingerprinting (Brave, Firefox, some Edge setups)
 * add ±1–2 of random noise to pixels read back from a canvas, so an exact match
 * would miss a few scattered pixels. Markers are pure reds/greens, far from any
 * color an artist would use for real, so a small tolerance is safe.
 */
const TOLERANCE = 6

/**
 * Replace marker pixels with the user's colors.
 * `zoneColors[0]` tints zone 1, `zoneColors[1]` tints zone 2.
 *
 * We first build a small table "marker color → new color" (6 entries at most),
 * then walk the pixels once. A pixel that isn't (almost exactly) a marker is
 * copied as is.
 */
export function recolor(source: ImageData, zoneColors: string[]): ImageData {
  const swaps: { marker: RGB; color: RGB }[] = []
  zoneColors.forEach((hex, zone) => {
    const ramp = makeRamp(hex) // [light, mid, dark]
    MARKERS[zone]?.forEach((marker, tone) => swaps.push({ marker, color: ramp[tone] }))
  })

  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const px = out.data // flat array: r, g, b, a, r, g, b, a, …
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue // fully transparent: nothing to do
    const next = swaps.find(({ marker: [r, g, b] }) =>
      Math.abs(px[i] - r) <= TOLERANCE && Math.abs(px[i + 1] - g) <= TOLERANCE && Math.abs(px[i + 2] - b) <= TOLERANCE,
    )?.color
    if (next) {
      px[i] = next[0]
      px[i + 1] = next[1]
      px[i + 2] = next[2] // alpha is kept
    }
  }
  return out
}

/** One image of a piece (its front `src` or its `back`), tinted with the piece's color groups. */
export async function renderImage(src: string, part: Part, look: Look): Promise<ImageData> {
  const pixels = await loadPixels(src)
  return recolor(pixels, part.zones.map((group) => look.colors[group]))
}

// ── 3. Composing ─────────────────────────────────────────────────────────────

/**
 * Stack layers back to front. `putImageData` REPLACES pixels (no transparency),
 * so each layer goes to a scratch canvas first, and `drawImage` blends it on top.
 */
// Two canvases reused for every render (creating canvases is the slow part).
// `willReadFrequently` keeps them in CPU memory, so getImageData stays fast.
let composeCanvases: { ctx: CanvasRenderingContext2D; scratch: HTMLCanvasElement; sctx: CanvasRenderingContext2D } | null = null

export function compose(layers: ImageData[]): ImageData {
  if (!composeCanvases) {
    const scratch = makeCanvas()
    composeCanvases = {
      ctx: makeCanvas().getContext("2d", { willReadFrequently: true })!,
      scratch,
      sctx: scratch.getContext("2d", { willReadFrequently: true })!,
    }
  }
  const { ctx, scratch, sctx } = composeCanvases
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  for (const layer of layers) {
    sctx.putImageData(layer, 0, 0)
    ctx.drawImage(scratch, 0, 0)
  }
  return ctx.getImageData(0, 0, WIDTH, HEIGHT)
}

/** The whole portrait for a Look. */
export async function renderLook(look: Look): Promise<ImageData> {
  const parts = LAYERS
    .map((layer) => look.parts[layer.id])
    .filter((id) => id !== NONE)
    .map((id) => findPart(id))
    .filter((p): p is Part => !!p)
  // Back images (a hairstyle's back) go right above the background, behind the rest.
  const bg = parts[0]?.category === "background" ? 1 : 0
  const backs = parts.filter((p) => p.back).map((p) => renderImage(p.back!, p, look))
  const fronts = parts.map((p) => renderImage(p.src, p, look))
  const layers = await Promise.all([...fronts.slice(0, bg), ...backs, ...fronts.slice(bg)])
  return compose(layers)
}

// ── Export ───────────────────────────────────────────────────────────────────

/** A PNG of the portrait, scaled up by a whole number with no smoothing. */
export function toPngBlob(image: ImageData, scale: number): Promise<Blob> {
  const src = makeCanvas()
  src.getContext("2d")!.putImageData(image, 0, 0)
  const out = makeCanvas(WIDTH * scale, HEIGHT * scale)
  const ctx = out.getContext("2d")!
  ctx.imageSmoothingEnabled = false // nearest-neighbour: each pixel becomes a crisp block
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"),
  )
}
