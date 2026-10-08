"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { useBleeps } from "@/components/ui/navi_fx"

import { NaviTxt } from "@/components/ui/navi_txt"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "nbtn whitespace-nowrap disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default: "",
        destructive: "nbtn--danger",
        outline: "bg-transparent",
        secondary: "nbtn--on",
        ghost: "border-transparent bg-transparent shadow-none",
        link: "border-transparent bg-transparent shadow-none underline-offset-4 hover:underline hover:bg-transparent hover:shadow-none",
      },
      size: {
        default: "h-8 px-4",
        sm: "h-7 gap-1.5 px-3",
        lg: "h-9 px-6",
        icon: "nbtn--sq",
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
  frame,
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
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
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
      {childrenArePlainText ? (
        <NaviTxt as="span" text={String(props.children)} trigger={String(props.children)} />
      ) : (
        props.children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
