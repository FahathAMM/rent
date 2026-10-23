"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-[95vw]",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  headerBorder = false,
  required = false,
  hideCloseButton = false,
  overlay = true,
  className,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* dvh (not vh) so the height cap shrinks with the on-screen keyboard
      on a real phone instead of staying pinned to the pre-keyboard height —
      vh alone can leave the footer sitting behind the keyboard. */}
      <DialogContent
        className={cn(SIZES[size] ?? size, "flex max-h-[75dvh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[85dvh]", className)}
        hideCloseButton={required || hideCloseButton}
        overlay={overlay}
        onInteractOutside={required ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={required ? (e) => e.preventDefault() : undefined}
      >
        {(title || description) && (
          <DialogHeader
            className={cn(
              "shrink-0 justify-center space-y-0.5 px-6 py-4",
              headerBorder && "border-b",
            )}
          >
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
