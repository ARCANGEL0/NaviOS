import { FrameBase } from "@/components/ui/navi_fx"

import { navi_field_1 } from "@/components/ui/frames"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative animate-pulse overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <FrameBase
        settings={navi_field_1}
        className="navi_field pointer-events-none"
      />
    </div>
  )
}

export { Skeleton }
