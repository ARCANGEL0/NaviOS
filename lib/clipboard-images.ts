const MAX_CLIPBOARD_IMAGE_BYTES = 32 * 1024 * 1024
const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|gif|webp));base64,([\s\S]+)$/i

export interface ClipboardImages {
  files: File[]
  hasImage: boolean
  error: "size" | "invalid" | null
}

// updt: i forgot to add, now CTRL + V'ing images will work to paste directly, rather than uploading.
export function readClipboardImages(clipboard: DataTransfer): ClipboardImages {
  const imageItems = Array.from(clipboard.items).filter(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  )
  const files = imageItems
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)

  if (imageItems.length > 0) {
    return {
      files,
      hasImage: true,
      error: files.length === 0 ? "invalid" : null,
    }
  }

  const plainText = clipboard.getData("text/plain").trim()
  const htmlImage = clipboard
    .getData("text/html")
    .match(/src=["'](data:image\/[^"']+)["']/i)?.[1]
  const dataUri = /^data:image\//i.test(plainText) ? plainText : htmlImage
  if (!dataUri) return { files: [], hasImage: false, error: null }

  const match = dataUri.match(DATA_IMAGE_PATTERN)
  if (!match) return { files: [], hasImage: true, error: "invalid" }

  const mime = match[1].toLowerCase()
  const encoded = match[2].replace(/\s/g, "")
  if (!/^[a-z\d+/]*={0,2}$/i.test(encoded)) {
    return { files: [], hasImage: true, error: "invalid" }
  }

  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0
  if (Math.floor((encoded.length * 3) / 4) - padding > MAX_CLIPBOARD_IMAGE_BYTES) {
    return { files: [], hasImage: true, error: "size" }
  }

  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    if (bytes.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) {
      return { files: [], hasImage: true, error: "size" }
    }

    const extension = mime === "image/jpeg" ? "jpg" : mime.slice("image/".length)
    const file = new File([bytes], `clipboard-image-${Date.now()}.${extension}`, {
      type: mime,
    })
    return { files: [file], hasImage: true, error: null }
  } catch {
    return { files: [], hasImage: true, error: "invalid" }
  }
}
