import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "#89b4fa", // primary
  },
  mobile: {
    label: "Mobile",
    color: "#40a02b", // success
  },
} satisfies ChartConfig

export default function ChartLineMultiple() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Line Chart - Multiple</CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e5e5e5"
              strokeWidth={1}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--color-text)', fontWeight: 600 }}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="desktop"
              type="monotone"
              stroke="var(--color-desktop)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-desktop)",
                stroke: "#000",
                strokeWidth: 2,
                r: 5,
              }}
              activeDot={{
                fill: "var(--color-desktop)",
                stroke: "#000",
                strokeWidth: 3,
                r: 7,
              }}
            />
            <Line
              dataKey="mobile"
              type="monotone"
              stroke="var(--color-mobile)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-mobile)",
                stroke: "#000",
                strokeWidth: 2,
                r: 5,
              }}
              activeDot={{
                fill: "var(--color-mobile)",
                stroke: "#000",
                strokeWidth: 3,
                r: 7,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-sm text-sm">
          <div className="grid gap-sm">
            <div className="flex items-center gap-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              Showing total visitors for the last 6 months
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
