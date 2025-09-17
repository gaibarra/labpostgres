import React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

// util mínima para combinar clases (JS puro, sin tipos)
function cx(...cls) {
  return cls.filter(Boolean).join(" ")
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right" duration={3000}>
      {toasts.map(({ id, title, description, action, ...props }) => {
        const { dismiss, className, ...restProps } = props
        return (
          <Toast
            key={id}
            {...restProps}
            // cada toast SÍ recibe clics (el viewport no)
            className={cx("pointer-events-auto", className)}
          >
            <div className="grid gap-1">
              {typeof title === "string" && <ToastTitle>{title}</ToastTitle>}
              {typeof description === "string" && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}

      {/* Viewport que NO bloquea la UI */}
      <ToastViewport
        className="
          pointer-events-none
          fixed bottom-0 right-0
          z-[60]
          flex max-h-screen
          w-full sm:w-auto
          flex-col-reverse p-4
          sm:flex-col
          md:max-w-[420px]
        "
      />
    </ToastProvider>
  )
}
