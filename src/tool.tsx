import { type CSSProperties, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DocumentGate, type ToolRenderProps, defineTool, peekOrOpenDocument, useDocument, useHost, useHostCapability, useHostTheme } from "@vvd/sdk"

import { type AddResult, type Documents, addPortraitToCard } from "@/cardImage"
import { CardPicker, useCards } from "@/CardPicker"
import { codec } from "@/codec"
import { ColorPicker } from "@/ColorPicker"
import { hexToRgb } from "@/color"
import { useT } from "@/i18n"
import { randomLook, resolveLook } from "@/look"
import { COLOR_GROUPS, HEIGHT, LAYERS, NONE, WIDTH, type Category, type ColorGroup, type Look } from "@/model"
import { PALETTES } from "@/palettes"
import { findPart, partsIn } from "@/parts/manifest"
import { renderLook, toPngBlob } from "@/render"

// ── Small hooks ──────────────────────────────────────────────────────────────

/** Render a Look to pixels (async: PNGs decode in the background). */
function usePortrait(look: Look): ImageData | null {
  const [image, setImage] = useState<ImageData | null>(null)
  useEffect(() => {
    // Wait for the next frame: if the look changes again before then (a fast
    // color drag), this render is cancelled — at most one render per frame.
    let live = true
    const frame = requestAnimationFrame(() => {
      renderLook(look).then((px) => { if (live) setImage(px) })
    })
    return () => { live = false; cancelAnimationFrame(frame) }
  }, [look])
  return image
}

/** Width of an element, live. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

const WARM_GOLD = "#d4a35a"

/**
 * The world theme's accent when it is a real, colorful hex; our warm gold
 * otherwise. (A grey `--primary` made the main button look disabled.)
 */
function useAccent(): string {
  const theme = useHostTheme()
  const value = theme?.tokens?.["--primary"]?.trim()
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return WARM_GOLD
  const [r, g, b] = hexToRgb(value)
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
  return saturation > 0.3 ? value : WARM_GOLD
}

// ── Pixel canvas ─────────────────────────────────────────────────────────────

/** Shows the 96×128 pixels at a WHOLE-number scale, with no smoothing. */
function PixelCanvas({ image, scale }: { image: ImageData | null; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (image) ref.current?.getContext("2d")?.putImageData(image, 0, 0)
  }, [image])
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} className="pm-pixels" style={{ width: WIDTH * scale, height: HEIGHT * scale }} />
}

// ── Pieces and colors ────────────────────────────────────────────────────────

/** A thumbnail = the current portrait with THIS piece swapped in. */
function PieceOption({ look, category, partId, label, selected, onPick }: {
  look: Look
  category: Category
  partId: string
  label: string
  selected: boolean
  onPick: () => void
}) {
  const preview = useMemo(() => ({ ...look, parts: { ...look.parts, [category]: partId } }), [look, category, partId])
  const image = usePortrait(preview)
  return (
    <button type="button" className="pm-piece" aria-pressed={selected} title={label} onClick={onPick}>
      <PixelCanvas image={image} scale={1} />
    </button>
  )
}

function ColorRow({ label, value, palette, onPick, onDrag }: {
  label: string
  value: string
  palette: string[]
  onPick: (hex: string) => void
  /** Fires continuously while the free picker is being dragged. */
  onDrag: (hex: string) => void
}) {
  const t = useT()
  const custom = !palette.includes(value)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <div className="pm-color-row">
      <span className="pm-label">{label}</span>
      <div className="pm-swatches">
        {palette.map((hex) => (
          <button key={hex} type="button" className="pm-swatch" aria-pressed={hex === value} title={hex}
            style={{ background: hex }} onClick={() => onPick(hex)} />
        ))}
        <span className="pm-picker-anchor">
          <button type="button" className="pm-swatch pm-swatch-custom" aria-pressed={custom} aria-expanded={open}
            title={t("color.custom")} style={custom ? { background: value } : undefined}
            onClick={() => setOpen((o) => !o)} />
          {open && <ColorPicker value={value} onDrag={onDrag} onCommit={onPick} onClose={close} />}
        </span>
      </div>
    </div>
  )
}

// ── The maker ────────────────────────────────────────────────────────────────

type Data = { parts: Readonly<Record<string, string>>; colors: Readonly<Record<string, string>>; cardId: string | null }
type Actions = {
  map(name: "parts" | "colors"): { set(key: string, value: string): void }
  set(name: "cardId", value: string | null): void
  transact(fn: () => void): void
}

// ── Add to card ──────────────────────────────────────────────────────────────

type CardStatus = "idle" | "saving" | AddResult | "error"

/**
 * "Add to card": always opens the Card picker (search, or one click on the list);
 * picking puts the portrait on that Card. The last Card is remembered by id
 * (never its name) so the picker can mark it.
 */
function CardAction({ portrait, cardId, worldId, onLinked, onShow }: {
  portrait: ImageData | null
  cardId: string | null
  worldId: string
  onLinked: (cardId: string) => void
  /** Open that Card beside the tool. */
  onShow: (cardId: string) => void
}) {
  const t = useT()
  const host = useHost()
  const media = useHostCapability("media")
  // Needs `writesWorld` in vvd.json. Optional: a host without it falls back to upload/download.
  const documents = (host as unknown as { documents?: Documents } | null)?.documents
  const cards = useCards()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<CardStatus>("idle")
  const [target, setTarget] = useState<string | null>(null)
  const close = useCallback(() => setOpen(false), [])

  // Names are read live from the world, so a rename shows up here too.
  const nameOf = (id: string | null) => cards.find((c) => c.id === id)?.name || t("card.untitled")

  const send = async (id: string) => {
    if (!portrait) return
    setOpen(false)
    setTarget(id)
    setStatus("saving")
    try {
      const result = await addPortraitToCard({ portrait, cardId: id, cardName: nameOf(id), worldId, media, documents })
      onLinked(id)
      setStatus(result)
      // Show the result right away, beside the portrait, without leaving the tool.
      if (result !== "downloaded") onShow(id)
      host?.analytics?.track("portrait_added_to_card", { result, relink: id === cardId ? "same" : "new" })
    } catch (err) {
      console.error("[portrait-maker] add to card failed", err)
      setStatus("error")
    }
  }

  const name = nameOf(target)

  return (
    <div className="pm-card-action">
      <span className="pm-picker-anchor">
        <button type="button" className="pm-button pm-primary" disabled={!portrait || status === "saving"}
          aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
          {t("action.addToCard")}
        </button>
        {open && <CardPicker cards={cards} current={cardId} onPick={(id) => void send(id)} onClose={close} />}
      </span>
      <p className="pm-card-status" role="status">
        {status === "saving" && t("card.saving", { name })}
        {status === "error" && <span className="pm-card-error">{t("card.error")}</span>}
        {status === "assigned" && <span>{t("card.done", { name })}</span>}
        {status === "uploaded" && <span>{t("card.uploaded", { name })}</span>}
        {status === "downloaded" && <span>{t("card.downloaded", { name })}</span>}
        {(status === "assigned" || status === "uploaded" || status === "downloaded") && target && (
          <button type="button" className="pm-link" onClick={() => onShow(target)}>{t("card.show")}</button>
        )}
      </p>
    </div>
  )
}

function PortraitMaker({ data, actions, canEdit, worldId }: { data: Data; actions: Actions; canEdit: boolean; worldId: string }) {
  const t = useT()
  const accent = useAccent()
  const look = useMemo(() => resolveLook(data.parts, data.colors), [data.parts, data.colors])

  // While the free color picker is dragged it fires dozens of changes a second.
  // Writing each one to the shared document (and redrawing every thumbnail) is
  // what made it feel slow. So: the drag only updates a LOCAL draft that the big
  // preview shows, and the document gets the color once, when the picker closes.
  const [draft, setDraft] = useState<{ group: ColorGroup; hex: string } | null>(null)
  // Drop the draft once the saved document has caught up with it (no flicker back).
  useEffect(() => {
    if (draft && look.colors[draft.group] === draft.hex) setDraft(null)
  }, [look, draft])
  const shown = useMemo(
    () => (draft ? { ...look, colors: { ...look.colors, [draft.group]: draft.hex } } : look),
    [look, draft],
  )
  const portrait = usePortrait(shown)
  const [tab, setTab] = useState<Category>("face")
  const nav = useHostCapability("nav")
  const refs = useHostCapability("refs")
  // Open the Card beside the portrait. In the workspace this adds a panel next to
  // this one (split view); on narrow screens the host decides (tab or peek).
  const showCard = useCallback(
    (id: string) => peekOrOpenDocument(nav, refs?.coordsFor?.(id) ?? { worldId, documentId: id }),
    [nav, refs, worldId],
  )

  // Layout follows the space we're given (a full page, a side panel, an embed).
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useWidth(rootRef)
  const narrow = width > 0 && width < 640
  const scale = Math.max(1, Math.min(4, Math.floor((narrow ? width - 60 : width * 0.42) / WIDTH)))

  // Every write goes through `actions` — that IS the save.
  const setPart = (category: Category, id: string) => actions.map("parts").set(category, id)
  const setColor = (group: ColorGroup, hex: string) => actions.map("colors").set(group, hex)
  const dragColor = (group: ColorGroup, hex: string) => setDraft({ group, hex })
  const randomize = () => {
    const next = randomLook(look)
    actions.transact(() => { // one undo step, one sync message
      for (const layer of LAYERS) setPart(layer.id, next.parts[layer.id])
      for (const group of COLOR_GROUPS) setColor(group, next.colors[group])
    })
  }
  const download = async () => {
    if (!portrait) return
    const url = URL.createObjectURL(await toPngBlob(portrait, 4)) // 384×512
    const a = window.document.createElement("a")
    a.href = url
    a.download = "portrait.png"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const layer = LAYERS.find((l) => l.id === tab)!
  const selected = findPart(look.parts[tab])
  const groups = selected?.zones ?? []

  return (
    <div ref={rootRef} className={"pm" + (narrow ? " pm-narrow" : "")} style={{ "--pm-accent": accent } as CSSProperties}>
      <style>{CSS}</style>

      <div className="pm-stage">
        <div className="pm-frame">
          <div className="pm-mat"><PixelCanvas image={portrait} scale={scale} /></div>
        </div>
        {canEdit && (
          <div className="pm-actions">
            <button type="button" className="pm-button" onClick={randomize}>{t("action.randomize")}</button>
            <button type="button" className="pm-button" onClick={download} disabled={!portrait}>{t("action.download")}</button>
          </div>
        )}
        {canEdit && (
          <CardAction portrait={portrait} cardId={data.cardId ?? null} worldId={worldId}
            onLinked={(id) => actions.set("cardId", id)} onShow={showCard} />
        )}
      </div>

      {canEdit && (
        <div className="pm-controls">
          <div className="pm-tabs" role="tablist">
            {LAYERS.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={l.id === tab} className="pm-tab" onClick={() => setTab(l.id)}>
                {t(`layer.${l.id}`)}
              </button>
            ))}
          </div>

          <div className="pm-pieces">
            {layer.optional && (
              <PieceOption look={look} category={tab} partId={NONE} label={t("piece.none")}
                selected={look.parts[tab] === NONE} onPick={() => setPart(tab, NONE)} />
            )}
            {partsIn(tab).map((p) => (
              <PieceOption key={p.id} look={look} category={tab} partId={p.id} label={p.id}
                selected={look.parts[tab] === p.id} onPick={() => setPart(tab, p.id)} />
            ))}
          </div>

          {selected && (
            <div className="pm-colors">
              {groups.length === 0 && <p className="pm-hint">{t("piece.noColors")}</p>}
              {groups.map((g) => (
                <ColorRow key={g} label={t(`group.${g}`)} value={shown.colors[g]} palette={PALETTES[g]}
                  onPick={(hex) => setColor(g, hex)} onDrag={(hex) => dragColor(g, hex)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
// Neutral, translucent surfaces so we sit on the host's own panel in light or
// dark mode; the warm accent comes from the host theme when it has one.

const CSS = `
.pm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 28px; align-items: start;
  width: 100%; box-sizing: border-box; padding: 20px 4px 32px; color: inherit; font: inherit; }
.pm-narrow { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.pm-stage { display: grid; gap: 14px; justify-items: center; }

.pm-frame { padding: 10px; border-radius: 6px;
  background: linear-gradient(160deg, #4a3826, #2a1f15 55%, #3a2b1d);
  box-shadow: inset 0 0 0 1px rgba(255, 222, 170, 0.28), inset 0 0 0 4px #1b130c,
    inset 0 0 0 5px color-mix(in srgb, var(--pm-accent) 70%, transparent),
    0 1px 0 rgba(255,255,255,0.06), 0 18px 40px rgba(0, 0, 0, 0.45); }
.pm-mat { padding: 6px; background: #120d09; box-shadow: inset 0 2px 6px rgba(0,0,0,0.7); line-height: 0; }
.pm-pixels { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }

.pm-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.pm-button { padding: 9px 18px; border-radius: 10px; border: 1px solid rgba(127,127,127,0.4); background: transparent;
  color: inherit; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.pm-button:hover { background: rgba(127,127,127,0.12); }
.pm-button:disabled { opacity: 0.5; cursor: default; }
.pm-primary { background: var(--pm-accent); border-color: transparent; color: #1a140e; }
.pm-primary:hover { background: color-mix(in srgb, var(--pm-accent) 85%, white); }

.pm-card-action { display: grid; gap: 6px; justify-items: center; }
.pm-card-status { margin: 0; min-height: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
  align-items: center; font-size: 13px; opacity: 0.75; }
.pm-card-error { color: #e07a6a; }
.pm-link { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline;
  text-underline-offset: 2px; cursor: pointer; }
.pm-cards { position: absolute; z-index: 40; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: 280px;
  display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(24, 20, 16, 0.97); color: #ece3d6;
  border: 1px solid rgba(255, 235, 205, 0.14); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5); }
.pm-cards-search { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; font: inherit; font-size: 14px;
  color: inherit; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); outline: none; }
.pm-cards-search:focus { border-color: var(--pm-accent); }
.pm-cards-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; display: grid; gap: 2px; }
.pm-cards-item { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 0;
  border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.pm-cards-item[data-active] { background: rgba(255,255,255,0.09); }
.pm-cards-item small { opacity: 0.55; }
.pm-cards-empty { margin: 4px 2px; font-size: 13px; opacity: 0.6; }
.pm-cards-create { padding: 8px 10px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.25); background: transparent;
  color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }

.pm-controls { display: grid; gap: 16px; min-width: 0; width: 100%; }
.pm-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.pm-tab { padding: 7px 14px; border-radius: 999px; border: 1px solid transparent; background: transparent;
  color: inherit; font: inherit; font-size: 14px; opacity: 0.65; cursor: pointer; }
.pm-tab:hover { opacity: 1; background: rgba(127,127,127,0.1); }
.pm-tab[aria-selected="true"] { opacity: 1; border-color: rgba(127,127,127,0.35); background: rgba(127,127,127,0.14); }

.pm-pieces { display: flex; flex-wrap: wrap; gap: 10px; }
.pm-piece { padding: 4px; line-height: 0; border-radius: 10px; border: 1px solid rgba(127,127,127,0.25);
  background: rgba(127,127,127,0.08); cursor: pointer; }
.pm-piece:hover { border-color: rgba(127,127,127,0.6); }
.pm-piece[aria-pressed="true"] { border-color: var(--pm-accent); box-shadow: 0 0 0 1px var(--pm-accent); }

.pm-colors { display: grid; gap: 12px; padding-top: 4px; border-top: 1px solid rgba(127,127,127,0.2); }
.pm-color-row { display: grid; gap: 6px; padding-top: 8px; }
.pm-label { font-size: 13.5px; opacity: 0.6; }
.pm-hint { margin: 8px 0 0; font-size: 14px; opacity: 0.55; }
.pm-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.pm-swatch { position: relative; width: 34px; height: 34px; padding: 0; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(0,0,0,0.35); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
.pm-swatch:hover { transform: translateY(-1px); }
.pm-swatch[aria-pressed="true"] { outline: 2px solid var(--pm-accent); outline-offset: 2px; }
.pm-swatch-custom { background: conic-gradient(from 90deg, #c0504d, #d9a441, #4fa38a, #3a5fb8, #7d3fa0, #c0504d); }

.pm-picker-anchor { position: relative; display: inline-flex; }
.pm-picker { position: absolute; z-index: 40; top: calc(100% + 8px); left: 0; width: 260px; display: grid; gap: 12px;
  padding: 12px; border-radius: 12px; background: rgba(24, 20, 16, 0.97); color: #ece3d6;
  border: 1px solid rgba(255, 235, 205, 0.14); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5); }
.pm-picker-sv { position: relative; height: 170px; border-radius: 8px; cursor: crosshair; touch-action: none; }
.pm-picker-hue { position: relative; height: 14px; border-radius: 999px; cursor: pointer; touch-action: none;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
.pm-picker-thumb { position: absolute; width: 16px; height: 16px; border-radius: 50%; transform: translate(-50%, -50%);
  border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4); pointer-events: none; }
.pm-picker-footer { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
.pm-picker-chip { width: 22px; height: 22px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.2); }
.pm-picker-footer code { font-family: ui-monospace, monospace; opacity: 0.8; }
`

// ── Wiring into vvd ──────────────────────────────────────────────────────────

export function PortraitView({ document, context }: ToolRenderProps) {
  const coords = useMemo(() => ({ worldId: document.worldId, documentId: document.id }), [document.worldId, document.id])
  // useDocument opens the shared document: `data` is the live saved state,
  // `actions` writes to it (persisted + synced for everyone, automatically).
  const { data, status, actions, retry } = useDocument(coords, codec)
  return (
    <DocumentGate status={status} onRetry={retry}>
      {data && actions && <PortraitMaker data={data} actions={actions} canEdit={context.canEdit} worldId={document.worldId} />}
    </DocumentGate>
  )
}

export default defineTool({
  id: "portrait-maker",
  name: "Portrait Maker",
  documentTypes: ["portrait"],
  needs: [],
  render: PortraitView,
})
