import { useDocumentPresence, useHostCapability, useResolvedMedia } from "@vvd/sdk"

import { useT } from "@/i18n"

// Who else has this portrait open — so a hair change "by itself" has a face.
// Identity (name, color, avatar) is stamped by the host; we only draw it.
// Alone? Nothing is shown.

type Handle = Parameters<typeof useDocumentPresence>[0]
type Peer = ReturnType<typeof useDocumentPresence>[number]

const MAX = 4

function PeerFace({ peer }: { peer: Peer }) {
  const media = useHostCapability("media")
  const avatar = useResolvedMedia(media, peer.avatarMediaId ?? null)
  const initial = peer.name ? peer.name.trim().slice(0, 1).toUpperCase() : "?"
  return (
    <span className="pm-face" title={peer.name ?? ""} style={{ background: peer.color }}>
      {avatar ? <img src={avatar} alt="" /> : initial}
    </span>
  )
}

export function Facepile({ handle }: { handle: Handle }) {
  const t = useT()
  const others = useDocumentPresence(handle).filter((p) => !p.isSelf)
  if (others.length === 0) return null

  const names = others.map((p) => p.name).filter(Boolean).join(", ")
  return (
    <div className="pm-facepile" role="group" aria-label={t("presence.label", { names })}>
      {others.slice(0, MAX).map((peer) => <PeerFace key={peer.userId} peer={peer} />)}
      {others.length > MAX && <span className="pm-face pm-face-more">+{others.length - MAX}</span>}
    </div>
  )
}

export const PRESENCE_CSS = `
.pm-facepile { display: flex; align-items: center; justify-content: center; padding-left: 8px; }
.pm-face { width: 26px; height: 26px; margin-left: -8px; border-radius: 50%; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  font-size: 11.5px; font-weight: 700; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.35);
  border: 2px solid var(--color-panel-bg, #1b150f); box-sizing: border-box; }
.pm-face img { width: 100%; height: 100%; object-fit: cover; }
.pm-face-more { background: rgba(127,127,127,0.35); text-shadow: none; }
`
