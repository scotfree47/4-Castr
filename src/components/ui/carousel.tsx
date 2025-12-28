import * as React from "react"
import * as CarouselPrimitive from "@radix-ui/react-carousel"

import { cn } from "@/lib/utils"

function Carousel({
 ...props
}: React.ComponentProps<typeof CarouselPrimitive.Root>) {
  return <CarouselPrimitive.Root data-slot="carousel" {...props} />
}

function CarouselItem({
  className,
 ...props
}: React.ComponentProps<typeof CarouselPrimitive.Item>) {
  return (
    <CarouselPrimitive.Item
      data-slot="carousel-item"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  )
}

export { Carousel, CarouselItem }
