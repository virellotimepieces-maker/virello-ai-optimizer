"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "border border-foreground/10 bg-[color:var(--card)] text-foreground shadow-md",
        },
      }}
    />
  )
}
