/// chat db storage 


export interface NaviFile {
  name: string
  url: string
  type?: string
  size?: number
  error?: string
}

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  attachments?: File[]
  responseState?: "ok" | "error" | "loading"
  revisions?: MessageRevision[]
  activeRevision?: number
  cachedImages?: Record<string, string>
  files?: NaviFile[]
}

export interface MessageRevision {
  id: string
  content: string
  timestamp: Date
  responseState?: "ok" | "error" | "loading"
  cachedImages?: Record<string, string>
}

export interface Chat {
  id: string
  backendSessionId: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  temporary?: boolean
  darkJobId?: string
  darkTaskId?: string
}

interface SessCookie {
  id: string
  backendSessionId: string
  title: string
  createdAt: string
  updatedAt: string
}

export class ChatStore {
  private chats: Map<string, Chat> = new Map()
  private listeners: Set<() => void> = new Set()
  private readonly sessKey = "chat_sessions"
  private readonly sessAge = 60 * 60 * 24 * 365
  private saveTimer: number | null = null
  private readonly saveDebounceMs = 180

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  private genId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  private cleanSess(title: string): string {
    const normalized = title
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase()

    if (normalized.length === 0) {
      return "CHAT"
    }

    return normalized.slice(0, 48)
  }

  private genUid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(8)
      crypto.getRandomValues(bytes)
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    }

    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
  }

  private genBackId(title: string): string {
    return `${this.cleanSess(title)}_${this.genUid()}`
  }

  private isValidBackId(value: string): boolean {
    return /^[A-Z0-9_]+_[a-z0-9]{8,}$/i.test(value.trim())
  }

  private getCookie(name: string): string | null {
    if (typeof document === "undefined") return null
    const nameEq = `${name}=`
    const cookies = document.cookie.split(";")
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim()
      if (cookie.startsWith(nameEq)) {
        return decodeURIComponent(cookie.substring(nameEq.length))
      }
    }
    return null
  }

  private setCookie(name: string, value: string, maxAgeSeconds: number) {
    if (typeof document === "undefined") return
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
  }

  private loadSaved(parsed: Record<string, Chat>) {
    const movedMap = new Map<string, string>()
    const usedBackIds = new Set<string>()

    Object.entries(parsed).forEach(([storedId, chat]) => {
      const loadedChat = chat as Chat & { backendSessionId?: string }
      const originalId = loadedChat.id || storedId
      const chatId = this.isUuid(originalId) ? originalId : this.genId()
      const title =
        typeof loadedChat.title === "string" && loadedChat.title.trim().length > 0
          ? loadedChat.title
          : "New Chat"
      let backendSessionId =
        typeof loadedChat.backendSessionId === "string" && loadedChat.backendSessionId.trim().length > 0
          ? loadedChat.backendSessionId
          : this.genBackId(title)

      if (!this.isValidBackId(backendSessionId)) {
        backendSessionId = this.genBackId(title)
      }

      while (usedBackIds.has(backendSessionId)) {
        backendSessionId = this.genBackId(title)
      }

      usedBackIds.add(backendSessionId)

      if (chatId !== storedId) {
        movedMap.set(storedId, chatId)
      }
      if (loadedChat.id && loadedChat.id !== chatId) {
        movedMap.set(loadedChat.id, chatId)
      }

      this.chats.set(chatId, {
        ...loadedChat,
        id: chatId,
        backendSessionId,
        title,
        createdAt: new Date(loadedChat.createdAt),
        updatedAt: new Date(loadedChat.updatedAt),
        messages: Array.isArray(loadedChat.messages) ? loadedChat.messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          revisions: Array.isArray(m.revisions)
            ? m.revisions.map((revision) => ({
              ...revision,
              timestamp: new Date(revision.timestamp),
            }))
            : undefined,
        })) : [],
      })
    })

    if (movedMap.size > 0 && typeof window !== "undefined") {
      const curChatId =
        localStorage.getItem("currentChatId") ?? localStorage.getItem("curChatId")
      if (curChatId) {
        const movedCurId = movedMap.get(curChatId)
        if (movedCurId) {
          localStorage.setItem("currentChatId", movedCurId)
          localStorage.setItem("curChatId", movedCurId)
        }
      }
    }
  }

  private loadCookie(sessionCookiePayload: string) {
    try {
      const parsed = JSON.parse(sessionCookiePayload) as SessCookie[]
      if (!Array.isArray(parsed)) return
      const usedBackIds = new Set<string>()

      parsed.forEach((session) => {
        const originalId = session.id
        const chatId = this.isUuid(originalId) ? originalId : this.genId()
        const title = session.title || "New Chat"
        const backendSessionId =
          typeof session.backendSessionId === "string" && session.backendSessionId.trim().length > 0
            ? session.backendSessionId
            : this.genBackId(title)
        const normBackId = this.isValidBackId(backendSessionId)
          ? backendSessionId
          : this.genBackId(title)
        let uniqBackId = normBackId
        while (usedBackIds.has(uniqBackId)) {
          uniqBackId = this.genBackId(title)
        }
        usedBackIds.add(uniqBackId)

        this.chats.set(chatId, {
          id: chatId,
          backendSessionId: uniqBackId,
          title,
          messages: [],
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
        })
      })
    } catch {
    }
  }

  private saveCookie() {
    const sessEntries: SessCookie[] = this.getAllChats()
      .filter((chat) => !chat.temporary)
      .map((chat) => ({
      id: chat.id,
      backendSessionId: chat.backendSessionId,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
    }))

    const maxCookieBytes = 3500
    const shortEntries = [...sessEntries]
    let payload = JSON.stringify(shortEntries)

    while (payload.length > maxCookieBytes && shortEntries.length > 0) {
      shortEntries.pop()
      payload = JSON.stringify(shortEntries)
    }

    this.setCookie(this.sessKey, payload, this.sessAge)
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chats')
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, Chat>
          this.loadSaved(parsed)
        } catch {
        }
      }

      if (this.chats.size === 0) {
        const cookiePayload = this.getCookie(this.sessKey)
        if (cookiePayload) {
          this.loadCookie(cookiePayload)
        }
      }

      window.addEventListener("pagehide", this.flushSave)
      window.addEventListener("beforeunload", this.flushSave)
      document.addEventListener("visibilitychange", this.onVisibilityChange)
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach(listener => listener())
    this.scheduleSave()
  }

  private scheduleSave() {
    if (typeof window === "undefined") return
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, this.saveDebounceMs)
  }

  private flushSave = () => {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.saveNow()
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.flushSave()
    }
  }

  private saveNow() {
    if (typeof window !== 'undefined') {
      const toSave: Record<string, Chat> = {}
      this.chats.forEach((chat, id) => {
        if (chat.temporary) {
          return
        }
        toSave[id] = chat
      })
      localStorage.setItem('chats', JSON.stringify(toSave))
      this.saveCookie()
    }
  }

  createChat(): Chat {
    const title = "New Chat"
    const chat: Chat = {
      id: this.genId(),
      backendSessionId: this.genBackId(title),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.chats.set(chat.id, chat)
    this.notify()
    return chat
  }

  createTemporaryChat(title = "Anonymous Session"): Chat {
    const chat: Chat = {
      id: this.genId(),
      backendSessionId: this.genBackId("DARK_MODE"),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      temporary: true,
    }
    this.chats.set(chat.id, chat)
    this.notify()
    return chat
  }

  private isReuseNew(chat: Chat): boolean {
    return !chat.temporary && chat.title.trim().toLowerCase() === "new chat" && chat.messages.length === 0
  }

  getOrNew(): Chat {
    const newChats = Array.from(this.chats.values())
      .filter((chat) => this.isReuseNew(chat))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

    if (newChats.length === 0) {
      return this.createChat()
    }

    const [mainNew, ...duplicates] = newChats
    let changed = false

    if (mainNew.title !== "New Chat") {
      mainNew.title = "New Chat"
      mainNew.updatedAt = new Date()
      changed = true
    }

    if (duplicates.length > 0) {
      duplicates.forEach((chat) => this.chats.delete(chat.id))
      changed = true
    }

    if (changed) {
      this.notify()
    }

    return mainNew
  }

  getChat(id: string): Chat | undefined {
    return this.chats.get(id)
  }

  getAllChats(): Chat[] {
    return Array.from(this.chats.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  updateChat(id: string, updates: Partial<Chat>) {
    const chat = this.chats.get(id)
    if (chat) {
      const nextChat: Chat = {
        ...chat,
        ...updates,
        updatedAt: new Date(),
      }
      this.chats.set(id, nextChat)
      this.notify()
    }
  }

  addMessage(chatId: string, message: Message) {
    const chat = this.chats.get(chatId)
    if (chat) {
      const nextMessages = [...chat.messages, message]
      const nextChat: Chat = {
        ...chat,
        messages: nextMessages,
        updatedAt: new Date(),
      }

      if (nextMessages.length === 1 && message.role === "user" && chat.title === "New Chat") {
        nextChat.title = message.content.slice(0, 30) + (message.content.length > 30 ? "..." : "")
      }

      this.chats.set(chatId, nextChat)
      this.notify()
    }
  }

  updateMessage(chatId: string, messageId: string, updates: Partial<Message>) {
    const chat = this.chats.get(chatId)
    if (!chat) return

    const messageIndex = chat.messages.findIndex((message) => message.id === messageId)
    if (messageIndex < 0) return

    const nextMessages = [...chat.messages]
    nextMessages[messageIndex] = {
      ...nextMessages[messageIndex],
      ...updates,
    }

    this.chats.set(chatId, {
      ...chat,
      messages: nextMessages,
      updatedAt: new Date(),
    })
    this.notify()
  }

  deleteChat(id: string) {
    this.chats.delete(id)
    this.notify()
  }
}

export const chatStore = new ChatStore()
