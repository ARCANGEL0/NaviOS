"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Animator } from "@/components/ui/navi_fx"
import { NaviTxt } from "@/components/ui/navi_txt"

interface LoadingScreenProps {
  onComplete: () => void
}

const BOOTSTRAP_DELAY_MS = 1200
const EXIT_TRANSITION_MS = 500

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [isUiReady, setIsUiReady] = useState(false)

  useEffect(() => {
    setIsUiReady(true)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsExiting(true)
      window.setTimeout(onComplete, EXIT_TRANSITION_MS)
    }, BOOTSTRAP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className={`bootshell loadoverlay fixed inset-0 z-[12000] transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <Animator
        root
        active={isUiReady}
        duration={{ enter: 0.4, exit: 0.2, stagger: 0.06, interval: 9, intervalPause: 1.4 }}
      >
        <div className="relative h-full w-full">
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
            <Image
              src="/cat.gif"
              alt="NekoGPT Loading"
              width={112}
              height={112}
              unoptimized
              className="h-28 w-28 object-contain"
            />
            <NaviTxt
              as="p"
              className="mt-4 text-[0.8rem] uppercase tracking-[0.3em] text-cyan-200"
              text="N e k o | G P T"
              trigger={isUiReady ? 1 : 0}
            />
            <div className="relative mt-4 h-6 w-[min(20rem,82vw)]">
              <span className="load-ln line-a" />
              <span className="load-ln line-b" />
              <span className="load-ln line-c" />
            </div>
          </div>
        </div>
      </Animator>
    </div>
  )
}
