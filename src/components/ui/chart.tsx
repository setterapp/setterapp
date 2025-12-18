import * as React from "react"
import * as RechartsPrimitive from "recharts"

// Chart configuration type
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
    theme?: {
      light?: string
      dark?: string
    }
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className = '', children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={`flex aspect-video justify-center text-sm ${className}`}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  {
    active?: boolean
    payload?: any[]
    label?: string
    className?: string
    indicator?: "line" | "dot" | "dashed"
    hideLabel?: boolean
    hideIndicator?: boolean
    labelFormatter?: (label: any, payload: any) => React.ReactNode
    labelClassName?: string
    formatter?: (value: any, name: any, item: any, index: number, payload: any) => React.ReactNode
    color?: string
    nameKey?: string
  }
>(
  (
    {
      active,
      payload,
      className = '',
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName = '',
      formatter,
      color,
      nameKey,
    },
    ref
  ) => {
    const { config } = useChart()

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={`neo-tooltip ${className}`}
        style={{
          background: 'var(--color-bg)',
          border: '3px solid #000',
          borderRadius: 'var(--border-radius-sm)',
          padding: 'var(--spacing-sm)',
          boxShadow: 'var(--shadow-neo)',
        }}
      >
        {!hideLabel && label && (
          <div className={`font-semibold mb-xs ${labelClassName}`}>
            {labelFormatter ? labelFormatter(label, payload) : label}
          </div>
        )}
        <div className="grid gap-xs">
          {payload.map((item: any, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = config[key as keyof typeof config]
            const indicatorColor = color || item.payload?.fill || item.color

            return (
              <div
                key={item.dataKey}
                className="flex items-center gap-sm text-sm"
              >
                {!hideIndicator && (
                  <div
                    className="neo-indicator"
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: indicator === "dot" ? '50%' : '2px',
                      backgroundColor: indicatorColor,
                      border: '2px solid #000',
                    }}
                  />
                )}
                <div className="flex flex-1 justify-between gap-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {itemConfig?.label || item.name}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {formatter ? formatter(item.value, item.name, item, index, payload) : item.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
}
