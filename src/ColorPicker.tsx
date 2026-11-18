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
        <code>{hex}</code>
      </div>
    </div>
  )
}
