"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Menu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative inline-block text-left", className)}
    {...props}
  />
))
Menu.displayName = "Menu"

const MenuTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { render?: React.ReactNode }
>(({ className, render, children, ...props }, ref) => {
    // Handling render prop or children
    const child = render || children;
    
    return (
        <div ref={ref} className={cn("inline-flex", className)} {...props}>
            {child}
        </div>
    );
})
MenuTrigger.displayName = "MenuTrigger"

const MenuPopup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "center" }
>(({ className, align = "start", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "absolute z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 hidden group-hover:block hover:block focus-within:block", // Simplified visibility logic
      align === "end" && "right-0",
      align === "center" && "left-1/2 -translate-x-1/2",
      align === "start" && "left-0",
      className
    )}
    {...props}
  />
))
MenuPopup.displayName = "MenuPopup"

const MenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { render?: React.ReactNode }
>(({ className, render, children, ...props }, ref) => {
    const content = render || children;
    return (
        <div
            ref={ref}
            className={cn(
            "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground",
            className
            )}
            {...props}
        >
            {content}
        </div>
    )
})
MenuItem.displayName = "MenuItem"

export { Menu, MenuTrigger, MenuPopup, MenuItem }
