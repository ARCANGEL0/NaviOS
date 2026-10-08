"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useChatStore } from "@/hooks/use-chat-store"
import { Animator } from "@/components/ui/navi_fx"
import { useNaviUi } from "@/components/navi_ui"
import modeStyles from "@/components/artifacts_workspace.module.css"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export type ChatMode = "chat" | "image" | "3d" | "dark"

interface ChatSessCtx {
  curChatId?: string
  setCurChatId: (chatId: string) => void
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void
  isDarkMode: boolean
  darkChatId?: string
}

const chatCookieKey = "current_chat_id"
const chatCookieAge = 60 * 60 * 24 * 365

const SessCtx = createContext<ChatSessCtx | null>(null)

export function useChatSess() {
  const context = useContext(SessCtx)
  if (!context) {
    throw new Error("useChatSess must be used within LayoutWrapper.")
  }
  return context
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { getOrNew, getChat, createTemporaryChat, deleteChat } = useChatStore()
  const { animOn, toggleAnim } = useNaviUi()
  const [curChatId, setCurChatId] = useState<string | undefined>()
  const [chatMode, setChatMode] = useState<ChatMode>("chat")
  const [darkChatId, setDarkChatId] = useState<string | undefined>()
  const [threeDHasUnread, setThreeDHasUnread] = useState(false)
  const [clock, setClock] = useState("--:--:--")
  const [nodeId, setNodeId] = useState("--")
  const prevAnimOnRef = useRef(animOn)
  const prevModeRef = useRef<Exclude<ChatMode, "dark">>("chat")
  const prevChatIdRef = useRef<string | undefined>(undefined)
  const modeLabel =
    chatMode === "dark"
      ? "DARK MODE"
      : chatMode === "3d"
        ? "3D WORKSPACE"
        : chatMode === "image"
          ? "IMAGE MODE"
          : "CHAT MODE"

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const on3DArtifactReady = () => {
      if (chatMode !== "3d") setThreeDHasUnread(true)
    }
    window.addEventListener("navi:3d-artifact-ready", on3DArtifactReady)
    return () => window.removeEventListener("navi:3d-artifact-ready", on3DArtifactReady)
  }, [chatMode])

  useEffect(() => {
    setNodeId(String(Math.floor(Math.random() * 60) + 2).padStart(2, "0"))
  }, [])

  const newChat = useCallback(() => {
    const newChat = getOrNew()
    setCurChatId(newChat.id)
  }, [getOrNew])

  const readCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null
    const target = `${name}=`
    const cookies = document.cookie.split(";")
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim()
      if (cookie.startsWith(target)) {
        return decodeURIComponent(cookie.substring(target.length))
      }
    }
    return null
  }, [])

  useEffect(() => {
    const storedChatId =
      localStorage.getItem("currentChatId") ??
      localStorage.getItem("curChatId") ??
      readCookie(chatCookieKey)

    if (storedChatId && getChat(storedChatId) && !getChat(storedChatId)?.temporary) {
      setCurChatId(storedChatId)
      localStorage.setItem("currentChatId", storedChatId)
      localStorage.setItem("curChatId", storedChatId)
      return
    }

    const newChat = getOrNew()
    setCurChatId(newChat.id)
  }, [getChat, getOrNew, readCookie])

  useEffect(() => {
    if (!curChatId) return
    const currentChat = getChat(curChatId)
    if (currentChat?.temporary) return

    localStorage.setItem("currentChatId", curChatId)
    localStorage.setItem("curChatId", curChatId)
    document.cookie = `${chatCookieKey}=${encodeURIComponent(curChatId)}; path=/; max-age=${chatCookieAge}; samesite=lax`
  }, [curChatId, getChat])

  useEffect(() => {
    const onNewChatEvt = () => {
      newChat()
    }

    window.addEventListener("newChat", onNewChatEvt)
    return () => window.removeEventListener("newChat", onNewChatEvt)
  }, [newChat])

  const activateDarkMode = useCallback(() => {
    if (darkChatId) {
      setCurChatId(darkChatId)
      setChatMode("dark")
      return
    }

    prevModeRef.current = chatMode === "image" ? "image" : chatMode === "3d" ? "3d" : "chat"
    prevChatIdRef.current = curChatId
    const nextDarkChat = createTemporaryChat()
    setDarkChatId(nextDarkChat.id)
    setCurChatId(nextDarkChat.id)
    setChatMode("dark")
  }, [chatMode, createTemporaryChat, curChatId, darkChatId])

  const deactivateDarkMode = useCallback(() => {
    const restoreMode = prevModeRef.current
    const restoreChatId = prevChatIdRef.current
    const tempChatId = darkChatId

    if (tempChatId) {
      deleteChat(tempChatId)
      setDarkChatId(undefined)
    }

    if (restoreChatId && getChat(restoreChatId)) {
      setCurChatId(restoreChatId)
    } else {
      const nextChat = getOrNew()
      setCurChatId(nextChat.id)
    }

    setChatMode(restoreMode)
    prevChatIdRef.current = undefined
  }, [darkChatId, deleteChat, getChat, getOrNew])

  useEffect(() => {
    if (!animOn) {
      if (chatMode !== "dark") {
        activateDarkMode()
      }
      return
    }

    if (chatMode === "dark") {
      deactivateDarkMode()
    }
  }, [activateDarkMode, animOn, chatMode, deactivateDarkMode])

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    if (!animOn) {
      root.classList.add("navi_darkmode")
    } else {
      root.classList.remove("navi_darkmode")
    }

    if (prevAnimOnRef.current && !animOn) {
      window.dispatchEvent(new CustomEvent("navi_darkmode_toast"))
    }
    prevAnimOnRef.current = animOn
  }, [animOn])

  const pickChat = (chatId: string) => {
    if (chatMode === "dark") return
    setCurChatId(chatId)
  }

  const sessVal = useMemo(
    () => ({
      curChatId,
      setCurChatId: pickChat,
      chatMode,
      setChatMode,
      isDarkMode: chatMode === "dark",
      darkChatId,
    }),
    [chatMode, curChatId, darkChatId]
  )

  return (
    <SidebarProvider>
      <SessCtx.Provider value={sessVal}>
        <Animator duration={{ enter: 0.28, exit: 0.12 }}>
          <div className="flex h-dvh w-full overflow-hidden">
            <AppSidebar
              curChatId={curChatId}
              chatMode={chatMode === "3d" ? "chat" : chatMode}
              darkChatId={darkChatId}
              onChatSelect={pickChat}
              onNewChat={newChat}
            />

            <main className="navios relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="nwin relative z-[2] m-2 flex-1 min-h-0">
                <div className="nwin-bar">
                  <span className="nwin-label" data-bad={!animOn}>
                    {animOn ? "[ COMMUNICATION CONSOLE ]" : "[ KNIGHTS//ROOT :: THE WIRED IS OPEN ]"}
                  </span>
                  <span className="nwin-grip" aria-hidden />
                  <span className="status-span nwin-label" data-mode={chatMode}>
                    {modeLabel}
                  </span>
                  <span className="nwin-ctrls">
                    <span className="nwin-sq" aria-hidden />
                    <span className="nwin-sq" aria-hidden />
                    <span className="nwin-sq" data-x="true" aria-hidden />
                  </span>
                </div>

              <div className={"nmenu relative z-10 shrink-0 " + modeStyles.modeNav}>
                <SidebarTrigger className="nmenu-trig" />
                <span className="nmenu-brand">ナビ NAVI</span>
                <button
                  type="button"
                  className="nmenu-item"
                  data-on={chatMode === "chat"}
                  onClick={() => setChatMode("chat")}
                  disabled={chatMode === "dark"}
                >
                  CHAT
                </button>
                <button
                  type="button"
                  className="nmenu-item"
                  data-on={chatMode === "image"}
                  onClick={() => setChatMode("image")}
                  disabled={chatMode === "dark"}
                >
                  IMAGE
                </button>
                <button
                  type="button"
                  className="nmenu-item"
                  data-on={chatMode === "3d"}
                  onClick={() => {
                    setThreeDHasUnread(false)
                    setChatMode("3d")
                  }}
                  disabled={chatMode === "dark"}
                  aria-label={threeDHasUnread ? "3D workspace, model ready" : "3D workspace"}
                >
                  3D
                  {threeDHasUnread && <span className={modeStyles.modeUnreadDot} aria-hidden />}
                </button>
                <button
                  type="button"
                  className="nmenu-item nmenu-corrupt"
                  data-on={!animOn}
                  onClick={toggleAnim}
                  title={animOn ? "Open layer 07" : "Close layer 07"}
                >
                  {animOn ? "CORRUPTED: OFF" : "CORRUPTED: ON"}
                </button>
                <span className="nmenu-spacer" />
              </div>

                <div className="nwin-body">
                  <section className="relative z-[2] flex-1 min-h-0 overflow-hidden">{children}</section>
                </div>
              </div>

              <div className="nstat relative z-10 shrink-0" data-bad={!animOn}>
                <span className="nstat-cell nstat-link">
                  {animOn ? (
                    <span className="nstat-dot" aria-hidden />
                  ) : (
                    <span className="nstat-x" aria-hidden>&#10005;</span>
                  )}
                  <i>LINK</i>
                  <b>{animOn ? "OK" : "COMPROMISED"}</b>
                </span>
                <span className="nstat-cell"><i>USER</i><b>{animOn ? "\u30ec\u30a4\u30f3" : "\u30c0\u30fc\u30af\u30ef\u30a4\u30e4\u30fc\u30c9"}</b></span>
                <span className="nstat-cell"><i>NODE</i><b>{animOn ? nodeId : "INACTIVE"}</b></span>
                <span className="nstat-cell nstat-jp"><i>LANG</i><b>&#26085;&#26412;&#35486;</b></span>
                <span className="nstat-cell"><i>{animOn ? "PROTO" : "PROTOCOL"}</i><b>{animOn ? "02" : "7"}</b></span>
                <span className="nstat-cell nstat-sig nstat-hide-sm">
                  <i>SIGNAL</i>
                  <span className="nstat-bars" aria-hidden>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span key={i} data-off={!animOn && i > 1} />
                    ))}
                  </span>
                </span>
                <span className="nstat-spacer" />
                <span className="nstat-cell nstat-clock"><b>{clock}</b></span>
              </div>
            </main>
          </div>
        </Animator>
      </SessCtx.Provider>
    </SidebarProvider>
  )
}
