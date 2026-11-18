import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react"

import { type HSV, hexToHsv, hsvToHex } from "@/color"
import { useT } from "@/i18n"

// Our own color picker, replacing the browser's native one (which lagged while
// dragging and looked out of place). A saturation × brightness square plus a hue
// strip. While dragging we only call `onDrag` (a local preview); `onCommit` fires
// once, on release — that's when the color is written to the document.

type Props = {
  value: string
  onDrag: (hex: string) => void
  onCommit: (hex: string) => void
  onClose: () => void
}

/** Call `onMove` with the pointer position inside `el` (0–1 on each axis) while dragging. */
function startDrag(
  e: ReactPointerEvent<HTMLElement>,
  onMove: (x: number, y: number) => void,
  onEnd: () => void,
) {
  const el = e.currentTarget
  el.setPointerCapture(e.pointerId) // keep receiving moves even outside the element
  const move = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect()
    const clamp = (n: number) => Math.min(1, Math.max(0, n))
    onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height))
  }
  const up = () => {
    el.removeEventListener("pointermove", move)
    el.removeEventListener("pointerup", up)
    onEnd()
  }
  el.addEventListener("pointermove", move)
  el.addEventListener("pointerup", up)
  move(e.nativeEvent) // a plain click also picks
}

/** "#abc", "abc", "#aabbcc" or "aabbcc" → "#aabbcc"; anything else → null. */
export function parseHex(text: string): string | null {
  const s = text.trim().replace(/^#/, "").toLowerCase()
  if (/^[0-9a-f]{6}$/.test(s)) return "#" + s
  if (/^[0-9a-f]{3}$/.test(s)) return "#" + [...s].map((c) => c + c).join("")
  return null
}

/**
 * The hex field: type a color, see it live as soon as it's valid, and it's
 * saved on Enter or when you leave the field. An unfinished or invalid entry
 * goes back to the current color on leave. While you're not typing in it, it
 * follows the square and the strip.
 */
function HexInput({ value, label, onType, onDone }: {
  value: string
  label: string
  onType: (hex: string) => void
  onDone: (hex: string) => void
}) {
  const [text, setText] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setText(value) }, [value, editing])

  // A click outside closes the picker before the field ever blurs, so keep a
  // valid entry that's still being typed when we unmount.
  const pending = useRef<{ editing: boolean; text: string; onDone: typeof onDone }>({ editing, text, onDone })
  pending.current = { editing, text, onDone }
  useEffect(() => () => {
    const { editing, text, onDone } = pending.current
    const hex = editing ? parseHex(text) : null
    if (hex) onDone(hex)
  }, [])

  const finish = () => {
    setEditing(false)
    const hex = parseHex(text)
    if (hex) onDone(hex)
    else setText(value)
  }
  return (
    <input
      className="pm-picker-hex"
      value={text}
      aria-label={label}
      spellCheck={false}
      maxLength={7}
      aria-invalid={editing && !parseHex(text)}
      onFocus={(e) => { setEditing(true); e.currentTarget.select() }}
      onChange={(e) => {
        setText(e.target.value)
        const hex = parseHex(e.target.value)
        if (hex) onType(hex)
      }}
      onBlur={finish}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
    />
  )
}

export function ColorPicker({ value, onDrag, onCommit, onClose }: Props) {
  // We keep HSV in local state (not just the hex) so the hue survives when the
  // color goes fully grey or black — otherwise the strip would jump to red.
  const t = useT()
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value))
  const latest = useRef(hsv)
  const rootRef = useRef<HTMLDivElement>(null)

  const update = (next: HSV) => {
    latest.current = next
    setHsv(next)
    onDrag(hsvToHex(next))
  }
  const commit = () => onCommit(hsvToHex(latest.current))

  // Close on Escape or on a click anywhere outside the popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    const onDown = (e: PointerEvent) => {
      // The parent holds the swatch that toggles us, so a click there isn't "outside".
      const anchor = rootRef.current?.parentElement
      if (anchor && !anchor.contains(e.target as Node)) onClose()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown, true)
    }
  }, [onClose])

  const hex = hsvToHex(hsv)
  return (
    <div ref={rootRef} className="pm-picker" role="dialog" aria-label={t("color.custom")}>
      <div
        className="pm-picker-sv"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        onPointerDown={(e) => startDrag(e, (x, y) => update({ ...latest.current, s: x, v: 1 - y }), commit)}
      >
        <span className="pm-picker-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div
        className="pm-picker-hue"
        onPointerDown={(e) => startDrag(e, (x) => update({ ...latest.current, h: x * 360 }), commit)}
      >
        <span className="pm-picker-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: "50%", background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="pm-picker-footer">
        <span className="pm-picker-chip" style={{ background: hex }} />
        <HexInput
          value={hex}
          label={t("color.hex")}
          onType={(typed) => update(hexToHsv(typed))}
          onDone={(typed) => {
            latest.current = hexToHsv(typed)
            setHsv(latest.current)
            onCommit(typed)
          }}
        />
      </div>
    </div>
  )
}
