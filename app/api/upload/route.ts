import { NextRequest } from "next/server"

const MAX_BYTES = 32 * 1024 * 1024
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function toCatbox(body: Blob, name: string) {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("fileToUpload", body, name)

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })

  const text = (await res.text()).trim()
  if (!res.ok || !text.startsWith("https://")) return null
  return text
}

async function toTmpfiles(body: Blob, name: string) {
  const form = new FormData()
  form.append("file", body, name)

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })
  if (!res.ok) return null

  const payload = (await res.json()) as { data?: { url?: string } }
  const page = payload?.data?.url
  if (!page) return null

  const pageRes = await fetch(page, { headers: { "User-Agent": UA } })
  if (!pageRes.ok) return null

  const html = await pageRes.text()
  const direct = html.match(/https:\/\/tmpfiles\.org\/dl\/[^"'<>\s]+/)
  return direct ? direct[0] : null
}

async function toLitterbox(body: Blob, name: string) {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("time", "72h")
  form.append("fileToUpload", body, name)

  const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: form,
    headers: { "User-Agent": UA },
  })

  const text = (await res.text()).trim()
  if (!res.ok || !text.startsWith("https://")) return null
  return text
}

export async function POST(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name") || "upload.bin"
    const contentType = request.headers.get("content-type") || "application/octet-stream"
    const declared = Number(request.headers.get("content-length") || "0")

    if (declared > MAX_BYTES) {
      return Response.json(
        { message: `Max file size permitted: ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    const blob = await request.blob()
    if (blob.size === 0) {
      return Response.json({ message: "No file provided" }, { status: 400 })
    }

    if (blob.size > MAX_BYTES) {
      return Response.json(
        { message: `Max file size permitted: ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    const hosts = [toCatbox, toTmpfiles, toLitterbox]
    const failed: string[] = []

    for (const host of hosts) {
      try {
        const url = await host(blob, name)
        if (url) {
          return Response.json({ url, name, size: blob.size, contentType })
        }
        failed.push(host.name)
      } catch {
        failed.push(host.name)
      }
    }

    return Response.json(
      { message: `All upload hosts failed (${failed.join(", ")})` },
      { status: 502 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return Response.json({ message }, { status: 500 })
  }
}
