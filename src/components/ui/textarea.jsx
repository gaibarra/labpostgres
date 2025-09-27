import React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, value, defaultValue, ...props }, ref) => {
  // Normaliza value null/undefined a '' para evitar warning React.
  // Si se pasa defaultValue y no value (componente no controlado), lo respetamos.
  const controlled = value !== undefined;
  const safeValue = controlled ? (value ?? '') : undefined;
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      // Sólo incluimos value si es controlado para no forzar a controlled accidentalmente
      {...(controlled ? { value: safeValue } : {})}
      defaultValue={defaultValue}
      {...props}
    />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }