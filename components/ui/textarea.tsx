"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea"> & {
  frame?: "underline" | "nefrex" | "nero" | "none"
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ className, frame = "underline", style, ...props }, ref) => {
  return (
    <div className="nfield relative w-full" data-frame={frame}>
      <span className="nfield-tick" aria-hidden />
      <textarea
        ref={ref}
        data-slot="textarea"
        style={style}
        className={cn(
          "navi_input chatbox relative z-[3] block min-h-16 w-full resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
})

Textarea.displayName = "Textarea"

export { Textarea }
