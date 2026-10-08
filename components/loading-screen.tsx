"use client"

import { useEffect, useState } from "react"

interface LoadingScreenProps {
  onComplete: () => void
}

const HOLD_MS = 1300
const GLITCH_MS = 850

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [glitching, setGlitching] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const t1 = window.setTimeout(() => setGlitching(true), HOLD_MS)
    const t2 = window.setTimeout(() => setHidden(true), HOLD_MS + 120)
    const t3 = window.setTimeout(onComplete, HOLD_MS + GLITCH_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [onComplete])

  return (
    <div id="loading-screen" className={`dw-loader ${hidden ? "hidden" : ""}`}>
      <div className={`loader-content ${glitching ? "loader-glitching" : ""}`}>
        <span className="loader-logo" aria-hidden="true">
          <img src="/darkwired.png" alt="" />
        </span>
        <div className="loader-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  )
}
