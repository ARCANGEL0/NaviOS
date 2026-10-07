"use client"

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  memo,
  useRef,
} from "react"
import {
  Animated,
  type AnimatedProp,
  FrameNero,
  FrameOctagon,
  FrameUnderline,
  Illuminator,
  useBleeps,
  useFrameAssembler,
} from "@/components/ui/navi_fx"
import { cn } from "@/lib/utils"
 type BleepNames = "hover" | "click"

interface NaviBtnProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "onClick" | "onMouseEnter"> {
  className?: string
  color?: "primary" | "secondary"
  variant?: "fill" | "outline"
  frame?: "underline" | "nero" | "octagon" | "octagonX"
  animated?: AnimatedProp
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: () => void
}

export const NaviBtn = memo(function NaviBtn({
  className,
  color = "primary",
  variant = "fill",
  frame = "underline",
  animated,
  children,
  type = "button",
  disabled,
  onClick,
  onMouseEnter,
  ...props
}: NaviBtnProps) {
  const bleeps = useBleeps<BleepNames>()
  const frmRef = useRef<SVGSVGElement | null>(null)
  useFrameAssembler(frmRef as React.RefObject<HTMLElement | SVGElement>)

  const animProp: AnimatedProp = Array.isArray(animated)
    ? ["fade", ...animated]
    : animated
      ? ["fade", animated]
      : ["fade"]

  const colCls =
    color === "secondary"
      ? [
          "[--arwes-frames-bg-color:rgba(61,45,8,0.46)]",
          "[--arwes-frames-line-color:rgba(255,222,123,0.86)]",
          "[--arwes-frames-bg-filter:drop-shadow(0_0_8px_rgba(255,199,92,0.14))]",
          "[--arwes-frames-line-filter:drop-shadow(0_0_10px_rgba(255,223,130,0.3))]",
        ].join(" ")
      : [
          "[--arwes-frames-bg-color:rgba(5,28,47,0.46)]",
          "[--arwes-frames-line-color:rgba(65,240,255,0.74)]",
          "[--arwes-frames-bg-filter:drop-shadow(0_0_8px_rgba(0,220,255,0.14))]",
          "[--arwes-frames-line-filter:drop-shadow(0_0_10px_rgba(0,235,255,0.28))]",
        ].join(" ")

  const varCls =
    variant === "outline"
      ? ""
      : ""

  const glow =
    color === "secondary" ? "hsla(52, 100%, 66%, 0.24)" : "hsla(188, 100%, 70%, 0.24)"

  return (
    <Animated<HTMLButtonElement>
      as="button"
      type={type}
      disabled={disabled}
      className={cn(
        "octrig relative inline-flex size-8 items-center justify-center overflow-hidden text-cyan-300/90 transition-[color,transform,filter] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 hover:text-cyan-100 hover:[filter:drop-shadow(0_0_8px_rgba(45,245,255,0.7))] active:translate-y-px",
        "hover:[--arwes-frames-bg-color:rgba(7,36,58,0.56)] hover:[--arwes-frames-line-color:rgba(102,246,255,0.95)]",
        colCls,
        varCls,
        disabled && "navi_btn_disabled",
        className
      )}
      animated={animProp}
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
      <div className="navi_btn_back">
        <Illuminator size={120} color={glow} />
      </div>
      {frame === "nero" ? (
        <FrameNero
          elementRef={frmRef as React.RefObject<SVGSVGElement>}
          style={{ zIndex: 0 }}
          padding={1}
          cornerLength={12}
          cornerWidth={2}
          className="navi_btn_frame pointer-events-none"
        />
      ) : frame === "octagonX" ? (
        <FrameOctagon
          elementRef={frmRef as React.RefObject<SVGSVGElement>}
          style={{ zIndex: 0 }}
            styled={true}
  animated= {true}
    leftTop={false}
    rightBottom={false}
    squareSize={8}
          strokeWidth={2}
          className="navi_btn_frame pointer-events-none"
        />
      ) 
      : frame === "octagon" ? (
        <FrameOctagon
          elementRef={frmRef as React.RefObject<SVGSVGElement>}
          style={{ zIndex: 0 }}
          squareSize={8}
          strokeWidth={1.2}
          className="navi_btn_frame pointer-events-none"
        />
      ) : (
        <FrameUnderline
          elementRef={frmRef as React.RefObject<SVGSVGElement>}
          style={{ zIndex: 0 }}
          squareSize={8}
          className="navi_btn_frame pointer-events-none"
        />
      )}
      <div className="navi_btn_content">{children}</div>
    </Animated>
  )
})
