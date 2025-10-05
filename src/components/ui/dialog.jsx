import React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({ className, ...props }) => (
  <DialogPrimitive.Portal className={cn(className)} {...props} />
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName


const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-radix-dialog-overlay="true"
      className={cn(
        "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props} />
  );
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

let __dialogContentIdCounter = 0;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  // Detect if a DialogDescription child is present to avoid Radix warning.
  const hasDescription = React.Children.toArray(children).some(
    c => React.isValidElement(c) && c.type && (c.type.displayName === 'DialogDescription' || c.type.displayName === 'Description')
  );
  // If none, set aria-describedby to undefined string to suppress console warning while keeping a11y valid.
  const a11yProps = hasDescription ? {} : { 'aria-describedby': '' };
  const idRef = React.useRef(++__dialogContentIdCounter);
  // MutationObserver opcional (activado sólo si VITE_DIALOG_OBSERVER === 'on')
  React.useEffect(() => {
    if (import.meta.env.VITE_DIALOG_OBSERVER === 'on') {
      const target = document.body;
      if (!target) return;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList' && (m.removedNodes?.length || m.addedNodes?.length)) {
            m.removedNodes.forEach(n => {
              if (n.nodeType === 1 && n.querySelector?.('[data-dialog-content-id]')) {
                const removedIds = Array.from(n.querySelectorAll('[data-dialog-content-id]')).map(nn => nn.getAttribute('data-dialog-content-id'));
                console.debug('[DialogObserver][removed subtree]', { removedIds, time: Date.now() });
              }
            });
          }
        }
      });
      observer.observe(target, { childList: true });
      return () => observer.disconnect();
    }
  }, []);
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      // Log mount
      // Incluimos snapshot de children count para detectar cambios abruptos
      console.debug('[DialogContent][mount]', idRef.current, { hasDescription, childCount: React.Children.count(children) });
    }
    return () => {
      if (import.meta.env.DEV) {
        // En desmontaje verificamos si el nodo aún tiene parentNode (posible pista)
        try {
          const node = ref && typeof ref !== 'function' ? ref.current : null;
          console.debug('[DialogContent][unmount]', idRef.current, { attached: !!(node && node.parentNode) });
        } catch (_e) {
          console.debug('[DialogContent][unmount]', idRef.current, { attached: 'unknown-error' });
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-dialog-content-id={idRef.current}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...a11yProps}
        {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}