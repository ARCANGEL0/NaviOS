"use client"

import * as React from "react"
import { Animator, FrameNefrex, FrameNero, FrameUnderline } from "@/components/ui/navi_fx"

import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea"> & {
  frame?: "underline" | "nefrex" | "nero" | "none"
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ className, frame = "underline", style, ...props }, ref) => {
  const nefrexFrameStyle =
    frame === "nefrex"
      ? ({
          "--arwes-frames-bg-color": "hsl(180 75% 10% / 0.88)",
          "--arwes-frames-line-color": "hsl(180 75% 30%)",
          "--arwes-frames-deco-color": "hsl(180 75% 50%)",
          "--arwes-frames-bg-filter": "drop-shadow(0 0 10px rgba(0, 220, 255, 0.14))",
          "--arwes-frames-line-filter": "drop-shadow(0 0 12px rgba(0, 238, 255, 0.28))",
        } as React.CSSProperties)
      : undefined

  return (
    <div className="relative w-full">
      {frame === "underline" && (
        <FrameUnderline className="navi_field pointer-events-none" />
      )}
        {frame === "nero" && (
        <FrameNero className="navi_field pointer-events-none" />
      )}
      {frame === "nefrex" && (
        <Animator active duration={{ enter: 0.22, exit: 0.12 }}>
          <FrameNefrex
            styled
            animated
            padding={2}
            leftTop
            leftBottom={false}
            rightTop={false}
            rightBottom
            squareSize={20}
            strokeWidth={2}
            smallLineLength={16}
            largeLineLength={72}
            style={nefrexFrameStyle}
            className="chatboxframe pointer-events-none"
          />
        </Animator>
      )}
      <textarea
        ref={ref}
        data-slot="textarea"
        style={style}
        className={cn(
          "navi_input chatbox placeholder:text-muted-foreground relative z-[3] block min-h-16 w-full border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
          className
        )}
        {...props}
      />
    </div>
  )
})

Textarea.displayName = "Textarea"

export { Textarea }
