import { toPngBlob } from "@/render"

// Putting the portrait on a Card — the ONE place that knows how.
//
// How (confirmed by the vvd team, Nov 2026):
//   1. media.upload(file, { worldId, filename })  → { id }   setImage needs a world
//      media id, not a URL
//   2. documents.applyOps({ documentId, ops: [{ op: "card.setImage", mediaId }] })
//      a semantic op (images aren't fields, so applyField can't do it). Same engine
//      as vvd's own AI import; validated per op, a batch applies fully or not at all.
// `documents` comes with `writesWorld` in vvd.json, and `applyOps` is OPTIONAL:
// published/share hosts don't provide it. So every step has a fallback, and the
// button always gives the user their portrait.

export type AddResult = "assigned" | "uploaded" | "downloaded"

type Media = {
  upload?: (file: File, opts: { worldId: string; filename?: string }) => Promise<{ id: string }>
} | null | undefined

export type Documents = {
  applyOps?: (input: { documentId: string; ops: { op: string; [arg: string]: unknown }[] }) => Promise<unknown>
}

/** Set the Card's image. False when this host can't (no `documents` capability). */
async function assignImage(documents: Documents | null | undefined, cardId: string, mediaId: string): Promise<boolean> {
  if (!documents?.applyOps) return false
  await documents.applyOps({ documentId: cardId, ops: [{ op: "card.setImage", mediaId }] })
  return true
}

const safeName = (name: string) => (name.trim() || "portrait").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60)

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = window.document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function addPortraitToCard({ portrait, cardId, cardName, worldId, media, documents }: {
  portrait: ImageData
  cardId: string
  cardName: string
  worldId: string
  media: Media
  documents?: Documents | null
}): Promise<AddResult> {
  // 4× = 384×512: big enough for the Card's 3:4 image slot, still crisp pixels.
  const blob = await toPngBlob(portrait, 4)
  const file = new File([blob], `${safeName(cardName)}.png`, { type: "image/png" })

  if (media?.upload) {
    const made = await media.upload(file, { worldId, filename: file.name })
    try {
      if (await assignImage(documents, cardId, made.id)) return "assigned"
    } catch (err) {
      // The image is already in the world's images: say so instead of failing.
      console.warn("[portrait-maker] card.setImage failed; portrait left in world images", err)
    }
    return "uploaded"
  }

  // A host without uploads: hand the file over instead.
  downloadFile(file)
  return "downloaded"
}
