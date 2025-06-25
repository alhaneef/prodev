"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface ShellProps {
  children: ReactNode
  className?: string
}

/**
 * A simple page wrapper that constrains width, centers content,
 * and provides consistent vertical spacing.
 * Feel free to extend with a header / sidebar, etc.
 */
export function Shell({ children, className }: ShellProps) {
  return <main className={cn("mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8", className)}>{children}</main>
}

/* Also export as default for flexibility */
export default Shell
