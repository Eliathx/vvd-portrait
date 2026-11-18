import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"

import { useHostCapability, useWorldQuery } from "@vvd/sdk"

import { useT } from "@/i18n"

// Pick one of the world's Cards — reference, don't retype. The list is the live
// world catalog (useWorldQuery), filtered locally as you type, so it shows up
// instantly and a rename anywhere shows up here too. One click picks.
// Nothing matches? Create it as a real Card and pick that (still just an id).

export type CardRow = { id: string; name: string }

/** The world's Cards, live, sorted by name. */
export function useCards(): CardRow[] {
  const rows = useWorldQuery("documents", { type: "card" }) as CardRow[] | null | undefined
  return useMemo(
    () => [...(rows ?? [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [rows],
  )
}

type Props = {
  cards: CardRow[]
  current: string | null
  onPick: (cardId: string) => void
  onClose: () => void
}

export function CardPicker({ cards, current, onPick, onClose }: Props) {
  const t = useT()
  const search = useHostCapability("search")
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const q = query.trim().toLowerCase()
  const hits = useMemo(
    () => (q ? cards.filter((c) => (c.name || "").toLowerCase().includes(q)) : cards),
    [cards, q],
  )
  const exact = hits.some((c) => (c.name || "").toLowerCase() === q)
  const canCreate = !!q && !exact && !!search?.create

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  // Close on a click anywhere outside (the anchor holds the button that opened us).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const anchor = rootRef.current?.parentElement
      if (anchor && !anchor.contains(e.target as Node)) onClose()
    }
    window.addEventListener("pointerdown", onDown, true)
    return () => window.removeEventListener("pointerdown", onDown, true)
  }, [onClose])

  const create = async () => {
    if (!canCreate || creating) return
    setCreating(true)
    try {
      const made = await search.create(query.trim(), null)
      if (made?.id) onPick(made.id)
    } finally {
      setCreating(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose() }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter") {
      e.preventDefault()
      if (hits[active]) onPick(hits[active].id)
      else void create()
    }
  }

  return (
    <div ref={rootRef} className="pm-cards" role="dialog" aria-label={t("card.pickTitle")} onKeyDown={onKeyDown}>
      <input className="pm-cards-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder={t("card.search")} aria-label={t("card.search")} />

      {cards.length === 0 && !q && <p className="pm-cards-empty">{t("card.none")}</p>}

      {hits.length > 0 && (
        <ul ref={listRef} className="pm-cards-list">
          {hits.map((c, i) => (
            <li key={c.id}>
              <button type="button" className="pm-cards-item" data-index={i} aria-current={c.id === current || undefined}
                data-active={i === active || undefined} onMouseEnter={() => setActive(i)} onClick={() => onPick(c.id)}>
                <span>{c.name || t("card.untitled")}</span>
                {c.id === current && <small>{t("card.current")}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {q && hits.length === 0 && !canCreate && <p className="pm-cards-empty">{t("card.noMatch")}</p>}
      {canCreate && (
        <button type="button" className="pm-cards-create" onClick={() => void create()} disabled={creating}>
          {t("card.create", { name: query.trim() })}
        </button>
      )}
    </div>
  )
}
