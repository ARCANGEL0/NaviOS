"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Animator, FrameBase, FrameOctagon, useBleeps } from "@/components/ui/navi_fx"

import { NaviTxt } from "@/components/ui/navi_txt"
import { navi_ctrl_1 } from "@/components/ui/frames"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "navi_btn navi_bvl relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80",
  {
    variants: {
      variant: {
        default: "bg-cyan-500/16 text-cyan-100 hover:bg-cyan-400/24",
        destructive: "bg-red-500/20 text-red-100 hover:bg-red-500/30",
        outline: "bg-transparent text-cyan-100 hover:bg-cyan-500/10",
        secondary: "bg-cyan-600/10 text-cyan-100 hover:bg-cyan-500/20",
        ghost: "bg-transparent text-cyan-200 hover:bg-cyan-500/10",
        link: "bg-transparent text-cyan-100 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  frame = "control",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    frame?: "control" | "octagon"
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const bleeps = useBleeps<"hover" | "click">()

  const { onPointerEnter, onClick } = props
  const isDisabled = Boolean(props.disabled)
  const childrenArePlainText =
    typeof props.children === "string" || typeof props.children === "number"

  return (
    <Animator duration={{ enter: 0.14, exit: 0.09 }}>
      <Comp
        data-slot="button"
        className={cn(
          buttonVariants({ variant, size, className }),
          frame === "octagon" && "octbtn"
        )}
        {...props}
        onPointerEnter={(event) => {
          onPointerEnter?.(event)
          if (!isDisabled) {
            bleeps.hover?.play("button-hover")
          }
        }}
        onClick={(event) => {
          onClick?.(event)
          if (!isDisabled) {
            bleeps.click?.play("button-click")
          }
        }}
      >
        {frame === "octagon" ? (
          <FrameOctagon
            squareSize={8}
            strokeWidth={1.2}
            className="frame1 pointer-events-none"
          />
        ) : (
          <FrameBase
            settings={navi_ctrl_1}
            className="frame1 pointer-events-none"
          />
        )}
        <span className="btn-content">
          {childrenArePlainText ? (
            <NaviTxt as="span" text={String(props.children)} trigger={String(props.children)} />
          ) : (
            props.children
          )}
        </span>
      </Comp>
    </Animator>
  )
}

export { Button, buttonVariants }
