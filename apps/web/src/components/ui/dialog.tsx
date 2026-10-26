import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Uses the same Base UI primitives as the project's shadcn components.
// The primitive owns focus trapping, Escape, outside clicks and focus restoration.
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  children,
  className,
  appearance = "default",
  placement = "center",
  showBackdrop = true,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Popup> & {
  appearance?: "default" | "game";
  placement?: "center" | "left" | "right";
  showBackdrop?: boolean;
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      {showBackdrop && (
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#10251d]/65 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      )}
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-placement={placement}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#c2b489] bg-[#f8f6ee] font-sans text-[#283e33] shadow-2xl outline-none transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          appearance === "game" && "game-dialog",
          className,
        )}
        {...props}
      >
        <div
          data-slot="dialog-body"
          className="max-h-[calc(100svh-2rem)] overflow-y-auto overscroll-contain p-6 sm:p-8"
        >
          {children}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Fermer la fenêtre"
            className="absolute top-4 right-4 z-20 grid size-10 place-items-center rounded-full bg-[#f8f6ee]/95 text-[#657363] transition-colors hover:bg-[#e8eadf] hover:text-[#203e33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#305c4a]"
          >
            <X size={19} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("pr-8 font-serif text-3xl tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("mt-3 text-sm leading-6 text-[#697664]", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
