import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, style, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={className}
    ref={ref}
    style={{
      width: '52px',
      height: '28px',
      backgroundColor: 'transparent',
      border: '2px solid #000',
      borderRadius: '28px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '2px 2px 0px 0px #000',
      ...style,
    }}
    {...props}
  >
    <SwitchPrimitives.Thumb
      style={{
        display: 'block',
        width: '22px',
        height: '22px',
        backgroundColor: '#000',
        borderRadius: '50%',
        transition: 'transform 0.2s ease',
        willChange: 'transform',
      }}
      data-state={props.checked ? 'checked' : 'unchecked'}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
