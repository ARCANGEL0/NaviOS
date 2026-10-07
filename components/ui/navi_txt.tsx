"use client"

import { useEffect } from "react"
import { Text, useBleeps } from "@/components/ui/navi_fx"

interface NaviTxtProps {
  text: string
  as?: keyof HTMLElementTagNameMap
  className?: string
  trigger?: string | number
  blink?: boolean
}

export function NaviTxt({
  text,
  as = "span",
  className,
  trigger,
  blink = false,
}: NaviTxtProps) {
  const bleeps = useBleeps<"type">()

  useEffect(() => {
    const normalizedText = text.replace(/\s+/g, "")
    const pulseCount = Math.min(Math.max(normalizedText.length, 1), 28)
    if (pulseCount <= 0) return

    let emitted = 0
    const intervalMs = 42
    const intervalId = window.setInterval(() => {
      bleeps.type?.play("text-type")
      emitted += 1
      if (emitted >= pulseCount) {
        window.clearInterval(intervalId)
      }
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [bleeps, text, trigger])

  return (
    <Text
      key={`typed-${trigger ?? "default"}-${text}`}
      as={as}
      manager="sequence"
      fixed
      blink={blink}
      className={className}
    >
      {text}
    </Text>
  )
}
