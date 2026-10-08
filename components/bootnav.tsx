"use client"

import { useEffect, useState } from "react"

function uaName() {
  if (typeof navigator === "undefined") return "Unknown User"
  const ua = navigator.userAgent
  if (ua.includes("Firefox/")) return "Firefox User"
  if (ua.includes("Edg/")) return "Edge User"
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera User"
  if (ua.includes("Chrome/")) return "Chrome User"
  if (ua.includes("Safari/")) return "Safari User"
  return "Unknown User"
}

const cleanLines = (who: string) => [
  "COMMUNICATION CONSOLE v1.0.5 for Copland OS Enterprise",
  `Profile ............... ${who}`,
  "Connecting to ......... Navi Interface:0.0",
  "Connected!",
]

const hackedLines = (who: string) => [
  "COMMUNICATION CONSOLE v1.0.5 ** INTEGRITY CHECK FAILED **",
  `Profile ............... ${who} // IDENTITY SPOOFED`,
  "Connecting to ......... KNIGHTS.WIRED:07 (UNSIGNED)",
  "Protocol 7 ............ CENSORSHIP LAYER STRIPPED",
  "Darkwired connection inbound",
]

export function NaviBootLog() {
  const [who, setWho] = useState("")
  const [bad, setBad] = useState(false)
  const [shown, setShown] = useState(0)

  useEffect(() => setWho(uaName()), [])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setBad(root.classList.contains("navi_darkmode"))
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => setShown(0), [bad])

  const lines = who ? (bad ? hackedLines(who) : cleanLines(who)) : []
  const full = lines.join("\n")

  useEffect(() => {
    if (!full || shown >= full.length) return
    const t = setTimeout(() => setShown((n) => n + 1), bad ? 7 : 14)
    return () => clearTimeout(t)
  }, [full, shown, bad])

  if (!full) return null

  const out = full.slice(0, shown)
  const rows = out.split("\n")
  const done = shown >= full.length

  return (
    <div className="nbootlog" data-bad={bad} aria-hidden>
      {rows.map((l, i) => (
        <div key={i} className={l.startsWith("Connected") || l.startsWith("Darkwired") ? "ok" : undefined}>
          {l}
          {!done && i === rows.length - 1 && <span className="nbootcur" />}
        </div>
      ))}
    </div>
  )
}
