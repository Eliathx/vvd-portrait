import { type CSSProperties, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DocumentGate, type ToolRenderProps, defineTool, peekOrOpenDocument, useDocument, useHost, useHostCapability, useHostTheme } from "@vvd/sdk"

import { type AddResult, type Documents, addPortraitToCard } from "@/cardImage"
import { CardPicker, useCards } from "@/CardPicker"
import { codec } from "@/codec"
import { ColorPicker } from "@/ColorPicker"
import { Facepile, PRESENCE_CSS } from "@/Presence"
import { hexToRgb } from "@/color"
import { useT } from "@/i18n"
import { randomLook, resolveLook } from "@/look"
import { COLOR_GROUPS, COLOR_HOME, HEIGHT, LAYERS, NONE, OFFSET_RANGE, WIDTH, type Category, type ColorGroup, type Look } from "@/model"
import { PALETTES } from "@/palettes"
import { findPart, partsIn } from "@/parts/manifest"
import { renderLook, toPngBlob } from "@/render"
import { TOAST_CSS, ToastProvider, useToast } from "@/Toast"

/** Layers that have art. A layer with no pieces yet (say, hats) gets no tab; it appears once a piece is added. */
const SHOWN_LAYERS = LAYERS.filter((l) => partsIn(l.id).length > 0)

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

// ── Icons ────────────────────────────────────────────────────────────────────
// Simple line icons that take the text color (currentColor), so they follow the theme.

// The host's own CSS styles bare <svg>s, so size and stroke are pinned inline too.
const iconProps = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  style: {
    width: 18, height: 18, minWidth: 18, minHeight: 18, flex: "none", display: "block",
    fill: "none", stroke: "currentColor", strokeWidth: 2, overflow: "visible",
  },
} as const

function ShuffleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </svg>
  )
}

function NoneIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </svg>
  )
}

/** A picture with a plus: put this portrait on a card. */
function AddToCardIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
      <path d="m3 16 5-5 9 9" />
      <circle cx="9" cy="8" r="1.5" />
      <path d="M19 3v6" />
      <path d="M16 6h6" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
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
  // "None" gets its own tile: a portrait minus one piece is too easy to miss.
  if (partId === NONE) {
    return (
      <button type="button" className="pm-piece pm-piece-none" aria-pressed={selected} aria-label={label} title={label} onClick={onPick}>
        <NoneIcon />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button type="button" className="pm-piece" aria-pressed={selected} aria-label={label} title={label} onClick={onPick}>
      <PixelCanvas image={image} scale={1} />
    </button>
  )
}

function ColorRow({ label, value, palette, onPick, onDrag, onClosePicker }: {
  label: string
  value: string
  palette: string[]
  onPick: (hex: string) => void
  /** Fires continuously while the free picker is being dragged. */
  onDrag: (hex: string) => void
  /** The free picker closed (a drag cut short by Escape never commits). */
  onClosePicker: () => void
}) {
  const t = useT()
  const custom = !palette.includes(value)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => { setOpen(false); onClosePicker() }, [onClosePicker])
  return (
    <div className="pm-color-row">
      <span className="pm-label">{label}</span>
      <div className="pm-swatches" style={{ "--pm-swatch-count": palette.length + 1 } as CSSProperties}>
        {palette.map((hex, i) => (
          <button key={hex} type="button" className="pm-swatch" aria-pressed={hex === value}
            aria-label={t("color.option", { group: label, n: i + 1 })} title={hex}
            style={{ background: hex }} onClick={() => onPick(hex)} />
        ))}
        <span className="pm-picker-anchor">
          <button type="button" className="pm-swatch pm-swatch-custom" aria-pressed={custom} aria-expanded={open}
            aria-label={t("color.customFor", { group: label })} aria-haspopup="dialog"
            title={t("color.custom")} style={custom ? { background: value } : undefined}
            onClick={() => setOpen((o) => !o)} />
          {open && <ColorPicker value={value} onDrag={onDrag} onCommit={onPick} onClose={close} />}
        </span>
      </div>
    </div>
  )
}

/** Nudge the current layer up/down a few pixels. Double-click the value to reset. */
function OffsetControl({ value, onChange }: { value: number; onChange: (dy: number) => void }) {
  const t = useT()
  return (
    <div className="pm-offset" role="group" aria-label={t("offset.label")}>
      <span className="pm-label">{t("offset.label")}</span>
      <button type="button" className="pm-offset-step" aria-label={t("offset.up")}
        disabled={value <= -OFFSET_RANGE} onClick={() => onChange(value - 1)}>▲</button>
      <button type="button" className="pm-offset-value" title={t("offset.reset")} aria-label={t("offset.value", { n: value })}
        onDoubleClick={() => onChange(0)} onClick={(e) => e.detail === 0 && onChange(0)}>
        {value > 0 ? `+${value}` : value}
      </button>
      <button type="button" className="pm-offset-step" aria-label={t("offset.down")}
        disabled={value >= OFFSET_RANGE} onClick={() => onChange(value + 1)}>▼</button>
    </div>
  )
}

// ── The maker ────────────────────────────────────────────────────────────────

type Data = {
  parts: Readonly<Record<string, string>>
  colors: Readonly<Record<string, string>>
  offsets: Readonly<Record<string, number>>
  cardId: string | null
  origin?: Origin | null
  editsSinceRandom?: number
}
/** See `origin` in codec.ts. */
type Origin = "random" | "random_edited"

/**
 * Edits after Randomize as a few buckets, not a raw count: analytics wants few
 * distinct values. "0" = kept as rolled, "1-5" = touched up, "6+" = Randomize was
 * just a starting point. "n/a" = never randomized.
 */
type EditsBucket = "n/a" | "0" | "1-5" | "6+"
const editsBucket = (origin: Origin | null | undefined, n = 0): EditsBucket =>
  !origin ? "n/a" : n === 0 ? "0" : n <= 5 ? "1-5" : "6+"
type Actions = {
  map(name: "parts" | "colors"): { set(key: string, value: string): void }
  map(name: "offsets"): { set(key: string, value: number): void }
  set(name: "cardId", value: string | null): void
  set(name: "origin", value: Origin | null): void
  set(name: "editsSinceRandom", value: number): void
  transact(fn: () => void): void
}

// ── Add to card ──────────────────────────────────────────────────────────────

type CardStatus = "idle" | "saving" | AddResult | "error"

/**
 * "Add to card": always opens the Card picker (search, or one click on the list);
 * picking puts the portrait on that Card. The last Card is remembered by id
 * (never its name) so the picker can mark it.
 */
function CardAction({ portrait, cardId, worldId, origin, edits, onLinked, onShow, tools, children }: {
  portrait: ImageData | null
  /** How the portrait was made, reported with the add (analytics only). */
  origin: Origin | "hand_picked"
  /** Hand edits after Randomize, bucketed so the dashboard can break it down. */
  edits: EditsBucket
  /** Secondary buttons for the floating bar; "Add to card" comes last, as the primary. */
  tools?: ReactNode
  /** The portrait frame the bar floats over. */
  children: ReactNode
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
  const toast = useToast()
  const close = useCallback(() => setOpen(false), [])

  // Names are read live from the world, so a rename shows up here too.
  const nameOf = (id: string | null) => cards.find((c) => c.id === id)?.name || t("card.untitled")

  const send = async (id: string) => {
    if (!portrait) return
    const name = nameOf(id)
    setOpen(false)
    setStatus("saving")
    toast({ message: t("card.saving", { name }), sticky: true })
    try {
      const result = await addPortraitToCard({ portrait, cardId: id, cardName: name, worldId, media, documents })
      onLinked(id)
      setStatus(result)
      const done = { assigned: "card.done", uploaded: "card.uploaded", downloaded: "card.downloaded" } as const
      toast({ tone: "success", message: t(done[result], { name }), action: { label: t("card.show"), onClick: () => onShow(id) } })
      // Show the result right away, beside the portrait, without leaving the tool.
      if (result !== "downloaded") onShow(id)
      host?.analytics?.track("portrait_added_to_card", { result, relink: id === cardId ? "same" : "new", origin, edits })
    } catch (err) {
      console.error("[portrait-maker] add to card failed", err)
      setStatus("error")
      toast({ tone: "error", message: t("card.error") })
    }
  }

  return (
    <div className="pm-card-action">
      <div className="pm-frame-wrap">
        {children}
        {/* Floats over the portrait; shows on hover, keyboard focus, or while busy. */}
        <div className="pm-toolbar" data-active={open || status === "saving" ? "" : undefined}>
          {tools}
          <span className="pm-picker-anchor">
            <button type="button" className="pm-tool pm-tool-primary" disabled={!portrait || status === "saving"}
              aria-label={t("action.addToCard")} title={t("action.addToCard")}
              aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
              <AddToCardIcon />
            </button>
            {open && <CardPicker cards={cards} current={cardId} onPick={(id) => void send(id)} onClose={close} />}
          </span>
        </div>
      </div>
    </div>
  )
}

function PortraitMaker({ data, actions, handle, canEdit, worldId }: {
  data: Data
  actions: Actions
  handle: Parameters<typeof Facepile>[0]["handle"]
  canEdit: boolean
  worldId: string
}) {
  const t = useT()
  const accent = useAccent()
  const look = useMemo(
    () => resolveLook(data.parts, data.colors, data.offsets ?? {}),
    [data.parts, data.colors, data.offsets],
  )

  // While the free color picker is dragged it fires dozens of changes a second.
  // Writing each one to the shared document (and redrawing every thumbnail) is
  // what made it feel slow. So: the drag only updates a LOCAL draft that the big
  // preview shows, and the document gets the color once, when the picker closes.
  // `from` is set on commit: the document's color at that moment.
  const [draft, setDraft] = useState<{ group: ColorGroup; hex: string; from?: string } | null>(null)
  // After a commit, hand the color back to the document as soon as it moves: it
  // either caught up with us (no flicker back) or someone else changed it right
  // after (theirs wins — never keep showing a color the document doesn't have).
  // The timer is the safety net if no change ever arrives.
  useEffect(() => {
    if (!draft || draft.from === undefined) return
    const now = look.colors[draft.group]
    if (now === draft.hex || now !== draft.from) { setDraft(null); return }
    const timer = setTimeout(() => setDraft(null), 1500)
    return () => clearTimeout(timer)
  }, [look, draft])
  const shown = useMemo(
    () => (draft ? { ...look, colors: { ...look.colors, [draft.group]: draft.hex } } : look),
    [look, draft],
  )
  const portrait = usePortrait(shown)
  const [tab, setTab] = useState<Category>("head")
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
  const setOffset = (category: Category, dy: number) => actions.map("offsets").set(category, dy)
  const dragColor = (group: ColorGroup, hex: string) => setDraft({ group, hex })
  const dropUncommitted = useCallback(
    (group: ColorGroup) => setDraft((d) => (d && d.group === group && d.from === undefined ? null : d)),
    [],
  )
  // Analytics (see ANALYTICS.md + vvd.json → analytics.actions): what people DO,
  // never who they are. Fire-and-forget; a host without analytics just skips it.
  const track = useHost()?.analytics?.track
  // A hand edit after Randomize: "random" becomes "random_edited", and we count
  // how many edits followed. Done in the same transaction as the edit (one undo step).
  const editByHand = (edit: () => void) => actions.transact(() => {
    edit()
    if (!data.origin) return // hand-picked from the start: nothing to count
    if (data.origin === "random") actions.set("origin", "random_edited")
    actions.set("editsSinceRandom", (data.editsSinceRandom ?? 0) + 1)
  })
  const pickPiece = (category: Category, id: string) => {
    editByHand(() => setPart(category, id))
    track?.("piece_picked", { layer: category, piece: id || "none" })
  }
  const commitColor = (group: ColorGroup, hex: string) => {
    editByHand(() => setColor(group, hex))
    setDraft((d) => (d && d.group === group ? { group, hex, from: look.colors[group] } : d))
  }
  const nudge = (category: Category, dy: number) => editByHand(() => setOffset(category, dy))
  const randomize = () => {
    const next = randomLook(look)
    actions.transact(() => { // one undo step, one sync message
      for (const layer of LAYERS) setPart(layer.id, next.parts[layer.id])
      for (const layer of LAYERS) if (layer.movable) setOffset(layer.id, next.offsets[layer.id])
      for (const group of COLOR_GROUPS) setColor(group, next.colors[group])
      actions.set("origin", "random")
      actions.set("editsSinceRandom", 0)
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
  // One row per color the piece follows: named after its region ("Tie") when it
  // has one, else after the group ("Skin"). A group shows once even if used twice.
  const colorRows: { group: ColorGroup; label: string }[] = []
  for (const g of selected?.zones ?? []) colorRows.push({ group: g, label: t(`group.${g}`) })
  for (const r of selected?.regions ?? []) colorRows.push({ group: r.group, label: t(`region.${r.label}`) })
  const unique = colorRows.filter((row, i) => colorRows.findIndex((o) => o.group === row.group) === i)
  // A group with a home tab (skin → Head) is edited only there.
  const rows = unique.filter(({ group }) => !COLOR_HOME[group] || COLOR_HOME[group] === tab)

  const frame = (
    <div className="pm-frame">
      <div className="pm-mat"><PixelCanvas image={portrait} scale={scale} /></div>
    </div>
  )

  return (
    // The shell doesn't scroll, so toasts stay pinned to the bottom of the tool.
    <div className="pm-shell" style={{ "--pm-accent": accent } as CSSProperties}>
    <style>{CSS + PRESENCE_CSS + TOAST_CSS}</style>
    <ToastProvider closeLabel={t("toast.close")}>
    <div ref={rootRef} className={"pm" + (narrow ? " pm-narrow" : "")}>

      <div className="pm-stage">
        <Facepile handle={handle} />
        {canEdit ? (
          <CardAction portrait={portrait} cardId={data.cardId ?? null} worldId={worldId} origin={data.origin ?? "hand_picked"}
            edits={editsBucket(data.origin, data.editsSinceRandom)}
            onLinked={(id) => actions.set("cardId", id)} onShow={showCard}
            tools={<>
              <button type="button" className="pm-tool" onClick={randomize}
                aria-label={t("action.randomize")} title={t("action.randomize")}>
                <ShuffleIcon />
              </button>
              <button type="button" className="pm-tool" onClick={download} disabled={!portrait}
                aria-label={t("action.download")} title={t("action.download")}>
                <DownloadIcon />
              </button>
            </>}>
            {frame}
          </CardAction>
        ) : frame}
        {/* The selected piece's colors, right under the portrait and exactly as wide. */}
        {canEdit && rows.length > 0 && (
          <div className="pm-colors" style={{ width: WIDTH * scale }}>
            {rows.map(({ group: g, label }) => (
              <ColorRow key={g} label={label} value={shown.colors[g]} palette={PALETTES[g]}
                onPick={(hex) => commitColor(g, hex)} onDrag={(hex) => dragColor(g, hex)}
                onClosePicker={() => dropUncommitted(g)} />
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="pm-controls">
          <div className="pm-tabs" role="tablist">
            {SHOWN_LAYERS.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={l.id === tab} className="pm-tab" onClick={() => setTab(l.id)}>
                {t(`layer.${l.id}`)}
              </button>
            ))}
          </div>

          <div className="pm-pieces">
            {layer.optional && (
              <PieceOption look={look} category={tab} partId={NONE} label={t("piece.none")}
                selected={look.parts[tab] === NONE} onPick={() => pickPiece(tab, NONE)} />
            )}
            {partsIn(tab).map((p, i) => (
              <PieceOption key={p.id} look={look} category={tab} partId={p.id}
                label={t("piece.option", { layer: t(`layer.${tab}`), n: i + 1 })}
                selected={look.parts[tab] === p.id} onPick={() => pickPiece(tab, p.id)} />
            ))}
          </div>

          {layer.movable && (
            <OffsetControl value={look.offsets[tab]} onChange={(dy) => nudge(tab, dy)} />
          )}
        </div>
      )}
    </div>
    </ToastProvider>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
// Neutral, translucent surfaces so we sit on the host's own panel in light or
// dark mode; the warm accent comes from the host theme when it has one.

const CSS = `
.pm-shell { position: relative; width: 100%; height: 100%; min-height: 100%; color: inherit; font: inherit;
  /* With surface "plain" the world shows through; give ourselves the frosted backdrop. */
  background: color-mix(in srgb, var(--background, #16110b) 72%, transparent);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.pm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 28px; align-items: start;
  width: 100%; height: 100%; overflow-y: auto; box-sizing: border-box;
  padding: 28px clamp(16px, 3vw, 40px) 40px; color: inherit; font: inherit; }
.pm-narrow { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.pm-stage { display: grid; gap: 14px; justify-items: center; }

.pm-frame { border-radius: 12px; overflow: hidden; line-height: 0; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35); }
.pm-mat { line-height: 0; }
.pm-pixels { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }


.pm-card-action { display: grid; gap: 8px; justify-items: center; }

/* The portrait's tool bar: floats over the bottom-right corner, shown on hover,
   on keyboard focus, and while a card is being picked or saved. Always shown on
   touch screens, where there is no hover. */
.pm-frame-wrap { position: relative; line-height: 0; }
.pm-toolbar { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 2px; padding: 4px;
  border-radius: 12px; background: rgba(18, 15, 12, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #f2ebe1; line-height: normal;
  opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity 0.15s ease, transform 0.15s ease; }
.pm-frame-wrap:hover .pm-toolbar, .pm-toolbar:focus-within, .pm-toolbar[data-active] {
  opacity: 1; transform: none; pointer-events: auto; }
@media (hover: none) { .pm-toolbar { opacity: 1; transform: none; pointer-events: auto; } }
@media (prefers-reduced-motion: reduce) { .pm-toolbar { transition: none; } }
.pm-tool { width: 34px; height: 34px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: inherit;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.pm-tool:hover { background: rgba(255, 255, 255, 0.14); }
.pm-tool:disabled { opacity: 0.45; cursor: default; background: transparent; }
/* The main action: the theme's accent, set a little apart from the tools. */
.pm-tool-primary { margin-left: 4px; background: var(--pm-accent); color: #1a140e; }
.pm-tool-primary:hover { background: color-mix(in srgb, var(--pm-accent) 85%, white); }
.pm-tool-primary:disabled { background: var(--pm-accent); }
.pm-tool svg { width: 18px !important; height: 18px !important; flex: none; }
.pm-tool circle { fill: none; }
/* The card list opens upward from the bar, aligned to its right edge. */
.pm-toolbar .pm-cards { top: auto; bottom: calc(100% + 10px); left: auto; right: -4px; transform: none; }
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

/* Pieces scroll inside their own area (two rows, with a peek of the third so the
   scroll is discoverable), so a long list never pushes the colors out of view. */
.pm-pieces { display: flex; flex-wrap: wrap; gap: 10px; align-content: flex-start;
  max-height: 300px; overflow-y: auto; padding: 2px 6px 2px 2px; margin: -2px -6px -2px -2px;
  overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(127,127,127,0.4) transparent; }
.pm-piece { padding: 4px; line-height: 0; border-radius: 10px; border: 1px solid rgba(127,127,127,0.25);
  background: rgba(127,127,127,0.08); cursor: pointer; }
.pm-piece:hover { border-color: rgba(127,127,127,0.6); }
.pm-piece-none { width: ${WIDTH + 10}px; height: ${HEIGHT + 10}px; box-sizing: border-box; line-height: 1.2;
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border-style: dashed; color: inherit; font: inherit; font-size: 13px; opacity: 0.8; }
.pm-piece-none svg { width: 22px !important; height: 22px !important; }
.pm-piece[aria-pressed="true"] { border-color: var(--pm-accent); box-shadow: 0 0 0 1px var(--pm-accent); }

.pm-offset { display: flex; align-items: center; gap: 6px; margin-top: -4px; }
.pm-offset .pm-label { margin-right: 4px; }
.pm-offset-step { width: 30px; height: 28px; padding: 0; border-radius: 8px; border: 1px solid rgba(127,127,127,0.3);
  background: rgba(127,127,127,0.08); color: inherit; font-size: 11px; cursor: pointer; }
.pm-offset-step:hover:not(:disabled) { border-color: rgba(127,127,127,0.6); }
.pm-offset-step:disabled { opacity: 0.35; cursor: default; }
.pm-offset-value { min-width: 34px; padding: 0 4px; border: 0; background: none; color: inherit; font: inherit;
  font-size: 13.5px; font-variant-numeric: tabular-nums; text-align: center; cursor: pointer; }
.pm-offset-step:focus-visible, .pm-offset-value:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px; }

.pm-colors { display: grid; gap: 10px; max-width: 100%; box-sizing: border-box; }
.pm-color-row { display: grid; gap: 6px; }
.pm-label { font-size: 13.5px; opacity: 0.6; }
/* One row of equal squares that shrink to the portrait's width (max 34px each). */
.pm-swatches { display: grid; grid-template-columns: repeat(var(--pm-swatch-count, 9), minmax(0, 34px));
  justify-content: space-between; gap: 6px; }
.pm-swatches .pm-picker-anchor { display: block; }
.pm-swatches .pm-swatch { width: 100%; height: auto; aspect-ratio: 1; }
/* The last swatch opens the picker: align it to the row's right edge so it stays over the column. */
.pm-swatches .pm-picker { left: auto; right: 0; }
.pm-swatch { position: relative; width: 34px; height: 34px; padding: 0; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(0,0,0,0.35); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
.pm-swatch:hover { transform: translateY(-1px); }
.pm-tool:focus-visible, .pm-tab:focus-visible, .pm-piece:focus-visible, .pm-swatch:focus-visible,
.pm-cards-item:focus-visible, .pm-cards-create:focus-visible {
  outline: 2px solid var(--pm-accent); outline-offset: 2px; }
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
.pm-picker-hex { flex: 1; min-width: 0; box-sizing: border-box; padding: 5px 8px; border-radius: 7px;
  border: 1px solid rgba(127,127,127,0.3); background: rgba(127,127,127,0.08); color: inherit;
  font-family: ui-monospace, monospace; font-size: 13.5px; outline: none; }
.pm-picker-hex:focus { border-color: var(--pm-accent); }
.pm-picker-hex[aria-invalid="true"] { border-color: #c0504d; }
`

// ── Wiring into vvd ──────────────────────────────────────────────────────────

export function PortraitView({ document, context }: ToolRenderProps) {
  const coords = useMemo(() => ({ worldId: document.worldId, documentId: document.id }), [document.worldId, document.id])
  // useDocument opens the shared document: `data` is the live saved state,
  // `actions` writes to it (persisted + synced for everyone, automatically).
  const { data, status, actions, handle, retry } = useDocument(coords, codec)
  return (
    <DocumentGate status={status} onRetry={retry}>
      {data && actions && <PortraitMaker data={data} actions={actions} handle={handle} canEdit={context.canEdit} worldId={document.worldId} />}
    </DocumentGate>
  )
}

export default defineTool({
  id: "portrait-maker",
  name: "Portrait Maker",
  documentTypes: ["portrait"],
  needs: [],
  // "plain": we own the whole tab instead of the host's fixed-width frosted
  // "panel" card, so the editor uses all the space it is given.
  surface: "plain",
  render: PortraitView,
})
