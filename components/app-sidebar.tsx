"use client"

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { MessageSquare, Pencil, Trash2 } from "lucide-react"
import { useChatStore } from "@/hooks/use-chat-store"
import { ScrollArea } from "@/components/ui/scrolview"
import { Input } from "@/components/ui/input"
import { Animator, FrameNefrex, FrameUnderline, useBleeps } from "@/components/ui/navi_fx"
import { NaviBtn } from "@/components/navi_btn"
import { NaviTxt } from "@/components/ui/navi_txt"
import {
  navi_under_1,
  navi_card_1,
  navi_panel_1,
} from "@/components/ui/frames"

interface AppSidebarProps {
  curChatId?: string
  chatMode: "chat" | "image" | "dark"
  darkChatId?: string
  onChatSelect?: (chatId: string) => void
  onNewChat?: () => void
}

const toastFrameStyle = {
  "--arwes-frames-bg-color": "transparent",
  "--arwes-frames-line-color": "rgba(109, 248, 255, 0.95)",
  "--arwes-frames-deco-color": "rgba(190, 255, 255, 0.98)",
  "--arwes-frames-bg-filter": "none",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(0, 239, 255, 0.36))",
} as CSSProperties

export function AppSidebar({ curChatId, chatMode, darkChatId, onChatSelect, onNewChat }: AppSidebarProps) {
  const { chats, deleteChat, updateChat } = useChatStore()
  const bleeps = useBleeps<"notify">()
  const { isMobile, setOpenMobile } = useSidebar()
  const [editId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditingTitle] = useState("")
  const [hotChatIds, setHotChatIds] = useState<Set<string>>(() => new Set())
  const editRef = useRef<HTMLInputElement>(null)
  const lastSeenMsgByChatRef = useRef<Map<string, string>>(new Map())
  const hasMountedRef = useRef(false)
  const isDarkMode = chatMode === "dark"
  const visibleChats = chats.filter((chat) => {
    if (chat.temporary) {
      return chat.id === darkChatId
    }
    return chat.messages.length > 0
  })
  const toastChat = visibleChats.find((chat) => hotChatIds.has(chat.id))
  const notifToast = toastChat ? `${toastChat.title} | New message!!` : null

  useEffect(() => {
    if (editId) {
      editRef.current?.focus()
      editRef.current?.select()
    }
  }, [editId])

  const markChatHot = useCallback((chatId: string) => {
    setHotChatIds((prev) => {
      if (prev.has(chatId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(chatId)
      return next
    })
  }, [])
// msgs
  useEffect(() => {
    const nextSeen = new Map<string, string>()

    visibleChats.forEach((chat) => {
      const lastAssistantMessage = [...chat.messages].reverse().find((message) => message.role === "assistant" && message.responseState !== "loading")
      nextSeen.set(chat.id, lastAssistantMessage?.id ?? "")
    })

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      lastSeenMsgByChatRef.current = nextSeen
      return
    }

     const prevSeen = lastSeenMsgByChatRef.current
    if (prevSeen.size === 0) {
      lastSeenMsgByChatRef.current = nextSeen
      return
    }

    let hasNewInactiveMessage = false

    visibleChats.forEach((chat) => {
      const currentAssistantId = nextSeen.get(chat.id) ?? ""
      if (!currentAssistantId) return
     const previousAssistantId = prevSeen.get(chat.id) ?? ""
      if (previousAssistantId === currentAssistantId) return
       if (chat.id === curChatId) return

        markChatHot(chat.id)
      hasNewInactiveMessage = true
    })
/// notif settings
    if (hasNewInactiveMessage) {
      bleeps.notify?.play("toast-notify")
    }

    lastSeenMsgByChatRef.current = nextSeen
  }, [bleeps, curChatId, markChatHot, visibleChats])

  useEffect(() => {
    if (!curChatId) return
    setHotChatIds((prev) => {
              if (!prev.has(curChatId)) return prev
        const next = new Set(prev)
      next.delete(curChatId)
      return next
    })
  }, [curChatId])

  const closeSideM = () => {
    if (isMobile) { // check if its mobile
      setOpenMobile(false)
    }
  }

  const pickChat = (chatId: string) => {
    if (isDarkMode && chatId !== darkChatId) {
      return
    }
    setHotChatIds((prev) => {
      if (!prev.has(chatId)) return prev
      const next = new Set(prev)
      next.delete(chatId)
      return next
    })
    onChatSelect?.(chatId)
    closeSideM()
  }

  const makeChat = () => {
    if (isDarkMode) return
    onNewChat?.()
    closeSideM()
  }

  const delChat = (event: React.MouseEvent, chatId: string) => {
    event.stopPropagation()
    if (isDarkMode) return
    deleteChat(chatId)
    setHotChatIds((prev) => {
      if (!prev.has(chatId)) return prev
       const next = new Set(prev)
      next.delete(chatId)
      return next
    })

    if (curChatId === chatId) {
      onNewChat?.()
    }
  }

  const renameStart = (event: React.MouseEvent, chatId: string, currentTitle: string) => {
    event.stopPropagation()
    if (isDarkMode) return
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
  }

  const renameCancel = () => {
    setEditingChatId(null)
    setEditingTitle("")
  }

  const renameSave = (chatId: string, currentTitle: string) => {
    const newTitle = editTitle.trim()

    if (!newTitle || newTitle === currentTitle) {
      renameCancel()
      return
    }
       updateChat(chatId, { title: newTitle })
      renameCancel()
  }

  return (
    <Sidebar className={`border-r border-cyan-500/20 ${isDarkMode ? "sidebar-dark-locked" : ""}`}>
      <SidebarContent className="relative flex h-full flex-col gap-0 overflow-hidden bg-black/5 backdrop-blur-sm">
        <FrameNefrex
          {...navi_panel_1}
          className="pointer-events-none absolute inset-1 z-[1] opacity-55"
        />
        <Image
          src="/cat.gif"
          alt="NekoGPT"
          width={96}
          height={96}
          unoptimized
          className="navi_logo relative z-10 mx-auto h-24 w-24 bg-transparent object-contain"
        />

        <div className="relative z-10 flex h-full flex-col content-center justify-center gap-0 justify-items-center">
          <SidebarSeparator />

          <NaviBtn
            onClick={makeChat}
            frame="underline"
            className="navi_btn_cyan_glow newChat-btn mx-3 mt-2 w-auto justify-center"
            disabled={isDarkMode}
          >
            <NaviTxt as="span" className="font-medium tracking-[0.16em]" text="[+] NEW CHAT" trigger="new-chat" />
          </NaviBtn>

          <SidebarGroup className="flex min-h-0 flex-1 flex-col">
            <SidebarGroupContent className="mt-2 flex min-h-0 flex-1">
              <ScrollArea className="h-full w-full px-2 m-6">
                <Animator active duration={{ enter: 0.18, exit: 0.1, stagger: 0.015 }}>
                  <SidebarMenu className=" mb-24 flex flex-1 mt-0 mx-12 flex-col gap-1">
                  {visibleChats.map((chat) => {
                    const isEditing = editId === chat.id
                    const hideForNew = !chat.temporary && chat.title.trim().toLowerCase() === "new chat"
                    const isActive = curChatId === chat.id
                    const isHot = hotChatIds.has(chat.id)
                    const isUnavailable = isDarkMode && chat.id !== darkChatId

                    return (
                      <SidebarMenuItem
                        key={chat.id}
                        className={`mx-6 min-w-0 sideitem ${isHot ? "hotshell" : ""} ${isUnavailable ? "sidebar-chat-unavailable" : ""} ${chat.temporary ? "sidebar-chat-temp" : ""}`}
                      >
                        <div className="group relative grid min-w-0 grid-cols-[minmax(0,3fr)_auto]  items-center gap-3">
                          <FrameNefrex
                            {...navi_card_1}
                            className={`pointer-events-none absolute inset-0 z-0 transition-opacity ${
                              isUnavailable
                                ? "opacity-35 sidebar-unavailable-frame"
                                : isActive
                                ? "opacity-80"
                                : isHot
                                  ? "opacity-90 hotframe"
                                  : "opacity-45 group-hover:opacity-70"
                            }`}
                          />
                          <SidebarMenuButton
                            onClick={() => {
                              if (!isEditing && !isUnavailable) {
                                pickChat(chat.id)
                              }
                            }}
                            isActive={isActive && !isUnavailable}
                            disabled={isUnavailable}
                            aria-disabled={isUnavailable}
                            className={`itemshape relative z-10 min-w-0 w-full bg-transparent text-cyan-200/90 data-[active=true]:text-cyan-100 ${
                              isHot ? "hotbtn" : ""
                            } ${isUnavailable ? "sidebar-unavailable-btn" : ""}`}
                          >
                            {isHot && !isUnavailable && <span className="hotdot" aria-hidden />}
                            <MessageSquare className="h-4 w-4 mt-6 ml-4" />
                            {isEditing ? (
                              <Input
                                ref={editRef}
                                value={editTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={() => renameSave(chat.id, chat.title)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault()
                                    renameSave(chat.id, chat.title)
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault()
                                    renameCancel()
                                  }
                                }}
                                className="h-7 mt-10 border-cyan-400/70 text-xs text-cyan-100 shadow-[0_0_0_1px_rgba(0,255,255,0.35),0_0_10px_rgba(0,255,255,0.25)] focus-visible:ring-cyan-300"
                              />
                            ) : (
                              <NaviTxt
                                as="span"
                                className="block min-w-0 flex-1 truncate pr-1"
                                text={chat.title}
                                trigger={chat.id}
                              />
                            )}
                          </SidebarMenuButton>

                          {!hideForNew && !isEditing && !isDarkMode && (
                            <div className="relative sidebuttons flex items-center gap-1 sm:gap-2">
                              <NaviBtn
                                type="button"
                                frame="octagon"
                                className="octbtn sidebar-btn h-6 w-6 min-h-0 shrink-0 p-0 sm:h-8 sm:w-8"
                                onClick={(event) => renameStart(event, chat.id, chat.title)}
                                aria-label="Rename session"
                              >
                                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </NaviBtn>
                              <NaviBtn
                                type="button"
                                frame="octagon"
                                className="octbtn sidebar-btn sidebar-btn-delete h-6 w-6 min-h-0 shrink-0 p-0 sm:h-8 sm:w-8"
                                onClick={(event) => delChat(event, chat.id)}
                                aria-label="Delete session"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </NaviBtn>
                            </div>
                          )}
                        </div>                                                                              
                      </SidebarMenuItem>
                    )
                  })}
                  </SidebarMenu>                          
                </Animator>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="relative z-10  mt-auto px-4 pb-4 mt-12 text-center">
            <a
              href="https://github.com/ARCANGEL0/NekoCLI"
              target="_blank"
              rel="noreferrer"
              className="block navi_cli font-semibold uppercase tracking-[0.2em] text-cyan-200/80 transition-colors "
            >
              Terminal version available! Click here!
            </a>
            <a
              href="https://github.com/ARCANGEL0"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block arcangelo text-[2px] leading-none tracking-[0.14em] text-cyan-900/70 transition-colors hover:text-cyan-800/70"
              style={{ fontFamily: "\"Orbitron\", \"Rajdhani\", \"Exo 2\", var(--default-mono-font-family)" }}
            >
              <span className="text-[2px] text-cyan-900/65">Made by: </span>
              <span className="text-cyan-800/85">λrcangelo</span>
            </a>
          </div>
        </div>
      </SidebarContent>
      {typeof window !== "undefined" &&
        createPortal(
          notifToast ? (
            <div className="pointer-events-none fixed bottom-24 left-1/2 z-[10000] w-max max-w-[85vw] -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
              <div className="toastnotif navi_notif_cnt navi_toast_in relative px-3 py-1.5">
                <FrameUnderline
                  {...navi_under_1}
                  style={toastFrameStyle}
                  className="navi_tooltip navi_tooltip_main pointer-events-none absolute inset-0 z-[1]"
                />
                <FrameUnderline
                  {...navi_under_1}
                  style={toastFrameStyle}
                  className="navi_tooltip navi_tooltip_inner pointer-events-none absolute inset-[2px] z-[1]"
                />
                <div className="relative z-[2]">
                  <NaviTxt
                    as="span"
                    className="tiptxt"
                    text={notifToast}
                    trigger={`sidebar-toast-${notifToast}`}
                  />
                </div>
              </div>
            </div>
          ) : null,
          document.body
        )}
    </Sidebar>
  )
}
