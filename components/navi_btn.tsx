"use client"

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  memo,
} from "react"
import { useBleeps } from "@/components/ui/navi_fx"
import { cn } from "@/lib/utils"

type BleepNames = "hover" | "click"

interface NaviBtnProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "onClick" | "onMouseEnter"> {
  className?: string
  color?: "primary" | "secondary"
  variant?: "fill" | "outline"
  frame?: "underline" | "nero" | "octagon" | "octagonX"
  animated?: unknown
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: () => void
}

export const NaviBtn = memo(function NaviBtn({
  className,
  color = "primary",
  variant,
  frame,
  animated,
  children,
  type = "button",
  disabled,
  onClick,
  onMouseEnter,
  ...props
}: NaviBtnProps) {
  const bleeps = useBleeps<BleepNames>()
  const isSquare = frame === "octagon" || frame === "octagonX"

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "nbtn",
        isSquare && "nbtn--sq",
        color === "secondary" && "nbtn--send",
        disabled && "navi_btn_disabled",
        className
      )}
      onMouseEnter={() => {
        if (disabled) return
        bleeps.hover?.play()
        onMouseEnter?.()
      }}
      onClick={(event) => {
        if (disabled) return
        bleeps.click?.play()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
