"use client"

import { useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { ThreeDWorkspace } from "@/components/artifacts_workspace"
import { useChatSess } from "@/components/layout-wrapper"

export function ChatPageWrapper() {
  const { curChatId, chatMode } = useChatSess()
  const lastChatModeRef = useRef<"chat" | "image">("chat")
  const is3DMode = chatMode === "3d"

  if (chatMode === "chat" || chatMode === "image") {
    lastChatModeRef.current = chatMode
  }

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden">
      <div className="relative z-[2] h-full w-full">
        <div
          className="absolute inset-0 z-[3] h-full w-full"
          style={{ display: is3DMode ? "block" : "none" }}
          aria-hidden={!is3DMode}
          inert={!is3DMode}
        >
          <ThreeDWorkspace />
        </div>
        <div
          className="absolute inset-0 z-[2] h-full w-full"
          style={{ display: is3DMode ? "none" : "block" }}
          aria-hidden={is3DMode}
          inert={is3DMode}
        >
          <ChatInterface
            chatId={curChatId}
            chatMode={is3DMode ? lastChatModeRef.current : chatMode}
          />
        </div>
      </div>
    </div>
  )
}
