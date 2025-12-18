import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

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

export const description = "A simple bar chart with neobrutalism style"

const chartData = [
  { month: "January", visitors: 186 },
  { month: "February", visitors: 305 },
  { month: "March", visitors: 237 },
  { month: "April", visitors: 73 },
  { month: "May", visitors: 209 },
  { month: "June", visitors: 214 },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
    color: "#89b4fa", // primary
  },
} satisfies ChartConfig

export default function ChartBarSimple() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar Chart - Simple</CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid
              vertical={false}
              stroke="#000"
              strokeWidth={2}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={{ stroke: '#000', strokeWidth: 3 }}
              tick={{ fill: 'var(--color-text)', fontWeight: 600 }}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              content={<ChartTooltipContent indicator="dot" hideLabel />}
            />
            <Bar
              dataKey="visitors"
              fill="var(--color-visitors)"
              radius={0}
              stroke="#000"
              strokeWidth={2}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-sm text-sm">
        <div className="flex gap-sm items-center font-semibold" style={{ color: 'var(--color-text)' }}>
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          Showing total visitors for the last 6 months
        </div>
      </CardFooter>
    </Card>
  )
}
