"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useChatStore } from "@/hooks/use-chat-store"
import { Animator, FrameLines, FrameHeader } from "@/components/ui/navi_fx"
import { NaviBtn } from "@/components/navi_btn"
import { Bug, BugOff, ImagePlus, PenLine } from "lucide-react"
import { useNaviUi } from "@/components/navi_ui"
import { NaviTxt } from "@/components/ui/navi_txt"
import { SlowDecipherText } from "@/components/ui/decipher"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export type ChatMode = "chat" | "image" | "dark"

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
  const prevAnimOnRef = useRef(animOn)
  const prevModeRef = useRef<Exclude<ChatMode, "dark">>("chat")
  const prevChatIdRef = useRef<string | undefined>(undefined)
  const modeLabel =
    chatMode === "dark" ? "DARK MODE" : chatMode === "chat" ? "CHAT MODE" : "IMAGE MODE"

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

    prevModeRef.current = chatMode === "image" ? "image" : "chat"
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
              chatMode={chatMode}
              darkChatId={darkChatId}
              onChatSelect={pickChat}
              onNewChat={newChat}
            />

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <header className="relative z-10 h-14 shrink-0 border-b border-cyan-500/20 bg-transparent">
                <Animator active duration={{ enter: 0.3, exit: 0.2, stagger: 0.02 }}>
                  <div className="relative flex h-full w-full items-center px-3 sm:px-4">
                    <FrameHeader
                      className="pointer-events-none absolute inset-0 z-0 text-cyan-300/30"
                      padding={1}
                      contentLength={460}
                      decoWidth={5}
                    />
                    <div className="relative z-10 flex min-w-0 flex-1 items-center">
                      <div className="flex flex-1 items-center gap-3 ">
                      <SidebarTrigger className="text-cyan-400 hover:text-cyan-300 mr-0" />
                        <NaviBtn
                          id="anim-toggle"
                          frame="octagon"
                          aria-label={animOn ? "Disable animations" : "Enable animations"}
                          title={animOn ? "Disable animations" : "Enable animations"}
                          onClick={toggleAnim}
                          className={`octbtn ml-2 h-8 w-8 min-h-0 p-0 sm:ml-6 ${
                            animOn
                              ? "oct-send"
                              : "oct-stop"
                          }`}
                        >
                          {animOn ? (
                            <BugOff className="h-4 w-4" />
                          ) : (
                            <Bug className="h-4 w-4" />
                          )}
                        </NaviBtn>
                      <div className="ml-3 flex min-w-0 flex-col sm:ml-4">
                        <NaviTxt
                          as="h1"
                          className="truncate text-base font-semibold uppercase tracking-[0.2em] text-cyan-200 sm:text-lg"
                          text="N e k o G P T"
                          trigger="layout-title"
                        />
                        <div className="modestatus">
                          <span className="status-span" data-mode={chatMode}>
                            <SlowDecipherText
                              text={modeLabel}
                              trigger={chatMode}
                              durationMs={780}
                              stepMs={34}
                            />
                          </span>
                        </div>
                      </div>
                      {chatMode !== "dark" && (
                        <div className="ml-auto flex items-center gap-1 sm:ml-4 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => setChatMode("chat")}
                            aria-label="Chat mode"
                            title="Chat mode"
                            className={`modetog relative flex h-8 w-8 shrink-0 items-center justify-center px-0 sm:h-9 sm:w-10 ${
                              chatMode === "chat" ? "togon" : "togoff"
                            }`}
                          >
                            <FrameLines
                              className="togframe pointer-events-none absolute inset-0"
                              padding={1}
                            />
                            <PenLine className="relative z-10 h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatMode("image")}
                            aria-label="Image mode"
                            title="Image mode"
                            className={`modetog relative flex h-8 w-8 shrink-0 items-center justify-center px-0 transition-colors sm:h-9 sm:w-10 ${
                              chatMode === "image" ? "togon" : "togoff"
                            }`}
                          >
                            <FrameLines
                              className="togframe pointer-events-none absolute inset-0"
                              padding={1}
                            />
                            <ImagePlus className="relative z-10 h-4 w-4" />
                          </button>
                        </div>
                      )}
                     
                    </div>
                  </div>
                          </div>
                </Animator>
              </header>
              <section className="relative z-[2] flex-1 min-h-0 overflow-hidden">{children}</section>
            </main>
          </div>
        </Animator>
      </SessCtx.Provider>
    </SidebarProvider>
  )
}
