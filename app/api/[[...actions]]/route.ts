import { NextRequest } from "next/server"

const API_ORIGIN = "https://api.arcangelo.net"
const MAX_BYTES = 32 * 1024 * 1024
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const REMOTE_ACTIONS: Record<string, string> = {
  navi: "/navi",
  navi_dark: "/navi_dark",
  imagine: "/imagine",
  multiEdit: "/multiEdit",
  assetSync: "/assetSync",
  create3D: "/create3D",
}

const actionFrom = (request: NextRequest): string | null => {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean)
  return segments.length === 2 && segments[0] === "api" ? segments[1] : null
}

async function toCatbox(body: Blob, name: string) {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("fileToUpload", body, name)

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })
  const text = (await response.text()).trim()
  return response.ok && text.startsWith("https://") ? text : null
}

async function toTmpfiles(body: Blob, name: string) {
  const form = new FormData()
  form.append("file", body, name)

  const response = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })
  if (!response.ok) return null

  const payload = (await response.json()) as { data?: { url?: string } }
  const page = payload.data?.url
  if (!page) return null

  const pageResponse = await fetch(page, { headers: { "User-Agent": UA } })
  if (!pageResponse.ok) return null

  const html = await pageResponse.text()
  const direct = html.match(/https:\/\/tmpfiles\.org\/dl\/[^"'<>\s]+/)
  return direct?.[0] ?? null
}

async function toLitterbox(body: Blob, name: string) {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("time", "72h")
  form.append("fileToUpload", body, name)

  const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })
  const text = (await response.text()).trim()
  return response.ok && text.startsWith("https://") ? text : null
}

async function uploadFile(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name") || "upload.bin"
    const contentType = request.headers.get("content-type") || "application/octet-stream"
    const declared = Number(request.headers.get("content-length") || "0")

    if (declared > MAX_BYTES) {
      return Response.json({ message: `Max file size permitted: ${MAX_BYTES / 1024 / 1024}MB` }, { status: 413 })
    }

    const blob = await request.blob()
    if (blob.size === 0) return Response.json({ message: "No file provided" }, { status: 400 })
    if (blob.size > MAX_BYTES) {
      return Response.json({ message: `Max file size permitted: ${MAX_BYTES / 1024 / 1024}MB` }, { status: 413 })
    }

    const failed: string[] = []
    for (const host of [toCatbox, toTmpfiles, toLitterbox]) {
      try {
        const url = await host(blob, name)
        if (url) return Response.json({ url, name, size: blob.size, contentType })
        failed.push(host.name)
      } catch {
        failed.push(host.name)
      }
    }

    return Response.json({ message: `All upload hosts failed (${failed.join(", ")})` }, { status: 502 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return Response.json({ message }, { status: 500 })
  }
}

const extFromMime = (mimeType: string): string => {
  const lower = mimeType.toLowerCase()
  if (lower.includes("image/jpeg")) return ".jpg"
  if (lower.includes("image/png")) return ".png"
  if (lower.includes("image/gif")) return ".gif"
  if (lower.includes("image/webp")) return ".webp"
  if (lower.includes("image/bmp")) return ".bmp"
  if (lower.includes("image/svg+xml")) return ".svg"
  return ".png"
}

const cleanName = (rawName: string): string => {
  const normalized = rawName
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .trim()
  return normalized.length > 0 ? normalized : "image.png"
}

const nameFromUrl = (url: URL, mimeType: string): string => {
  const lastPath = decodeURIComponent(url.pathname.split("/").pop() ?? "")
  const safeName = cleanName(lastPath)
  if (safeName !== "image.png" && safeName.includes(".")) return safeName
  const baseName = safeName === "image.png" ? "image" : safeName.replace(/\.[^/.]+$/, "")
  return `${baseName}${extFromMime(mimeType)}`
}

async function downloadImage(request: NextRequest) {
  const urlRaw = request.nextUrl.searchParams.get("url") ?? ""
  if (!urlRaw.trim()) return Response.json({ message: "Missing url parameter" }, { status: 400 })

  let url: URL
  try {
    url = new URL(urlRaw)
  } catch {
    return Response.json({ message: "Invalid url parameter" }, { status: 400 })
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return Response.json({ message: "Unsupported url protocol" }, { status: 400 })
  }

  try {
    const upstream = await fetch(url.toString(), { method: "GET", redirect: "follow", cache: "no-store" })
    if (!upstream.ok) return Response.json({ message: "Unable to fetch image" }, { status: 502 })

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream"
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${nameFromUrl(url, contentType)}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    })
    const length = upstream.headers.get("content-length")
    if (length) headers.set("Content-Length", length)

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return Response.json({ message: "Image download failed" }, { status: 500 })
  }
}

async function proxyRemote(request: NextRequest, action: string) {
  const endpoint = REMOTE_ACTIONS[action]
  if (!endpoint) return Response.json({ message: "Unknown API action" }, { status: 404 })

  const headers = new Headers()
  for (const name of ["accept", "content-type", "authorization", "x-api-key"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: "POST",
      headers,
      body: request.body ?? undefined,
      cache: "no-store",
      redirect: "follow",
      signal: request.signal,
      duplex: "half",
    }
    const upstream = await fetch(`${API_ORIGIN}${endpoint}`, init)
    const responseHeaders = new Headers()
    for (const name of ["content-type", "cache-control", "retry-after", "x-request-id", "content-disposition"]) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    if (!responseHeaders.has("cache-control")) responseHeaders.set("Cache-Control", "no-store")
    if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
      responseHeaders.set("Cache-Control", "no-cache, no-transform")
      responseHeaders.set("X-Accel-Buffering", "no")
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({ message: "Upstream API request failed" }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const action = actionFrom(request)
  if (action === "download-image") return downloadImage(request)
  return Response.json({ message: "Unknown API action" }, { status: 404 })
}

export async function POST(request: NextRequest) {
  const action = actionFrom(request)
  if (!action) return Response.json({ message: "Missing API action" }, { status: 404 })
  if (action === "upload") return uploadFile(request)
  return proxyRemote(request, action)
}
