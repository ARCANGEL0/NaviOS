"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Copy, Download, Paperclip, Pencil, RotateCcw, Send, Square, Trash2, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useChatSess, type ChatMode } from "@/components/layout-wrapper"
import { useChatStore } from "@/hooks/use-chat-store"
import { Message, type MessageRevision } from "@/lib/chat-store"
import { NaviBtn } from "@/components/navi_btn"
import { FrameCorners, FrameLines, FrameNefrex, FrameUnderline, useBleeps } from "@/components/ui/navi_fx"
import { NaviTxt } from "@/components/ui/navi_txt"
import { SlowDecipherText } from "@/components/ui/decipher"
import { AssistantMarkdown } from "@/components/ui/assistant-markdown"
import { getCachedImage, setCachedImage } from "@/lib/image-cache"
import {
  navi_under_1,
  navi_panel_1,
} from "@/components/ui/frames"
interface ChatInterfaceProps {
  chatId?: string
  chatMode?: ChatMode
}
// configs and vars

 const API_BASE_URL = "https://api.arcangelo.net"
const LOADING_LABEL = "L o a d i n g . . ."
const DrkmodeWaitTxt = "Please wait"
const DrkmodeLoadTxt = "Loading . . . ."
const API_ENDPOINTS = {
  neko: "/neko",
  dark: "/neko_dark",
  imagine: "/imagine",
  multiedit: "/multiEdit",
  vision: "/neko_vision"
} as const
const DEBUG_REQUEST_LOGS = process.env.NODE_ENV !== "production"
const PENDING_IMAGE_TASKS_KEY = "pending_image_tasks_v1"
const drkPollMs = 2200
const IMAGE_TASK_POLL_MS = {
        imagine: 6000,
   multiEdit: 7000,
} as const

const errByKind: Record<"api" | "img" | "vis", string[]> = {
  api: [
    "[❌] ERROR\n> Sorry bud, an error ocurred trying to fetch my API. Try again, will ya?",
    "[❌] ERROR\n> Error tryin' to fetch on my API. Give it one more shot, buddy.",
    "[❌] ERROR\n> Could not reach my API right now. Retry again, bro",
    "[❌] ERROR\n> Request crashed on the API side. Run it again.",
    "[❌] ERROR\n> My backend is unresponsive, m8. Try again.",
    "[❌] ERROR\n> Error from my side, it seems... Tap send again, yeah?",
    "[❌] ERROR\n> Failed to fetch from API this round. Retry please.",
    "[❌] ERROR\n> API timeout. Another try should do it.",
    "[❌] ERROR\n> No clean response from API. Try again, chief.",
  ], img: [
    "[❌] ERROR\n> Image request failed on the server. Try again, will ya?",
    "[❌] ERROR\n> Could not finish your image task. Give me another shot.",
    "[❌] ERROR\n> Didn't got any image. Try regenerating again.",
    "[❌] ERROR\n> No valid image result came back. Please retry.",
    "[❌] ERROR\n> Image worker failed. Try again, bro.",
    "[❌] ERROR\n> Render failed this time. Try sending again.",
    "[❌] ERROR\n> Could not fetch image output. Retry please.",
    "[❌] ERROR\n> Image API returned a bad response. Try again.",
    "[❌] ERROR\n> Generation stalled on server side. Please try again.",
    "[❌] ERROR\n> Didn't got anythin' from my backend. Try again, bro.",
  ],
  vis: [
    "[❌] ERROR\n> Vision call failed on server side. Try again.",
    "[❌] ERROR\n> Could not fetch vision output this time. Retry please.",
    "[❌] ERROR\n> Might be blind, but my backend failed to view the image. Give it another go.",
    "[❌] ERROR\n> Image analysis failed right now. Try again, bud.",
    "[❌] ERROR\n> Vision API hit a snag. Retry again.",
    "[❌] ERROR\n> No valid vision response received. Try again.",
    "[❌] ERROR\n> The vision task crashed upstream. Please retry.",
    "[❌] ERROR\n> Vision worker timed out. Another try should work.",
    "[❌] ERROR\n> Could not parse vision result. Try sendin' me again.",
    "[❌] ERROR\n> Vision fetch failed this round. Try again.",
  ],
}

type NaviMsg = {
  role: "user" | "assistant"
  content: string
}

type ImageTaskKind = keyof typeof IMAGE_TASK_POLL_MS

interface PendingImageTask {
  key: string
  kind: ImageTaskKind
  taskId: string
  chatId: string
  loadingMessageId: string
  loadingMode?: "new" | "replace"
  restoreRevisionIndex?: number
  createdAt: number
}

interface ActiveChatRequest {
  token: number
  abortController: AbortController | null
  loadingMessageId: string
  loadingMode: "new" | "replace"
  restoreRevisionIndex?: number
}

type ImageTaskInit =
  | { status: "done"; content: string }
  | { status: "error" }
  | { status: "pending"; kind: ImageTaskKind; taskId: string }

const IMG_URL_RX = /(https?:\/\/\S+?\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)/gi
const OK_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
])

const aidBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(2, 21, 40, 0.82)",
} as CSSProperties

const errBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(48, 7, 7, 0.86)",
  "--arwes-frames-line-color": "rgba(255, 124, 124, 0.96)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 11px rgba(255, 82, 82, 0.24))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 14px rgba(255, 98, 98, 0.45))",
} as CSSProperties

const aidActionStyle = {
  "--arwes-frames-bg-color": "hsl(180 75% 10% / 0.58)",
  "--arwes-frames-line-color": "hsl(188 80% 40% / 0.84)",
  "--arwes-frames-deco-color": "hsl(184 100% 64% / 0.95)",
} as CSSProperties

const toastFrameStyle = {
  "--arwes-frames-bg-color": "transparent",
  "--arwes-frames-line-color": "rgba(109, 248, 255, 0.95)",
  "--arwes-frames-deco-color": "rgba(190, 255, 255, 0.98)",
  "--arwes-frames-bg-filter": "none",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(0, 239, 255, 0.36))",
} as CSSProperties

const usrBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(8, 75, 95, 0.42)",
  "--arwes-frames-line-color": "rgba(133, 251, 255, 0.88)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 8px rgba(28, 236, 255, 0.15))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(100, 246, 255, 0.26))",
} as CSSProperties

const aidBubbleStyleDark = {
  "--arwes-frames-bg-color": "rgba(38, 6, 12, 0.82)",
  "--arwes-frames-line-color": "rgba(255, 92, 124, 0.92)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 10px rgba(255, 70, 104, 0.22))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 12px rgba(255, 80, 112, 0.38))",
} as CSSProperties

const usrBubbleStyleDark = {
  "--arwes-frames-bg-color": "rgba(46, 8, 16, 0.58)",
  "--arwes-frames-line-color": "rgba(255, 118, 146, 0.92)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 10px rgba(255, 84, 116, 0.2))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 12px rgba(255, 102, 132, 0.36))",
} as CSSProperties

const errBubbleStyleDark = {
  "--arwes-frames-bg-color": "rgba(64, 26, 4, 0.9)",
  "--arwes-frames-line-color": "rgba(255, 196, 82, 0.98)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 12px rgba(255, 170, 64, 0.26))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 16px rgba(255, 196, 82, 0.5))",
} as CSSProperties

const actionCounterStyle = {
  "--arwes-frames-bg-color": "rgba(5, 29, 40, 0.5)",
  "--arwes-frames-line-color": "rgba(109, 248, 255, 0.78)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 8px rgba(0, 230, 255, 0.14))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(104, 243, 255, 0.26))",
} as CSSProperties

const aidActionStyleDark = {
  "--arwes-frames-bg-color": "rgba(66, 28, 6, 0.72)",
  "--arwes-frames-line-color": "rgba(255, 200, 96, 0.98)",
  "--arwes-frames-deco-color": "rgba(255, 220, 140, 0.92)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 10px rgba(255, 170, 70, 0.22))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 12px rgba(255, 196, 90, 0.4))",
} as CSSProperties

const actionCounterStyleDark = {
  "--arwes-frames-bg-color": "rgba(58, 24, 6, 0.62)",
  "--arwes-frames-line-color": "rgba(255, 186, 88, 0.92)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 8px rgba(255, 168, 72, 0.18))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(255, 190, 94, 0.34))",
} as CSSProperties

const getImgUrls = (content: string): string[] => {
  const matches = content.match(IMG_URL_RX) ?? []
  return [...new Set(matches.map((url) => url.trim()))]
}

const cleanImgUrls = (content: string): string => {
  return content
    .replace(IMG_URL_RX, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const okImgFile = (file: File): boolean => {
  if (OK_IMAGE_MIME_TYPES.has(file.type)) {
    return true
  }

  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

const clampRevisionIndex = (message: Message, revisions: MessageRevision[]): number => {
  if (revisions.length === 0) return 0
  const activeRevision = typeof message.activeRevision === "number" ? message.activeRevision : revisions.length - 1
  return Math.min(Math.max(activeRevision, 0), revisions.length - 1)
}

const getMessageRevisions = (message: Message): MessageRevision[] => {
  if (Array.isArray(message.revisions) && message.revisions.length > 0) {
    return message.revisions
  }

  return [{
    id: `${message.id}-rev-0`,
    content: message.content,
    timestamp: message.timestamp,
    responseState: message.responseState,
  }]
}

const getDayKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function LoadingStatusText({
  messageId,
  primaryText,
  alternateText,
}: {
  messageId: string
  primaryText: string
  alternateText?: string
}) {
  const [phase, setPhase] = useState(0)
  const activeText =
    alternateText && phase % 2 === 1
      ? alternateText
      : primaryText

  useEffect(() => {
    if (!alternateText) return

    const intervalId = window.setInterval(() => {
      setPhase((prev) => prev + 1)
    }, 1800)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [alternateText, messageId])

  return (
    <SlowDecipherText
      text={activeText}
      trigger={`${messageId}-${phase}`}
      durationMs={950}
      stepMs={42}
    />
  )
}

export function ChatInterface({ chatId, chatMode = "chat" }: ChatInterfaceProps) {
  const { chats, addMessage, getChat, updateChat, updateMessage } = useChatStore()
  const { setChatMode } = useChatSess()
  const bleeps = useBleeps<"notify" | "assemble" | "content">()
  const [hasInput, setHasInput] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [isEditPromptGlow, setIsEditPromptGlow] = useState(false)
  const [inFlightChatIds, setInFlightChatIds] = useState<Set<string>>(() => new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isToastExiting, setIsToastExiting] = useState(false)
  const [historyToastMessage, setHistoryToastMessage] = useState<string | null>(null)
  const [isHistoryToastExiting, setIsHistoryToastExiting] = useState(false)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const maxFiles = chatMode === "image" ? 4 : chatMode === "dark" ? 0 : 1

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const inputValueRef = useRef("")
  const viewRef = useRef<HTMLDivElement>(null)
  const reqMetaByChatRef = useRef<Map<string, ActiveChatRequest>>(new Map())
  const reqTokenByChatRef = useRef<Map<string, number>>(new Map())
  const toastTimerRef = useRef<number | null>(null)
  const toastOutRef = useRef<number | null>(null)
  const historyToastTimerRef = useRef<number | null>(null)
  const historyToastOutRef = useRef<number | null>(null)
  const prevAidIdRef = useRef<string | undefined>(undefined)
  const pendingImageTasksRef = useRef<Map<string, PendingImageTask>>(new Map())
  const pendingTaskPollTimersRef = useRef<Map<string, number>>(new Map())
  const pendingTaskInFlightRef = useRef<Set<string>>(new Set())
  const messageNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const visibleDayKeyRef = useRef<string | null>(null)
  const hasInteractedWithScrollRef = useRef(false)
  const errLastRef = useRef<Record<"api" | "img" | "vis", number>>({
    api: -1,
    img: -1,
    vis: -1,
  })
  const imgCacheMap = useRef<Map<string, string>>(new Map())
  const actionFrameStyle = chatMode === "dark" ? aidActionStyleDark : aidActionStyle
  const counterFrameStyle = chatMode === "dark" ? actionCounterStyleDark : actionCounterStyle

  const currentChat = useMemo(
    () => (chatId ? chats.find((chat) => chat.id === chatId) : undefined),
    [chatId, chats]
  )
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    []
  )
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    []
  )
  const messages = useMemo(() => currentChat?.messages ?? [], [currentChat])
  const lastAidMsg = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  )
  const lastAidId = lastAidMsg?.id
  const { galleryImages, imgKeyMap } = useMemo(() => {
    const nextGalleryImages: string[] = []
    const nextImgKeyMap = new Map<string, number>()
    messages.forEach((message) => {
      const inlineImgs = getImgUrls(message.content)
      inlineImgs.forEach((imageUrl, index) => {
        const key = `${message.id}-inline-image-${index}`
        nextImgKeyMap.set(key, nextGalleryImages.length)
        nextGalleryImages.push(imageUrl)
      })
    })
    return { galleryImages: nextGalleryImages, imgKeyMap: nextImgKeyMap }
  }, [messages])
  const curImg = galleryImages[activeGalleryIndex] ?? null
  const isRequestInFlight = Boolean(chatId && inFlightChatIds.has(chatId))

  const setChatInFlight = useCallback((targetChatId: string, inFlight: boolean) => {
    setInFlightChatIds((prev) => {
      const alreadyInFlight = prev.has(targetChatId)
      if (alreadyInFlight === inFlight) {
        return prev
      }

      const next = new Set(prev)
      if (inFlight) {
        next.add(targetChatId)
      } else {
        next.delete(targetChatId)
      }
      return next
    })
  }, [])

  const nextReqToken = useCallback((targetChatId: string): number => {
    const nextToken = (reqTokenByChatRef.current.get(targetChatId) ?? 0) + 1
    reqTokenByChatRef.current.set(targetChatId, nextToken)
    return nextToken
  }, [])

  const isReqTokenCurrent = useCallback((targetChatId: string, reqToken: number): boolean => {
    return (reqTokenByChatRef.current.get(targetChatId) ?? 0) === reqToken
  }, [])

  const finishChatRequest = useCallback((targetChatId: string, loadingMessageId?: string) => {
    const currentReqMeta = reqMetaByChatRef.current.get(targetChatId)
    if (!currentReqMeta) return
    if (loadingMessageId && currentReqMeta.loadingMessageId !== loadingMessageId) {
      return
    }
    reqMetaByChatRef.current.delete(targetChatId)
    setChatInFlight(targetChatId, false)
  }, [setChatInFlight])

  const restoreMsgRevision = useCallback((
    targetChatId: string,
    messageId: string,
    revisionIndex?: number
  ) => {
    const chat = getChat(targetChatId)
    const message = chat?.messages.find((entry) => entry.id === messageId)
    if (!message) return

    const revisions = getMessageRevisions(message).filter((revision) => revision.responseState !== "loading")
    if (revisions.length === 0) return

    const nextActiveIndex = typeof revisionIndex === "number"
      ? Math.min(Math.max(revisionIndex, 0), revisions.length - 1)
      : clampRevisionIndex(message, revisions)
    const activeRevision = revisions[nextActiveIndex]

    updateMessage(targetChatId, messageId, {
      content: activeRevision.content,
      timestamp: activeRevision.timestamp,
      responseState: activeRevision.responseState,
      revisions,
      activeRevision: nextActiveIndex,
    })
  }, [getChat, updateMessage])

  const beginMsgReplacement = useCallback((
    targetChatId: string,
    messageId: string
  ): number | null => {
    const chat = getChat(targetChatId)
    const message = chat?.messages.find((entry) => entry.id === messageId)
    if (!message || message.role !== "assistant") return null

    const revisions = getMessageRevisions(message)
    const restoreRevisionIndex = clampRevisionIndex(message, revisions)
    const loadingRevision: MessageRevision = {
      id: `${message.id}-rev-loading-${Date.now()}`,
      content: LOADING_LABEL,
      timestamp: new Date(),
      responseState: "loading",
    }

    updateMessage(targetChatId, messageId, {
      content: loadingRevision.content,
      timestamp: loadingRevision.timestamp,
      responseState: "loading",
      revisions: [...revisions, loadingRevision],
      activeRevision: revisions.length,
    })

    return restoreRevisionIndex
  }, [getChat, updateMessage])

  const addAidMsg = useCallback((
    targetChatId: string,
    content: string,
    responseState: Message["responseState"] = "ok"
  ) => {
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      content,
      role: "assistant",
      timestamp: new Date(),
      responseState,
    }
    addMessage(targetChatId, assistantMessage)
  }, [addMessage])

  const commitMsgReplacement = useCallback((
    targetChatId: string,
    messageId: string,
    content: string,
    responseState: "ok" | "error" = "ok"
  ) => {
    const chat = getChat(targetChatId)
    const message = chat?.messages.find((entry) => entry.id === messageId)
    if (!message) {
      addAidMsg(targetChatId, content, responseState)
      if (responseState === "error") {
        bleeps.content?.play("assistant-content")
      }
      return
    }

    const revisions = getMessageRevisions(message)
    const nextRevision: MessageRevision = {
      id: `${message.id}-rev-${Date.now()}`,
      content,
      timestamp: new Date(),
      responseState,
    }
    const replaceIndex = revisions.length > 0 && revisions[revisions.length - 1]?.responseState === "loading"
      ? revisions.length - 1
      : -1
    const nextRevisions = replaceIndex >= 0
      ? revisions.map((revision, index) => index === replaceIndex ? nextRevision : revision)
      : [...revisions, nextRevision]
    const nextActiveIndex = replaceIndex >= 0 ? replaceIndex : nextRevisions.length - 1

    updateMessage(targetChatId, messageId, {
      content: nextRevision.content,
      timestamp: nextRevision.timestamp,
      responseState: nextRevision.responseState,
      revisions: nextRevisions,
      activeRevision: nextActiveIndex,
    })

    if (responseState === "error") {
      bleeps.content?.play("assistant-content")
    }
  }, [addAidMsg, bleeps.content, getChat, updateMessage])

  const addLoadAidMsg = useCallback((
    targetChatId: string,
    reqTok: number,
    replaceMessageId?: string
  ): { loadingMessageId: string; loadingMode: "new" | "replace"; restoreRevisionIndex?: number } => {
    if (replaceMessageId) {
      const restoreRevisionIndex = beginMsgReplacement(targetChatId, replaceMessageId)
      if (restoreRevisionIndex !== null) {
        return {
          loadingMessageId: replaceMessageId,
          loadingMode: "replace",
          restoreRevisionIndex,
        }
      }
    }

    const loadMsgId = `assistant-loading-${reqTok}-${Date.now()}`
    const loadingMessage: Message = {
      id: loadMsgId,
      content: LOADING_LABEL,
      role: "assistant",
      timestamp: new Date(),
      responseState: "loading",
    }
    addMessage(targetChatId, loadingMessage)
    return {
      loadingMessageId: loadMsgId,
      loadingMode: "new",
    }
  }, [addMessage, beginMsgReplacement])

  const repLoadAidMsg = useCallback((
    targetChatId: string,
    loadMsgId: string,
    content: string,
    responseState: "ok" | "error" = "ok"
  ) => {
    const reqMeta = reqMetaByChatRef.current.get(targetChatId)
    if (reqMeta?.loadingMessageId === loadMsgId && reqMeta.loadingMode === "replace") {
      commitMsgReplacement(targetChatId, loadMsgId, content, responseState)
      return
    }

    const chat = getChat(targetChatId)
    if (!chat) return

    const loadingIndex = chat.messages.findIndex((message) => message.id === loadMsgId)
    if (loadingIndex < 0) {
      addAidMsg(targetChatId, content, responseState)
      if (responseState === "error") {
        bleeps.content?.play("assistant-content")
      }
      return
    }

    const nextMessages = [...chat.messages]
    nextMessages[loadingIndex] = {
      id: `assistant-${Date.now()}`,
      content,
      role: "assistant",
      timestamp: new Date(),
      responseState,
    }
    updateChat(targetChatId, { messages: nextMessages })
    if (responseState === "error") {
      bleeps.content?.play("assistant-content")
    }
  }, [addAidMsg, bleeps.content, commitMsgReplacement, getChat, updateChat])

  const setLoadAidMsgText = useCallback((
    targetChatId: string,
    loadMsgId: string,
    content: string
  ) => {
    updateMessage(targetChatId, loadMsgId, {
      content,
      timestamp: new Date(),
      responseState: "loading",
    })
  }, [updateMessage])

  const rmLoadAidMsg = useCallback((targetChatId: string, loadMsgId: string) => {
    const reqMeta = reqMetaByChatRef.current.get(targetChatId)
    if (reqMeta?.loadingMessageId === loadMsgId && reqMeta.loadingMode === "replace") {
      restoreMsgRevision(targetChatId, loadMsgId, reqMeta.restoreRevisionIndex)
      return
    }

    const chat = getChat(targetChatId)
    if (!chat) return

    const nextMessages = chat.messages.filter((message) => message.id !== loadMsgId)
    if (nextMessages.length === chat.messages.length) return

    updateChat(targetChatId, { messages: nextMessages })
  }, [getChat, restoreMsgRevision, updateChat])

  const reqCtx = (
    targetChatId: string
  ): { chatName: string } => {
    const targetChat = getChat(targetChatId)
    return {
      chatName: targetChat?.title || "New Chat",
    }
  }

  const naviMsgs = (
    targetChatId: string,
    fallbackPrompt: string,
    excludedMessageIds?: Set<string>
  ): NaviMsg[] => {
    const targetChat = getChat(targetChatId)
    const messagesPayload = (targetChat?.messages ?? [])
      .filter((message) => {
        if (excludedMessageIds?.has(message.id)) return false
        if (message.responseState === "loading") return false
        return (message.role === "user" || message.role === "assistant") && message.content.trim().length > 0
      })
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))

    if (messagesPayload.length > 0) {
      return messagesPayload
    }

    return [{ role: "user", content: fallbackPrompt }]
  }

  const chatSnap = (targetChatId?: string) => {
    const indexedChats = chats.map((chat, index) => ({
      index,
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
    }))
    const currentChatIndex = targetChatId ? indexedChats.findIndex((chat) => chat.id === targetChatId) : -1
    if (currentChatIndex < 0) {
      return {
        currentChatIndex,
        chatsWithCurrentFirst: indexedChats,
      }
    }

    return {
      currentChatIndex,
      chatsWithCurrentFirst: [
        indexedChats[currentChatIndex],
        ...indexedChats.filter((chat) => chat.id !== targetChatId),
      ],
    }
  }

  const logPayload = (body: Record<string, unknown>): Record<string, unknown> => {
    const payloadForLog: Record<string, unknown> = {}

    Object.entries(body).forEach(([key, value]) => {
      if (key === "messages" && Array.isArray(value)) {
        payloadForLog.messages = value.map((message, index) => {
          const typedMessage = message as { role?: unknown; content?: unknown }
          return {
            index,
            role: typeof typedMessage.role === "string" ? typedMessage.role : "unknown",
            content:
              typeof typedMessage.content === "string"
                ? typedMessage.content
                : "",
          }
        })
        return
      }

      if (Array.isArray(value)) {
        payloadForLog[key] = `[array:${value.length}]`
        return
      }

      if (typeof value === "string" && value.length > 280) {
        payloadForLog[key] = `${value.slice(0, 280)}...[trimmed:${value.length - 280}]`
        return
      }

      payloadForLog[key] = value
    })

    return payloadForLog
  }


  const mkUrl = useCallback((endpoint: string) => `${API_BASE_URL}${endpoint}`, [])

  const reqJson = async (
    endpoint: string,
    message: string,
    chatName: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
    targetChatId?: string
  ) => {    return fetch(mkUrl(endpoint), {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  const stopReq = (targetChatId?: string) => {
    const chatToStop = targetChatId ?? chatId
    if (!chatToStop) return

    const reqMeta = reqMetaByChatRef.current.get(chatToStop)
    if (reqMeta) {
      rmLoadAidMsg(chatToStop, reqMeta.loadingMessageId)
    }

    pendingImageTasksRef.current.forEach((task, taskKey) => {
      if (task.chatId !== chatToStop) {
        return
      }

      if (reqMeta && task.loadingMessageId !== reqMeta.loadingMessageId) {
        return
      }

      const timerId = pendingTaskPollTimersRef.current.get(taskKey)
      if (timerId) {
        window.clearInterval(timerId)
        pendingTaskPollTimersRef.current.delete(taskKey)
      }
      pendingTaskInFlightRef.current.delete(taskKey)
      pendingImageTasksRef.current.delete(taskKey)
    })
    savePendingImageTasks()

    nextReqToken(chatToStop)
    reqMeta?.abortController?.abort()
    reqMetaByChatRef.current.delete(chatToStop)
    setChatInFlight(chatToStop, false)
    updateChat(chatToStop, {
      darkJobId: undefined,
      darkTaskId: undefined,
    })
  }

  const rtjson = useCallback((rawText: string): Record<string, unknown> | null => {
    const trimmed = rawText.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>
      } catch {
        return null
      }
    }
  }, [])

  const pickErr = useCallback((kind: "api" | "img" | "vis" = "api"): string => {
    const arr = errByKind[kind]
    if (arr.length === 0) return "[❌] ERROR\n> Something failed. Try again."
    let i = Math.floor(Math.random() * arr.length)
    if (arr.length > 1 && i === errLastRef.current[kind]) {
      i = (i + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length
    }
    errLastRef.current[kind] = i
    return arr[i]
  }, [])

  const normImg = useCallback((responseText: unknown): string | null => {
    if (typeof responseText !== "string") {
      return null
    }

    const imageUrls = getImgUrls(responseText)
    if (imageUrls.length === 0) {
      return null
    }

    return imageUrls[0]
  }, [])

  const toB64 = (file: File, signal: AbortSignal): Promise<string> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"))
        return
      }

      const reader = new FileReader()

      const cleanup = () => {
        signal.removeEventListener("abort", onAbort)
      }

      const onAbort = () => {
        try {
          reader.abort()
        } catch {
        }
        cleanup()
        reject(new DOMException("Aborted", "AbortError"))
      }

      reader.onerror = () => {
        cleanup()
        reject(new Error("Failed to encode image as base64."))
      }

      reader.onabort = () => {
        cleanup()
        reject(new DOMException("Aborted", "AbortError"))
      }

      reader.onload = () => {
        cleanup()
        const result = typeof reader.result === "string" ? reader.result : ""
        const commaIndex = result.indexOf(",")
        const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1).trim() : ""
        if (!base64) {
          reject(new Error("Image is invalid or missing base64 data."))
          return
        }
        resolve(base64)
      }

      signal.addEventListener("abort", onAbort, { once: true })
      reader.readAsDataURL(file)
    })

  const waitForTaskPoll = (signal: AbortSignal, ms: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"))
        return
      }

      const timerId = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort)
        resolve()
      }, ms)

      const onAbort = () => {
        window.clearTimeout(timerId)
        signal.removeEventListener("abort", onAbort)
        reject(new DOMException("Aborted", "AbortError"))
      }

      signal.addEventListener("abort", onAbort, { once: true })
    })

  const reqImagineInit = async (
    prompt: string,
    chatName: string,
    targetChatId: string,
    signal: AbortSignal
  ): Promise<ImageTaskInit> => {
    const initResponse = await reqJson(
      API_ENDPOINTS.imagine,
      prompt,
      chatName,
      { prompt },
      signal,
      targetChatId
    )

    if (!initResponse.ok) {
      return { status: "error" }
    }

    const initRawText = await initResponse.text()
    const initData = rtjson(initRawText)
    const immediateResponse =
      typeof initData?.response === "string" && initData.response.trim().length > 0
        ? initData.response
        : initRawText

    if (!initData && immediateResponse.trim().length > 0) {
      const imageUrl = normImg(immediateResponse)
      if (!imageUrl) {
        return { status: "error" }
      }
      return { status: "done", content: imageUrl }
    }

    if (typeof initData?.response === "string" && initData.response.trim().length > 0) {
      const imageUrl = normImg(initData.response)
      if (!imageUrl) {
        return { status: "error" }
      }
      return { status: "done", content: imageUrl }
    }

    const taskId = typeof initData?.taskId === "string" ? initData.taskId : ""
    if (!taskId) {
      return { status: "error" }
    }

    return { status: "pending", kind: "imagine", taskId }
  }

  const reqMultiInit = async (
    prompt: string,
    imgB64List: string[],
    chatName: string,
    targetChatId: string,
    signal: AbortSignal
  ): Promise<ImageTaskInit> => {
    const response = await reqJson(
      API_ENDPOINTS.multiedit,
      prompt,
      chatName,
      { prompt, image: imgB64List },
      signal,
      targetChatId
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const initData = (await response.json()) as { taskId?: unknown; response?: unknown }
    if (typeof initData.response === "string" && initData.response.trim().length > 0) {
      return { status: "done", content: initData.response }
    }

    const taskId = typeof initData.taskId === "string" ? initData.taskId : ""
    if (!taskId) {
      throw new Error("multiEdit request did not return a task id.")
    }

    return { status: "pending", kind: "multiEdit", taskId }
  }

  const savePendingImageTasks = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const tasks = Array.from(pendingImageTasksRef.current.values())
      localStorage.setItem(PENDING_IMAGE_TASKS_KEY, JSON.stringify(tasks))
    } catch {
    }
  }, [])

  const rmPendingImageTask = useCallback((taskKey: string) => {
    const timerId = pendingTaskPollTimersRef.current.get(taskKey)
    if (timerId) {
      window.clearInterval(timerId)
      pendingTaskPollTimersRef.current.delete(taskKey)
    }
    pendingTaskInFlightRef.current.delete(taskKey)
    pendingImageTasksRef.current.delete(taskKey)
    savePendingImageTasks()
  }, [savePendingImageTasks])

  const pollPendingImageTask = useCallback(async (taskKey: string) => {
    const task = pendingImageTasksRef.current.get(taskKey)
    if (!task) return
    if (pendingTaskInFlightRef.current.has(taskKey)) return

    const chat = getChat(task.chatId)
    if (!chat) {
      rmPendingImageTask(taskKey)
      return
    }

    const hasLoadingMessage = chat.messages.some(
      (message) => message.id === task.loadingMessageId
    )
    if (!hasLoadingMessage) {
      rmPendingImageTask(taskKey)
      return
    }

    pendingTaskInFlightRef.current.add(taskKey)

    try {
      const response = await fetch(
        mkUrl(task.kind === "imagine" ? API_ENDPOINTS.imagine : API_ENDPOINTS.multiedit),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId: task.taskId }),
        }
      )

      const rawText = await response.text()
      const data = rtjson(rawText)
      if (!data) {
        return
      }

      const status = typeof data.status === "string" ? data.status.toLowerCase() : ""
      const responseText = typeof data.response === "string" ? data.response : ""
      const taskStillActive = pendingImageTasksRef.current.has(taskKey)
      if (!taskStillActive) {
        return
      }

      if (status === "completed" || (!status && responseText.trim().length > 0)) {
        let completedContent = "Image task completed."
        if (task.kind === "imagine") {
          const imageUrl = normImg(responseText || rawText)
          if (!imageUrl) {
            repLoadAidMsg(task.chatId, task.loadingMessageId, pickErr("img"), "error")
            finishChatRequest(task.chatId, task.loadingMessageId)
            rmPendingImageTask(taskKey)
            return
          }
          completedContent = imageUrl
        } else if (responseText.trim().length > 0) {
          completedContent = responseText
        }

        repLoadAidMsg(
          task.chatId,
          task.loadingMessageId,
          completedContent,
          "ok"
        )
        finishChatRequest(task.chatId, task.loadingMessageId)
        rmPendingImageTask(taskKey)
        return
      }

      if (status === "error") {
        repLoadAidMsg(task.chatId, task.loadingMessageId, pickErr("img"), "error")
        finishChatRequest(task.chatId, task.loadingMessageId)
        rmPendingImageTask(taskKey)
      }
    } catch {
    } finally {
      pendingTaskInFlightRef.current.delete(taskKey)
    }
  }, [finishChatRequest, getChat, mkUrl, normImg, pickErr, repLoadAidMsg, rmPendingImageTask, rtjson])

  const startPendingImageTask = useCallback((taskKey: string) => {
    const task = pendingImageTasksRef.current.get(taskKey)
    if (!task) return
    if (pendingTaskPollTimersRef.current.has(taskKey)) return

    const intervalMs = IMAGE_TASK_POLL_MS[task.kind]
    void pollPendingImageTask(taskKey)
    const timerId = window.setInterval(() => {
      void pollPendingImageTask(taskKey)
    }, intervalMs)
    pendingTaskPollTimersRef.current.set(taskKey, timerId)
  }, [pollPendingImageTask])

  const addPendingImageTask = useCallback((task: PendingImageTask) => {
    pendingImageTasksRef.current.set(task.key, task)
    savePendingImageTasks()
    startPendingImageTask(task.key)
  }, [savePendingImageTasks, startPendingImageTask])

  const darkai = async (
    targetChatId: string,
    prompt: string,
    chatName: string,
    signal: AbortSignal,
    loadMsgId: string,
    excludedMessageIds?: Set<string>
  ): Promise<string> => {
    const conversation = naviMsgs(targetChatId, prompt, excludedMessageIds)
    let taskId: string | undefined
    let isPolling = false

    while (true) {
      const requestBody: Record<string, unknown> = isPolling
        ? { taskId }
        : { conversation }

      const getRes = await reqJson(
        API_ENDPOINTS.dark,
        prompt,
        chatName,
        requestBody,
        signal,
        targetChatId
      )

      const rawText = await getRes.text()

      if (!getRes.ok) {
        throw new Error(`HTTP ${getRes.status}: ${rawText.slice(0, 220)}`)
      }

      const darkparse = rtjson(rawText)
      if (!darkparse) {
        const trimmed = rawText.trim()
        if (trimmed.length > 0) {
          return trimmed
        }
        throw new Error("No valid response content from DARK API.")
      }

      const darkstat = darkparse.status
      const darkstatTxt =
        typeof darkstat === "string" ? darkstat.toLowerCase() : ""
      const darktxt =
        typeof darkparse.response === "string" ? darkparse.response.trim() : ""
      const darkerr =
        typeof darkparse.error === "string"
          ? darkparse.error.trim()
          : typeof darkparse.message === "string"
            ? darkparse.message.trim()
            : ""
      const isDone =
        darkstat === true ||
        darkstatTxt === "completed" ||
        darkstatTxt === "done" ||
        darkstatTxt === "success"
      const isWaitin =
        darkstatTxt === "pending" ||
        darkstatTxt === "processing" ||
        darkstatTxt === "queued" ||
        darkstatTxt === "running" ||
        (darkstat === false && !darkerr)
      const isDarkErr =
        darkstatTxt === "error" ||
        darkstatTxt === "failed"
      const gotTaskId =
        typeof darkparse.taskId === "string" && darkparse.taskId.trim().length > 0
          ? darkparse.taskId
          : typeof darkparse.task_id === "string" && darkparse.task_id.trim().length > 0
            ? darkparse.task_id
          : undefined

      if (gotTaskId) {
        taskId = gotTaskId ?? taskId
        updateChat(targetChatId, {
          darkJobId: undefined,
          darkTaskId: taskId,
        })
        setLoadAidMsgText(targetChatId, loadMsgId, DrkmodeWaitTxt)
      }

      if (isDone && darktxt.length > 0) {
        updateChat(targetChatId, {
          darkJobId: undefined,
          darkTaskId: undefined,
        })
        return darktxt
      }

      if (isDarkErr || (darkerr.length > 0 && !isWaitin)) {
        updateChat(targetChatId, {
          darkJobId: undefined,
          darkTaskId: undefined,
        })
        throw new Error(darkerr || "DARK API returned an error.")
      }

      if (!isPolling && gotTaskId) {
        isPolling = true
        await waitForTaskPoll(signal, drkPollMs)
        continue
      }

      if (!taskId) {
        if (darktxt.length > 0) {
          updateChat(targetChatId, {
            darkJobId: undefined,
            darkTaskId: undefined,
          })
          return darktxt
        }
        throw new Error("DARK API did not return a task id.")
      }

      isPolling = true
      await waitForTaskPoll(signal, drkPollMs)
    }
  }

  const naviAI = async (
    targetChatId: string,
    prompt: string,
    chatName: string,
    signal: AbortSignal,
    excludedMessageIds?: Set<string>
  ): Promise<string> => {
    const messages = naviMsgs(targetChatId, prompt, excludedMessageIds)

    const response = await reqJson(
      API_ENDPOINTS.neko,
      prompt,
      chatName,
      { messages },
      signal,
      targetChatId
    )

    const rawText = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 220)}`)
    }

    const parsed = rtjson(rawText)
    if (parsed) {
      const candidate =
        parsed.response ??
        parsed.output ??
        parsed.message ??
        (parsed.result as { output?: unknown } | undefined)?.output

      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate
      }
    }

    const trimmed = rawText.trim()
    if (trimmed.length > 0) {
      return trimmed
    }

    throw new Error("No valid response content from API.")
  }

  const req_vision = async (
    targetChatId: string,
    prompt: string,
    imgB64: string,
    chatName: string,
    signal: AbortSignal
  ): Promise<string> => {
    const response = await reqJson(
      API_ENDPOINTS.vision,
      prompt,
      chatName,
      { prompt, image: imgB64 },
      signal,
      targetChatId
    )

    const rawText = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 220)}`)
    }

    const parsed = rtjson(rawText)
    if (parsed) {
      const vis_output =
        (parsed as { image?: { output?: unknown } })?.image?.output ??
        (parsed as { output?: unknown }).output ??
        (parsed as { response?: unknown }).response ??
        (parsed as { result?: { output?: unknown } }).result?.output

      if (typeof vis_output === "string" && vis_output.trim().length > 0) {
        return vis_output
      }
    }

    const trimmed = rawText.trim()
    if (trimmed.length > 0) {
      return trimmed
    }

    throw new Error("No valid response content from vision API.")
  }

  const askAi = async (
    targetChatId: string,
    prompt: string,
    filesIn: File[] = [],
    options?: {
      replaceMessageId?: string
      excludedMessageIds?: Set<string>
    }
  ) => {
    const reqTok = nextReqToken(targetChatId)
    const safeFiles = chatMode === "dark" ? [] : filesIn
    const hasVisInput = chatMode === "chat" && safeFiles.length > 0
    const reqErrKind: "api" | "img" | "vis" = chatMode === "image"
      ? "img"
      : hasVisInput
        ? "vis"
        : "api"
    let keepLoadingActive = false
    const { chatName } = reqCtx(targetChatId)

    const ctrl = new AbortController()
    setChatInFlight(targetChatId, true)
    const { loadingMessageId: loadMsgId, loadingMode, restoreRevisionIndex } = addLoadAidMsg(
      targetChatId,
      reqTok,
      options?.replaceMessageId
    )
    reqMetaByChatRef.current.set(targetChatId, {
      token: reqTok,
      abortController: ctrl,
      loadingMessageId: loadMsgId,
      loadingMode,
      restoreRevisionIndex,
    })

    try {
      if (chatMode === "dark") {
        const responseText = await darkai(
          targetChatId,
          prompt,
          chatName,
          ctrl.signal,
          loadMsgId,
          options?.excludedMessageIds
        )

        if (!isReqTokenCurrent(targetChatId, reqTok)) return
        repLoadAidMsg(
          targetChatId,
          loadMsgId,
          responseText,
          "ok"
        )
        return
      }

      if (chatMode === "image") {
        const imgs = safeFiles.slice(0, 4)
        let initResult: ImageTaskInit = { status: "error" }
        if (imgs.length === 0) {
          try {
            initResult = await reqImagineInit(
              prompt,
              chatName,
              targetChatId,
              ctrl.signal
            )
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              throw error
            }
            initResult = { status: "error" }
          }
        } else {
          initResult = await (async () => {
            const imgB64List: string[] = []
            for (const file of imgs) {
              const imgB64 = await toB64(file, ctrl.signal)
              imgB64List.push(imgB64)
            }
            return reqMultiInit(
              prompt,
              imgB64List,
              chatName,
              targetChatId,
              ctrl.signal
            )
          })()
        }

        if (!isReqTokenCurrent(targetChatId, reqTok)) return
        if (initResult.status === "error") {
          repLoadAidMsg(targetChatId, loadMsgId, pickErr("img"), "error")
          return
        }

        if (initResult.status === "done") {
          repLoadAidMsg(
            targetChatId,
            loadMsgId,
            initResult.content,
            "ok"
          )
          return
        }

        const pendingTask: PendingImageTask = {
          key: `${initResult.kind}:${initResult.taskId}:${targetChatId}:${loadMsgId}`,
          kind: initResult.kind,
          taskId: initResult.taskId,
          chatId: targetChatId,
          loadingMessageId: loadMsgId,
          loadingMode,
          restoreRevisionIndex,
          createdAt: Date.now(),
        }
        addPendingImageTask(pendingTask)
        keepLoadingActive = true
        return
      }

      const imgFile = safeFiles[0]
      const isVis = Boolean(imgFile)

      if (!isVis) {
        const responseText = await naviAI(
          targetChatId,
          prompt,
          chatName,
          ctrl.signal,
          options?.excludedMessageIds
        )

        if (!isReqTokenCurrent(targetChatId, reqTok)) return
        repLoadAidMsg(
          targetChatId,
          loadMsgId,
          responseText,
          "ok"
        )
        return
      }

      const imgB64 = await toB64(imgFile, ctrl.signal)
      const responseText = await req_vision(
        targetChatId,
        prompt,
        imgB64,
        chatName,
        ctrl.signal
      )

      if (!isReqTokenCurrent(targetChatId, reqTok)) return
      repLoadAidMsg(
        targetChatId,
        loadMsgId,
        responseText,
        "ok"
      )
    } catch (error) {
      if (!isReqTokenCurrent(targetChatId, reqTok)) return
      if (error instanceof DOMException && error.name === "AbortError") {
        if (chatMode === "dark") {
          updateChat(targetChatId, {
            darkJobId: undefined,
            darkTaskId: undefined,
          })
        }
        rmLoadAidMsg(targetChatId, loadMsgId)
        return
      }

      if (chatMode === "dark") {
        updateChat(targetChatId, {
          darkJobId: undefined,
          darkTaskId: undefined,
        })
      }

      repLoadAidMsg(
        targetChatId,
        loadMsgId,
        pickErr(reqErrKind),
        "error"
      )
    } finally {
      if (!isReqTokenCurrent(targetChatId, reqTok)) {
        return
      }

      if (!keepLoadingActive) {
        finishChatRequest(targetChatId, loadMsgId)
      } else {
        const currentReqMeta = reqMetaByChatRef.current.get(targetChatId)
        if (currentReqMeta && currentReqMeta.token === reqTok) {
          reqMetaByChatRef.current.set(targetChatId, {
            ...currentReqMeta,
            abortController: null,
          })
        }
      }
    }
  }

  useEffect(() => {
    const viewport = viewRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [messages.length, isRequestInFlight, chatId])

  useEffect(() => {
    const pendingPollTimers = pendingTaskPollTimersRef.current
    const pendingInFlightTasks = pendingTaskInFlightRef.current
    const reqMetaByChat = reqMetaByChatRef.current

    return () => {
      reqMetaByChat.forEach((reqMeta) => {
        reqMeta.abortController?.abort()
      })
      reqMetaByChat.clear()
      pendingPollTimers.forEach((timerId) => {
        window.clearInterval(timerId)
      })
      pendingPollTimers.clear()
      pendingInFlightTasks.clear()
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
      if (toastOutRef.current) {
        window.clearTimeout(toastOutRef.current)
      }
      if (historyToastTimerRef.current) {
        window.clearTimeout(historyToastTimerRef.current)
      }
      if (historyToastOutRef.current) {
        window.clearTimeout(historyToastOutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const saved = localStorage.getItem(PENDING_IMAGE_TASKS_KEY)
      if (!saved) return

      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return

      const loadedTasks: PendingImageTask[] = []
      parsed.forEach((item) => {
        if (!item || typeof item !== "object") return
        const typed = item as Partial<PendingImageTask>
        if (
          typeof typed.key !== "string" ||
          (typed.kind !== "imagine" && typed.kind !== "multiEdit") ||
          typeof typed.taskId !== "string" ||
          typeof typed.chatId !== "string" ||
          typeof typed.loadingMessageId !== "string"
        ) {
          return
        }
        loadedTasks.push({
          key: typed.key,
          kind: typed.kind,
          taskId: typed.taskId,
          chatId: typed.chatId,
          loadingMessageId: typed.loadingMessageId,
          loadingMode: typed.loadingMode === "replace" ? "replace" : "new",
          restoreRevisionIndex: typeof typed.restoreRevisionIndex === "number" ? typed.restoreRevisionIndex : undefined,
          createdAt: typeof typed.createdAt === "number" ? typed.createdAt : Date.now(),
        })
      })

      if (loadedTasks.length === 0) {
        localStorage.removeItem(PENDING_IMAGE_TASKS_KEY)
        return
      }

      loadedTasks.forEach((task) => {
        const taskToken = nextReqToken(task.chatId)
        reqMetaByChatRef.current.set(task.chatId, {
          token: taskToken,
          abortController: null,
          loadingMessageId: task.loadingMessageId,
          loadingMode: task.loadingMode ?? "new",
          restoreRevisionIndex: task.restoreRevisionIndex,
        })
        setChatInFlight(task.chatId, true)
        pendingImageTasksRef.current.set(task.key, task)
        startPendingImageTask(task.key)
      })
      savePendingImageTasks()
    } catch {
    }
  }, [nextReqToken, savePendingImageTasks, setChatInFlight, startPendingImageTask])

  useEffect(() => {
    setAttachments((prev) => {
      if (prev.length <= maxFiles) return prev
      return prev.slice(0, maxFiles)
    })
  }, [maxFiles])

  useEffect(() => {
    if (galleryImages.length === 0) {
      setIsGalleryOpen(false)
      setActiveGalleryIndex(0)
      return
    }

    setActiveGalleryIndex((prev) => Math.min(prev, galleryImages.length - 1))
  }, [galleryImages.length])

  useEffect(() => {
    if (!toastMessage || isToastExiting) return
    bleeps.notify?.play("toast-notify")
  }, [bleeps, isToastExiting, toastMessage])

  useEffect(() => {
    if (!lastAidId) return
    const previousId = prevAidIdRef.current
    prevAidIdRef.current = lastAidId
    if (!previousId || previousId === lastAidId) return
    if (lastAidMsg?.responseState === "error") {
      return
    }
    bleeps.assemble?.play("assistant-reply")
  }, [bleeps, lastAidMsg?.responseState, lastAidId])

  useEffect(() => {
    if (!historyToastMessage || isHistoryToastExiting) return
    bleeps.notify?.play("toast-notify")
  }, [bleeps, historyToastMessage, isHistoryToastExiting])

  const [cachedImgUrls, setCachedImgUrls] = useState<Record<string, string>>({})
  const applyCachedImage = useCallback((url: string, dataUrl: string) => {
    imgCacheMap.current.set(url, dataUrl)
    setCachedImgUrls((prev) => {
      if (prev[url] === dataUrl) return prev
      return { ...prev, [url]: dataUrl }
    })
    void setCachedImage(url, dataUrl)
  }, [setCachedImage])

  const getImgSrc = useCallback((url: string): string => {
    return cachedImgUrls[url] || url
  }, [cachedImgUrls])

  const fmtMsgTime = useCallback((date: Date) => timeFormatter.format(date), [timeFormatter])

  const fmtHistoryDay = useCallback((date: Date) => {
    const now = new Date()
    const targetDay = getDayKey(date)
    const todayKey = getDayKey(now)
    if (targetDay === todayKey) {
      return "Today"
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (targetDay === getDayKey(yesterday)) {
      return "Yesterday"
    }

    return dateFormatter.format(date)
  }, [dateFormatter])

  const showHistoryToast = useCallback((message: string) => {
    setIsHistoryToastExiting(false)
    setHistoryToastMessage(message)

    if (historyToastTimerRef.current) {
      window.clearTimeout(historyToastTimerRef.current)
    }
    if (historyToastOutRef.current) {
      window.clearTimeout(historyToastOutRef.current)
    }

    historyToastTimerRef.current = window.setTimeout(() => {
      setIsHistoryToastExiting(true)
      historyToastOutRef.current = window.setTimeout(() => {
        setHistoryToastMessage(null)
        setIsHistoryToastExiting(false)
      }, 260)
    }, 2000)
  }, [])

  const syncVisibleDay = useCallback((shouldToast: boolean) => {
    const viewport = viewRef.current
    if (!viewport || messages.length === 0) return

    const scrollTop = viewport.scrollTop
    let firstVisibleMessage: Message | undefined

    for (const message of messages) {
      const node = messageNodeRefs.current.get(message.id)
      if (!node) continue
      const nodeBottom = node.offsetTop + node.offsetHeight
      if (nodeBottom >= scrollTop + 8) {
        firstVisibleMessage = message
        break
      }
    }

    const fallbackMessage = firstVisibleMessage ?? messages[messages.length - 1]
    const nextDayKey = getDayKey(fallbackMessage.timestamp)
    if (visibleDayKeyRef.current === nextDayKey) return

    visibleDayKeyRef.current = nextDayKey
    if (!shouldToast) return

    showHistoryToast(fmtHistoryDay(fallbackMessage.timestamp))
  }, [fmtHistoryDay, messages, showHistoryToast])

  const onViewportScroll = useCallback(() => {
    hasInteractedWithScrollRef.current = true
    syncVisibleDay(true)
  }, [syncVisibleDay])

  const setMessageNode = useCallback((messageId: string, node: HTMLDivElement | null) => {
    if (node) {
      messageNodeRefs.current.set(messageId, node)
      return
    }
    messageNodeRefs.current.delete(messageId)
  }, [])

  useEffect(() => {
    visibleDayKeyRef.current = null
    hasInteractedWithScrollRef.current = false
    const rafId = window.requestAnimationFrame(() => {
      syncVisibleDay(false)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [chatId, messages, syncVisibleDay])

  const handleSend = async () => {
    if (!chatId || isRequestInFlight) return
    const prompt = inputValueRef.current
    if (!prompt.trim()) return
    const filesIn = chatMode === "dark" ? [] : attachments.slice(0, maxFiles)

    if (filesIn.some((file) => !okImgFile(file))) {
      showToast("Only image files are supported")
      setAttachments([])
      return
    }

    const timestamp = Date.now()
    const newMessage: Message = {
      id: `user-${timestamp}`,
      content: prompt,
      role: "user",
      timestamp: new Date(),
      attachments: filesIn.length > 0 ? filesIn : undefined,
    }

    addMessage(chatId, newMessage)
    inputValueRef.current = ""
    setHasInput(false)
    setIsEditPromptGlow(false)
    if (textAreaRef.current) {
      textAreaRef.current.value = ""
    }
    setAttachments([])

    await askAi(chatId, newMessage.content, filesIn)
  }

  const regenMsg = async (assistantMessageId: string) => {
    if (!chatId || isRequestInFlight) return

    const chat = getChat(chatId)
    if (!chat || chat.messages.length === 0) return

    const assistantIndex = chat.messages.findIndex((message) => message.id === assistantMessageId)
    if (assistantIndex < 0) return

    const lastUserIndex = chat.messages
      .slice(0, assistantIndex)
      .map((message) => message.role)
      .lastIndexOf("user")

    if (lastUserIndex < 0) return

    const lastUserMessage = chat.messages[lastUserIndex]
    const lastFiles = lastUserMessage.attachments ?? []

    await askAi(chatId, lastUserMessage.content, lastFiles, {
      replaceMessageId: assistantMessageId,
      excludedMessageIds: new Set([assistantMessageId]),
    })
  }

  const navigateMsgRevision = useCallback((
    targetChatId: string,
    messageId: string,
    direction: "prev" | "next"
  ) => {
    const chat = getChat(targetChatId)
    const message = chat?.messages.find((entry) => entry.id === messageId)
    if (!message) return

    const revisions = getMessageRevisions(message)
    if (revisions.length <= 1) return

    const activeIndex = clampRevisionIndex(message, revisions)
    const nextIndex = direction === "prev"
      ? Math.max(activeIndex - 1, 0)
      : Math.min(activeIndex + 1, revisions.length - 1)
    if (nextIndex === activeIndex) return

    const nextRevision = revisions[nextIndex]
    updateMessage(targetChatId, messageId, {
      content: nextRevision.content,
      timestamp: nextRevision.timestamp,
      responseState: nextRevision.responseState,
      revisions,
      activeRevision: nextIndex,
    })
  }, [getChat, updateMessage])

  const showToast = useCallback((message: string) => {
    setIsToastExiting(false)
    setToastMessage(message)

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    if (toastOutRef.current) {
      window.clearTimeout(toastOutRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setIsToastExiting(true)
      toastOutRef.current = window.setTimeout(() => {
        setToastMessage(null)
        setIsToastExiting(false)
      }, 260)
    }, 1850)
  }, [])

  useEffect(() => {
    const onDarkToast = () => {
      showToast("[U n l o c k e d]")
    }

    window.addEventListener("navi_darkmode_toast", onDarkToast)
    return () => {
      window.removeEventListener("navi_darkmode_toast", onDarkToast)
    }
  }, [showToast])

  const copyTxt = useCallback(async (content: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
        return true
      }
    } catch {
    }

    try {
      const textArea = document.createElement("textarea")
      textArea.value = content
      textArea.setAttribute("readonly", "true")
      textArea.style.position = "fixed"
      textArea.style.top = "-9999px"
      textArea.style.left = "-9999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      textArea.setSelectionRange(0, textArea.value.length)

      const didCopy = document.execCommand("copy")
      document.body.removeChild(textArea)
      return didCopy
    } catch {
      return false
    }
  }, [])

  const handleCopy = useCallback(async (content: string) => {
    const copied = await copyTxt(content)
    if (copied) {
      showToast("Text copied to clipboard")
      return
    }

    window.prompt("Copy text manually:", content)
    showToast("Copy unavailable, manual copy shown")
  }, [copyTxt, showToast])

  const imgName = useCallback((imageUrl: string): string => {
    try {
      const pathname = new URL(imageUrl).pathname
      const candidate = pathname.split("/").pop() ?? ""
      if (candidate.trim().length > 0) {
        return candidate
      }
    } catch {
    }

    return `image-${Date.now()}.png`
  }, [])

  const nameFromDisposition = useCallback((contentDisposition: string | null): string | null => {
    if (!contentDisposition) return null

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]).trim()
      } catch {
      }
    }

    const fallbackMatch = contentDisposition.match(/filename="?([^\";]+)"?/i)
    if (fallbackMatch?.[1]) {
      const candidate = fallbackMatch[1].trim()
      if (candidate.length > 0) {
        return candidate
      }
    }

    return null
  }, [])

  const blobToDataUrl = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error("Failed to encode image for edit."))
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : ""
        if (!dataUrl) {
          reject(new Error("Image encode returned empty payload."))
          return
        }
        resolve(dataUrl)
      }
      reader.readAsDataURL(blob)
    })
  }, [])

  const dataUrlToFile = useCallback((dataUrl: string, fileName: string): File => {
    const [header, base64Payload] = dataUrl.split(",")
    if (!header || !base64Payload) {
      throw new Error("Invalid image payload for edit.")
    }

    const mimeMatch = header.match(/data:([^;]+);base64/i)
    const mimeType = mimeMatch?.[1] ?? "image/png"
    const decoded = atob(base64Payload)
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i)
    }

    return new File([bytes], fileName, { type: mimeType })
  }, [])

  const imageUrlToEditFile = useCallback(async (imageUrl: string): Promise<File> => {
    const cached = imgCacheMap.current.get(imageUrl) ?? await getCachedImage(imageUrl)
    if (cached) {
      applyCachedImage(imageUrl, cached)
      return dataUrlToFile(cached, imgName(imageUrl))
    }

    const proxiedUrl = `/api/download-image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(proxiedUrl, { cache: "force-cache" })
    if (!response.ok) {
      throw new Error(`Edit image download failed with status ${response.status}`)
    }

    const blob = await response.blob()
    const dataUrl = await blobToDataUrl(blob)
    applyCachedImage(imageUrl, dataUrl)
    const fileNameFromHeader = nameFromDisposition(response.headers.get("content-disposition"))
    const fileName = fileNameFromHeader || imgName(imageUrl)

    return dataUrlToFile(dataUrl, fileName)
  }, [applyCachedImage, blobToDataUrl, dataUrlToFile, imgName, nameFromDisposition])

  const fetchImgToB64 = useCallback(async (url: string): Promise<string | null> => {
    try {
      const proxyUrl = `/api/download-image?url=${encodeURIComponent(url)}`
      const res = await fetch(proxyUrl, { cache: "force-cache" })
      if (!res.ok) return null
      const blob = await res.blob()
      return blobToDataUrl(blob)
    } catch {
      return null
    }
  }, [blobToDataUrl])

  const ensureCachedImage = useCallback(async (url: string, allowFetch = true): Promise<string | null> => {
    const existing = imgCacheMap.current.get(url)
    if (existing) return existing

    const stored = await getCachedImage(url)
    if (stored) {
      applyCachedImage(url, stored)
      return stored
    }

    if (!allowFetch) return null
    const fetched = await fetchImgToB64(url)
    if (!fetched) return null
    applyCachedImage(url, fetched)
    return fetched
  }, [applyCachedImage, fetchImgToB64])

  useEffect(() => {
    let active = true
    const cacheImages = async () => {
      for (const msg of messages) {
        const urls = getImgUrls(msg.content)
        for (const url of urls) {
          if (!active) return
          await ensureCachedImage(url)
        }
      }
    }
    void cacheImages()
    return () => {
      active = false
    }
  }, [ensureCachedImage, messages])

  const dlImg = useCallback(async (imageUrl: string) => {
    try {
      let src: string | null | undefined = await ensureCachedImage(imageUrl)
      if (!src) {
        src = imageUrl
      }

      const isDataUrl = src.startsWith("data:")
      let blob: Blob

      if (isDataUrl) {
        const res = await fetch(src)
        blob = await res.blob()
      } else {
        const res = await fetch(imageUrl)
        blob = await res.blob()
      }

      const obj3 = URL.createObjectURL(blob)
      const obj4 = document.createElement("a")
      obj4.href = obj3
      obj4.download = imgName(imageUrl)
      obj4.rel = "noopener noreferrer"
      obj4.style.display = "none"
      document.body.appendChild(obj4)
      obj4.click()
      document.body.removeChild(obj4)
      URL.revokeObjectURL(obj3)
      showToast("Download started")
    } catch {
      showToast("Download failed")
    }
  }, [ensureCachedImage, imgName, showToast])

  const editImg = useCallback(async (imageUrl: string) => {
    try {
      const editFile = await imageUrlToEditFile(imageUrl)
      if (!okImgFile(editFile)) {
        showToast("Only image files are supported")
        return
      }

      setAttachments([editFile])
      setChatMode("image")
      setIsEditPromptGlow(true)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      window.requestAnimationFrame(() => {
        textAreaRef.current?.focus()
      })

      showToast("Image attached. Describe what to edit.")
    } catch {
      showToast("Could not prepare image for edit")
    }
  }, [imageUrlToEditFile, setChatMode, showToast])

  const openGal = useCallback((imageKey: string) => {
    const index = imgKeyMap.get(imageKey)
    if (index === undefined) return
    setActiveGalleryIndex(index)
    setIsGalleryOpen(true)
  }, [imgKeyMap])

  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false)
  }, [])

  const prevGal = useCallback(() => {
    if (galleryImages.length === 0) return
    setActiveGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
  }, [galleryImages.length])

  const nextGal = useCallback(() => {
    if (galleryImages.length === 0) return
    setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length)
  }, [galleryImages.length])

  useEffect(() => {
    if (!isGalleryOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGallery()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setActiveGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isGalleryOpen, galleryImages.length, closeGallery])

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    if (chatMode === "dark") {
      showToast("Not available under DARK MODE.")
      e.target.value = ""
      return
    }

    const files = Array.from(e.target.files)
    const imgs = files.filter((file) => okImgFile(file))

    if (imgs.length === 0) {
      setAttachments([])
      showToast("Only image files are supported")
      e.target.value = ""
      return
    }

    if (imgs.length < files.length) {
      showToast("Only image files are supported")
    }

    const mergedFiles =
      chatMode === "image" ? [...attachments, ...imgs] : imgs.slice(0, 1)

    if (mergedFiles.length > maxFiles) {
      showToast(
        chatMode === "image" ? "Maximum four images allowed" : "Only one image can be uploaded"
      )
    }

    setAttachments(mergedFiles.slice(0, maxFiles))
    setIsEditPromptGlow(false)
    e.target.value = ""
  }

  const clearAttach = () => {
    setAttachments([])
    setIsEditPromptGlow(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value
    inputValueRef.current = nextValue
    const nextHasInput = nextValue.trim().length > 0
    setHasInput((prev) => (prev === nextHasInput ? prev : nextHasInput))
    if (nextHasInput) {
      setIsEditPromptGlow(false)
    }
  }, [])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isRequestInFlight) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasTxt = hasInput
  const noAttach = chatMode === "dark" || attachments.length >= maxFiles || isRequestInFlight
  const attachWhy = chatMode === "dark"
    ? "Not available under DARK MODE."
    : isRequestInFlight
      ? "Request in progress..."
      : attachments.length >= maxFiles
        ? "Maximum files attached..."
        : null
  const noSend = isRequestInFlight || !hasTxt
  const sendWhy = !hasTxt
    ? "Please type something"
    : isRequestInFlight
      ? "Request in progress..."
      : null
  const galOverlay =
    isGalleryOpen && curImg ? (
      <div
        className="gallery-overlay fixed inset-0 z-[11000] flex items-center justify-center p-4"
        onClick={closeGallery}
        role="dialog"
        aria-modal="true"
        aria-label="Image gallery"
      >
        <NaviBtn
          type="button"
          frame="octagon"
          className="octbtn downloadimg absolute left-4 top-4 z-[120] h-11 w-20 min-h-0 p-0 sm:h-14 sm:w-24"
          onClick={(event) => {
            event.stopPropagation()
            if (curImg) {
              dlImg(curImg)
            }
          }}
          aria-label="Download image"
        >
          <Download className="h-6 w-6 sm:h-8 sm:w-8" />
        </NaviBtn>

        <NaviBtn
          type="button"
          frame="octagon"
          className="octbtn remove-filebtn absolute right-4 top-4 z-[120] h-11 w-20 min-h-0 p-0 sm:h-14 sm:w-24"
          onClick={(event) => {
            event.stopPropagation()
            closeGallery()
          }}
          aria-label="Close gallery"
        >
          <X className="h-6 w-6 sm:h-8 sm:w-8" />
        </NaviBtn>

        <div
          className="gal-inside relative inline-flex  items-center justify-center p-0"
          onClick={(event) => event.stopPropagation()}
        >
          <FrameLines
            styled
            animated
            padding={1}
            largeLineWidth={3}
            smallLineWidth={5}
            smallLineLength={65}
            className="gallerylines pointer-events-none absolute inset-0 z-[1]"
          />
          <NaviBtn
            type="button"
            frame="octagon"
            className="gal-navigatebtn active:translate-y-0 absolute left-[2%] z-[60] h-14 w-14 cursor-pointer sm:h-24 sm:w-24 gal-prev"
            onClick={(event) => {
              event.stopPropagation()
              prevGal()
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8 sm:h-14 sm:w-14" />
          </NaviBtn>

          <div className="img-inframe   flex items-center justify-center">
            <FrameLines
              styled
              animated
              padding={1}
              largeLineWidth={2}
              smallLineWidth={3}
              smallLineLength={14}
              className="gallerystuff pointer-events-none "
            />
            <div className="img-galleryitem relative z-[2]">
              <Image
                src={curImg ? getImgSrc(curImg) : curImg}
                alt={`Chat image ${activeGalleryIndex + 1}`}
                width={1600}
                height={1600}
                unoptimized
                className="gallery-image block object-contain"
              />
            </div>
          </div>
          <NaviBtn
            type="button"
            frame="octagon"
            className="gal-navigatebtn active:translate-y-0 absolute right-[2%] z-[60] h-14 w-14 cursor-pointer sm:h-24 sm:w-24 gal-next"
            onClick={(event) => {
              event.stopPropagation()
              nextGal()
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8 sm:h-14 sm:w-14" />
          </NaviBtn>
        </div>

        <div className="galery2 absolute bottom-4 left-1/2 z-[40] flex h-10 w-24 -translate-x-1/2 items-center justify-center overflow-hidden px-3 py-1 text-sm text-cyan-100">
          <FrameLines
            styled
            animated
            padding={1}
            largeLineWidth={1}
            smallLineWidth={1}
            smallLineLength={1}
            className="galery2frame pointer-events-none absoluteinset-0 z-[1]"
          />
          <NaviTxt
            as="span"
            className="galtext relative z-[2] text-center"
            text={`${activeGalleryIndex + 1} / ${galleryImages.length}`}
            trigger={`gallery-count-${activeGalleryIndex}`}
          />
        </div>
      </div>
    ) : null

  return (
    <TooltipProvider>
      <div className="cybertxt flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={viewRef}
            onScroll={onViewportScroll}
            className="h-full overflow-y-auto px-3 py-4 sm:px-4 md:px-6"
          >
            <div className="mx-auto w-full max-w-4xl space-y-4 pb-4">
              {messages.map((message) => {
                const revisions = getMessageRevisions(message)
                const activeRevisionIndex = clampRevisionIndex(message, revisions)
                const revisionCount = revisions.length
                const inlineImgs = getImgUrls(message.content)
                const txtBody = cleanImgUrls(message.content)
                const isUserMessage = message.role === "user"
                const isLoadAid =
                  message.role === "assistant" && message.responseState === "loading"
                const isErrAid =
                  message.role === "assistant" && message.responseState === "error"
                const canCopyText = txtBody.trim().length > 0
                const showImageActions = inlineImgs.length > 0 && txtBody.length === 0
                const showRevisionNav = !isUserMessage && revisionCount > 1
                const isDarkMode = chatMode === "dark"
                const isDrkWait =
                  isDarkMode &&
                  isLoadAid &&
                  message.content.trim().toLowerCase() === DrkmodeWaitTxt.toLowerCase()
                const bubbleStyle = isDarkMode
                  ? isUserMessage
                    ? usrBubbleStyleDark
                    : isErrAid
                      ? errBubbleStyleDark
                      : aidBubbleStyleDark
                  : isUserMessage
                    ? usrBubbleStyle
                    : isErrAid
                      ? errBubbleStyle
                      : aidBubbleStyle
                const bubbleClass = `chat-bubble ${isUserMessage ? "chat-bubble-user" : isErrAid ? "chat-bubble-error" : "chat-bubble-assistant"}`

                return (
                  <div
                    key={message.id}
                    ref={(node) => setMessageNode(message.id, node)}
                    className={`flex ${isUserMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className="w-full max-w-[92%] sm:max-w-[82%] md:max-w-[72%]">
                      <div
                        className={`${bubbleClass} relative p-4 ${
                          isUserMessage
                            ? "border border-cyan-300/50"
                            : isErrAid
                              ? "border border-red-400/60 shadow-[0_0_18px_rgba(255,82,82,0.28)]"
                              : "border border-cyan-500/35"
                        }`}
                      >
                          <FrameNefrex
                            {...navi_panel_1}
                            style={bubbleStyle}
                            className="pointer-events-none absolute inset-0 z-[1]"
                          />
                        <div
                          className={`chat-bubble-text relative z-[2] ${
                            isUserMessage ? "text-cyan-50" : "text-cyan-100"
                          }`}
                        >
                          {isLoadAid ? (
                            <p className="relative z-[2] text-decipher loadingtxt text-cyan-200">
                              {isDrkWait ? (
                                <LoadingStatusText
                                  messageId={message.id}
                                  primaryText={DrkmodeWaitTxt}
                                  alternateText={DrkmodeLoadTxt}
                                />
                              ) : (
                                <SlowDecipherText
                                  text={LOADING_LABEL}
                                  trigger={message.id}
                                  durationMs={1500}
                                  loop
                                />
                              )}
                            </p>
                          ) : (
                            txtBody.length > 0 && (
                              <AssistantMarkdown
                                getjson={txtBody}
                                cpbtn_markdown={handleCopy}
                              />
                            )
                          )}
                          {inlineImgs.length > 0 && (
                            <div className={txtBody.length > 0 ? "mt-3 space-y-3" : "space-y-3"}>
                              {inlineImgs.map((imageUrl, index) => (
                                <div key={`${message.id}-inline-image-${index}`}>
                                  <Image
                                    src={getImgSrc(imageUrl)}
                                    alt="Generated result"
                                    width={1024}
                                    height={1024}
                                    unoptimized
                                    loading="lazy"
                                    className="max-h-[440px] w-full cursor-zoom-in rounded-md border border-cyan-400/30 bg-black/40 object-contain"
                                    onClick={() =>
                                      openGal(`${message.id}-inline-image-${index}`)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 text-sm text-cyan-300">
                              <NaviTxt
                                as="span"
                                className="text-sm text-cyan-300"
                                text={`Attached: ${message.attachments.length} file(s)`}
                                trigger={`${message.id}-attachments`}
                              />
                            </div>
                          )}
                          <div
                            className={`pointer-events-none mt-4 flex ${
                              isUserMessage ? "justify-end" : "justify-start"
                            } z-[3]`}
                          >
                            <span
                              className={`chat-timestamp ${
                                isUserMessage
                                  ? "chat-timestamp-user"
                                  : "chat-timestamp-assistant"
                              }`}
                            >
                              {fmtMsgTime(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isUserMessage && canCopyText && (
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            className="chat-action-btn relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                            onClick={() => handleCopy(message.content)}
                          >
                            <FrameCorners
                              style={actionFrameStyle}
                              className="pointer-events-none absolute inset-0"
                              padding={1}
                            />
                            <Copy className="relative z-[2] h-3.5 w-3.5" />
                            <NaviTxt
                              as="span"
                              className="relative z-[2]"
                              text="Copy text"
                              trigger={`${message.id}-copy-user`}
                            />
                          </button>
                        </div>
                      )}

                      {message.role === "assistant" && !isLoadAid && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {showImageActions ? (
                            <button
                              type="button"
                              className="chat-action-btn relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                              onClick={() => dlImg(inlineImgs[0])}
                            >
                              <FrameCorners
                                style={actionFrameStyle}
                                className="pointer-events-none absolute inset-0"
                                padding={1}
                              />
                              <Download className="relative z-[2] h-3.5 w-3.5" />
                              <NaviTxt
                                as="span"
                                className="relative z-[2]"
                                text="Download image"
                                trigger={`${message.id}-download`}
                              />
                            </button>
                          ) : canCopyText ? (
                            <button
                              type="button"
                              className="chat-action-btn relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                              onClick={() => handleCopy(message.content)}
                            >
                              <FrameCorners
                                style={actionFrameStyle}
                                className="pointer-events-none absolute inset-0"
                                padding={1}
                              />
                              <Copy className="relative z-[2] h-3.5 w-3.5" />
                              <NaviTxt
                                as="span"
                                className="relative z-[2]"
                                text="Copy text"
                                trigger={`${message.id}-copy`}
                              />
                            </button>
                          ) : null}
                          
                          <button
                            type="button"
                            className="chat-action-btn relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                            onClick={() => regenMsg(message.id)}
                            disabled={isRequestInFlight || message.id !== lastAidId}
                          >
                            <FrameCorners
                              style={actionFrameStyle}
                              className="pointer-events-none absolute inset-0"
                              padding={1}
                            />
                            <RotateCcw className="relative z-[2] h-3.5 w-3.5" />
                            <NaviTxt
                              as="span"
                              className="relative z-[2]"
                              text="Regenerate"
                              trigger={`${message.id}-regenerate`}
                            />
                          </button>

                          {showImageActions && (
                            <button
                              type="button"
                              className="chat-action-btn relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                              onClick={() => editImg(inlineImgs[0])}
                              disabled={isRequestInFlight}
                            >
                              <FrameCorners
                                style={actionFrameStyle}
                                className="pointer-events-none absolute inset-0"
                                padding={1}
                              />
                              <Pencil className="relative z-[2] h-3.5 w-3.5" />
                              <NaviTxt
                                as="span"
                                className="relative z-[2]"
                                text="Edit"
                                trigger={`${message.id}-edit`}
                              />
                            </button>
                          )}

                          {showRevisionNav && chatId && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="chat-action-btn chat-action-nav relative inline-flex h-8 w-8 items-center justify-center text-cyan-300 transition-colors hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => navigateMsgRevision(chatId, message.id, "prev")}
                                disabled={activeRevisionIndex === 0}
                                aria-label="Previous generation"
                              >
                                <FrameCorners
                                  style={counterFrameStyle}
                                  className="pointer-events-none absolute inset-0"
                                  padding={1}
                                />
                                <ChevronLeft className="relative z-[2] h-3.5 w-3.5" />
                              </button>
                              <div className="relative inline-flex h-8 min-w-[56px] items-center justify-center px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-200">
                                <FrameCorners
                                  style={counterFrameStyle}
                                  className="pointer-events-none absolute inset-0"
                                  padding={1}
                                />
                                <span className="chat-action-counter relative z-[2]">{activeRevisionIndex + 1}/{revisionCount}</span>
                              </div>
                              <button
                                type="button"
                                className="chat-action-btn chat-action-nav relative inline-flex h-8 w-8 items-center justify-center text-cyan-300 transition-colors hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => navigateMsgRevision(chatId, message.id, "next")}
                                disabled={activeRevisionIndex >= revisionCount - 1}
                                aria-label="Next generation"
                              >
                                <FrameCorners
                                  style={counterFrameStyle}
                                  className="pointer-events-none absolute inset-0"
                                  padding={1}
                                />
                                <ChevronRight className="relative z-[2] h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-cyan-500/30 bg-black/10 p-3 backdrop-blur-sm sm:p-4">
          <div className="mx-auto w-full max-w-4xl">
           <div className="relative">
            

              <Textarea
                ref={textAreaRef}
                frame="nero"
                onChange={onInputChange}
                onKeyDown={onKey}
                disabled={isRequestInFlight}
                placeholder={
                  chatMode === "image"
                    ? "Describe your image request..."
                    : chatMode === "dark"
                      ? "[DARK NEKO :: No censorship active] Type your message..."
                    : "Type your message here..."
                }
                className={`chatboxshell relative z-[2] min-h-[92px] resize-none bg-transparent pr-24 text-cyan-100 placeholder-cyan-400/50 ${
                  isEditPromptGlow ? "txt-glow-area" : ""
                }`}
              />
              <div className="absolute bottom-2 right-2 z-[4] flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={chatMode === "image"}
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={onFilePick}
                  disabled={chatMode === "dark"}
                  className="hidden"
                />

                <div className="bottom-2 right-2 z-[4] flex gap-2 ">
                  {attachWhy ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <NaviBtn
                            type="button"
                            frame="octagon"
                            onClick={() => fileInputRef.current?.click()}
                            className="octbtn h-8 w-8 min-h-0 p-0"
                            disabled={noAttach}
                            aria-disabled={noAttach}
                          >
                            <Paperclip className="h-4 w-4" />
                          </NaviBtn>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="navi_notif_cnt" side="top" sideOffset={7}>
                        {attachWhy}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <NaviBtn
                      type="button"
                      frame="octagon"
                      onClick={() => fileInputRef.current?.click()}
                      className="octbtn h-8 w-8 min-h-0 p-0"
                      disabled={noAttach}
                    >
                      <Paperclip className="h-4 w-4" />
                    </NaviBtn>
                  )}

                  {isRequestInFlight ? (
                    <NaviBtn
                      type="button"
                      frame="octagon"
                      onClick={() => stopReq()}
                      className="octbtn chat-btn oct-stop h-8 w-8 min-h-0 p-0"
                    >
                      <Square className="h-4 w-4" />
                    </NaviBtn>
                  ) : (
                    <>
                      {sendWhy ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <NaviBtn
                                type="button"
                                frame="octagon"
                                onClick={handleSend}
                                disabled={noSend}
                                aria-disabled={noSend}
                                className="octbtn h-8 w-8 min-h-0 p-0"
                              >
                                <Send className="h-4 w-4" />
                              </NaviBtn>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            className="navi_notif_cnt"
                            side="top"
                            sideOffset={7}
                          >
                            {sendWhy}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <NaviBtn
                          type="button"
                          frame="octagon"
                          onClick={handleSend}
                          disabled={noSend}
                          className="octbtn h-8 w-8 min-h-0 p-0"
                        >
                          <Send className="h-4 w-4" />
                        </NaviBtn>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-cyan-300">
                <NaviTxt
                  as="span"
                  text={`${attachments.length} image${attachments.length > 1 ? "s" : ""} attached${chatMode === "image" ? ` (${attachments.length}/4)` : ""}`}
                  trigger={`attachments-${attachments.length}-${chatMode}`}
                />
                <NaviBtn
                  type="button"
                  frame="octagonX"
                  onClick={clearAttach}
                  className="octbtn remove-filebtn h-8 w-8 min-h-0 p-0"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="h-4 w-4" />
                </NaviBtn>
              </div>
            )}
          </div>
        </div>
      </div>
      {typeof window !== "undefined" ? createPortal(galOverlay, document.body) : null}
      {historyToastMessage && (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[10001] w-max max-w-[85vw] -translate-x-1/2">
          <div
            className={`toastnotif navi_notif_cnt relative px-3 py-1.5 ${
              isHistoryToastExiting ? "navi_toast_out" : "navi_toast_in"
            }`}
          >
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
                text={historyToastMessage}
                trigger={`history-toast-${historyToastMessage}`}
              />
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[10000] w-max max-w-[85vw] -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
          <div
            className={`toastnotif navi_notif_cnt relative px-3 py-1.5 ${
              isToastExiting ? "navi_toast_out" : "navi_toast_in"
            }`}
          >
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
                text={toastMessage}
                trigger={`toast_notif-${toastMessage}`}
              />
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
