"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { FrameUnderline } from "@/components/ui/navi_fx"

import { NaviTxt } from "@/components/ui/navi_txt"
import { navi_under_1 } from "@/components/ui/frames"
import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "navi_notif_cnt navi_bvl relative z-50 w-fit px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        <FrameUnderline
          {...navi_under_1}
          className="navi_tooltip navi_tooltip_main pointer-events-none absolute inset-0 z-[1]"
        />
        <FrameUnderline
          {...navi_under_1}
          className="navi_tooltip navi_tooltip_inner pointer-events-none absolute inset-[2px] z-[1]"
        />
        <div className="relative z-[2]">
          {typeof children === "string" || typeof children === "number" ? (
            <NaviTxt
              as="span"
              text={String(children)}
              className="tiptxt"
              trigger={String(children)}
            />
          ) : (
            children
          )}
        </div>
        <TooltipPrimitive.Arrow className="tiparrow z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
