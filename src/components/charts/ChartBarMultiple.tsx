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

export const description = "A multiple bar chart with neobrutalism style"

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

export default function ChartBarMultiple() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar Chart - Multiple</CardTitle>
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
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar
              dataKey="desktop"
              fill="var(--color-desktop)"
              radius={0}
              stroke="#000"
              strokeWidth={2}
            />
            <Bar
              dataKey="mobile"
              fill="var(--color-mobile)"
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
