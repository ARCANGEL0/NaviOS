"use client"

import {
  Animator,
  AnimatorGeneralProvider,
  BleepsOnAnimator,
  BleepsProvider,
  GridLines,
  MovingLines,
  useBleeps,
} from "@/components/ui/navi_fx"
import type { BleepsManagerProps } from "@/components/ui/navi_fx"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

type BleepName = "hover" | "click" | "transition" | "assemble" | "notify" | "type" | "content"
interface UiCtxVal {
  animOn: boolean
  toggleAnim: () => void
}

const UiCtx = createContext<UiCtxVal | null>(null)

const uiSel = [
  "button",
  "[role='button']",
  "a[href]",
  "input",
  "textarea",
  "select",
  "[data-navi_interactive]",
].join(",")

function isDisEl(element: Element): boolean {
  if (element.matches("[aria-disabled='true']")) {
    return true
  }
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.disabled
  }
  return false
}

function findUiEl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null
  }
  const element = target.closest(uiSel)
  if (!element || isDisEl(element)) {
    return null
  }
  return element
}

function UiBleepBridge() {
  const bleeps = useBleeps<BleepName>()
  const hoverRef = useRef<Element | null>(null)

  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      const interactiveElement = findUiEl(event.target)
      if (!interactiveElement || interactiveElement === hoverRef.current) {
        return
      }
      hoverRef.current = interactiveElement
      bleeps.hover?.play("ui-hover")
    }

    const onClick = (event: MouseEvent) => {
      const interactiveElement = findUiEl(event.target)
      if (!interactiveElement) {
        return
      }
      bleeps.click?.play("ui-click")
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      const interactiveElement = findUiEl(event.target)
      if (!interactiveElement) {
        return
      }
      bleeps.click?.play("ui-keyboard")
    }

    document.addEventListener("pointerover", onPointerOver, true)
    document.addEventListener("click", onClick, true)
    document.addEventListener("keydown", onKeyDown, true)

    return () => {
      document.removeEventListener("pointerover", onPointerOver, true)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [bleeps])

  return null
}

function UiBleepBoot() {
  const bleeps = useBleeps<BleepName>()

  useEffect(() => {
    bleeps.hover?.load?.()
    bleeps.click?.load?.()
    bleeps.transition?.load?.()
    bleeps.assemble?.load?.()
    bleeps.notify?.load?.()
    bleeps.type?.load?.()
    bleeps.content?.load?.()
  }, [bleeps])

  useEffect(() => {
    const unlockAudio = () => {
      bleeps.click?.play("unlock-audio")
    }

    window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true })
    window.addEventListener("keydown", unlockAudio, { once: true, capture: true })

    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true)
      window.removeEventListener("keydown", unlockAudio, true)
    }
  }, [bleeps])

  return null
}

interface UiProviderProps {
  children: ReactNode
}

export function useNaviUi() {
  const context = useContext(UiCtx)
  if (!context) {
    throw new Error("useNaviUi must be used within NaviUiProvider. /debug test")
  }
  return context
}

export function NaviUiProvider({ children }: UiProviderProps) {
  const [animOn, setAnimOn] = useState(true)

  const bleepCfg = useMemo<BleepsManagerProps<BleepName>>(
    () => ({
      master: { volume: 0.82 },
      common: { preload: true, maxPlaybackDelay: 0.14, muteOnWindowBlur: true },
      categories: {
        interaction: { volume: 0.78 },
        transition: { volume: 0.7 },
        notification: { volume: 0.76 },
      },
      bleeps: {
        click: {
          category: "interaction",
          sources: [{ src: "/assets/sounds/click.mp3", type: "audio/mpeg" }],
        },
        hover: {
          category: "interaction",
          sources: [{ src: "/assets/sounds/hover.mp3", type: "audio/mpeg" }],
        },
        transition: {
          category: "transition",
          sources: [{ src: "/assets/sounds/transition.mp3", type: "audio/mpeg" }],
        },
        assemble: {
          category: "notification",
          sources: [{ src: "/assets/sounds/assemble.mp3", type: "audio/mpeg" }],
        },
        notify: {
          category: "notification",
          sources: [{ src: "/assets/sounds/notify.mp3", type: "audio/mpeg" }],
        },
        type: {
          category: "interaction",
          sources: [{ src: "/assets/sounds/click.mp3", type: "audio/mpeg" }],
        },
        content: {
          category: "notification",
          sources: [{ src: "/assets/sounds/assemble.mp3", type: "audio/mpeg" }],
        },
      },
    }),
    []
  )

  const ctxVal = useMemo<UiCtxVal>(
    () => ({
      animOn,
      toggleAnim: () => setAnimOn((prev) => !prev),
    }),
    [animOn]
  )

  const gridLineColor = animOn
    ? "rgba(23, 233, 255, 0.14)"
    : "rgba(255, 52, 90, 0.18)"
  const movingLineColor = animOn
    ? "rgba(0, 215, 255, 0.08)"
    : "rgba(255, 52, 90, 0.12)"

  return (
    <UiCtx.Provider value={ctxVal}>
      <AnimatorGeneralProvider
        disabled={!animOn}
        duration={animOn ? { enter: 0.24, exit: 0.12 } : { enter: 0, exit: 0 }}
      >
        <BleepsProvider
          {...bleepCfg}
          common={{
            ...bleepCfg.common,
            disabled: false,
          }}
        >
          <Animator
            root
            active={animOn}
            duration={{ enter: 0.5, exit: 0.2 }}
          >
            <BleepsOnAnimator transitions={{ entering: "click", exiting: "assemble" }} />
            <UiBleepBoot />
            <UiBleepBridge />
            <div aria-hidden className="bkgd">
              <GridLines
                lineColor={gridLineColor}
                lineWidth={1}
                distance={42}
                horizontalLineDash={[2, 8]}
                verticalLineDash={[2, 9]}
              />
              {animOn && (
                <MovingLines
                  lineColor={movingLineColor}
                  lineWidth={1}
                  distance={136}
                  sets={2}
                />
              )}
            </div>
            {children}
          </Animator>
        </BleepsProvider>
      </AnimatorGeneralProvider>
    </UiCtx.Provider>
  )
}
