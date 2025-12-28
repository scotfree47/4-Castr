"use client"
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, BarChart3 } from "lucide-react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"

const metrics = [
  {
    title: "Equity",
    value: "$54,230",
    description: "Monthly revenue",
    change: "+12%",
    trend: "up",
    icon: DollarSign,
    footer: "Trending up this month",
    subfooter: "Revenue for the last 6 months"
  },
  {
    title: "Rates",
    value: "2,350",
    description: "Total active users",
    change: "+5.2%",
    trend: "up",
    icon: Users,
    footer: "Strong user retention",
    subfooter: "Engagement exceeds targets"
  },
  {
    title: "Commodities",
    value: "1,247",
    description: "Orders this month",
    change: "-2.1%",
    trend: "down",
    icon: ShoppingCart,
    footer: "Down 2% this period",
    subfooter: "Order volume needs attention"
  },
  {
    title: "Macro",
    value: "3.24%",
    description: "Average conversion",
    change: "+8.3%",
    trend: "up",
    icon: BarChart3,
    footer: "Steady performance increase",
    subfooter: "Meets conversion projections"
  },
  {
    title: "Crypto",
    value: "10,500",
    description: "Total crypto assets",
    change: "+20%",
    trend: "up",
    icon: DollarSign,
    footer: "Growing crypto portfolio",
    subfooter: "Crypto assets on the rise"
  },
  {
    title: "Stress",
    value: "25",
    description: "System stress level",
    change: "-5%",
    trend: "down",
    icon: BarChart3,
    footer: "System stress decreasing",
    subfooter: "System performance improving"
  },
]

export function MetricsOverview() {
  const handleDotClick = (index: number, emblaApi: any) => {
    emblaApi.scrollTo(index)
  }

  const handlePrevClick = (emblaApi: any) => {
    emblaApi.prev()
  }

  const handleNextClick = (emblaApi: any) => {
    emblaApi.next()
  }

  return (
    <Carousel setApi={(emblaApi: any) => {
      return (
        <div>
          <CarouselContent>
            {metrics.map((metric) => {
              const TrendIcon = metric.trend === "up"? TrendingUp : TrendingDown
              return (
                <CarouselItem key={metric.title}>
                  <Card className="cursor-pointer">
                    <CardHeader>
                      <CardDescription>{metric.title}</CardDescription>
                      <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {metric.value}
                      </CardTitle>
                      <CardAction>
                        <Badge variant="outline">
                          <TrendIcon className="h-4 w-4" />
                          {metric.change}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                      <div className="line-clamp-1 flex gap-2 font-medium">
                        {metric.footer}
                        <TrendIcon className="size-4" />
                      </div>
                      <div className="text-muted-foreground">
                        {metric.subfooter}
                      </div>
                    </CardFooter>
                  </Card>
                </CarouselItem>
              )
            })}
          </CarouselContent>
          <div className="flex justify-center gap-4 py-4">
            {metrics.map((_, index) => (
              <button
                key={index}
                className={`h-2 w-8 rounded-lg ${index === 0? 'bg-primary' : 'bg-muted-foreground hover:bg-primary'}`}
                onClick={() => handleDotClick(index, emblaApi)}
              />
            ))}
          </div>
          <div className="flex justify-between py-4">
            <button
              className="h-12 w-12 rounded-lg bg-transparent hover:bg-muted-foreground"
              onClick={() => handlePrevClick(emblaApi)}
            />
            <button
              className="h-12 w-12 rounded-lg bg-transparent hover:bg-muted-foreground"
              onClick={() => handleNextClick(emblaApi)}
            />
          </div>
        </div>
      )
    }}
    />
  )
}
