import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Wraps a Radix primitive with forwarded ref + `className` merge.
 * Typed at each call site via `as typeof Primitive` (generic `ElementType` + `ElementRef` is overly strict in TS).
 */
function primitiveWithCn(
  Comp: React.ElementType & { displayName?: string },
  merge:
    | string
    | ((userClassName: string | undefined) => string | undefined),
) {
  const Wrapped = React.forwardRef(
    (
      { className, ...props }: { className?: string } & Record<string, unknown>,
      ref: React.Ref<unknown>,
    ) => {
      const merged =
        typeof merge === "string"
          ? cn(merge, className)
          : merge(className);
      return React.createElement(Comp, {
        ...props,
        ref,
        className: merged,
      } as never);
    },
  );
  Wrapped.displayName = Comp.displayName;
  return Wrapped;
}

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = primitiveWithCn(
  AlertDialogPrimitive.Overlay,
  "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
) as typeof AlertDialogPrimitive.Overlay;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = primitiveWithCn(
  AlertDialogPrimitive.Title,
  "text-lg font-semibold",
) as typeof AlertDialogPrimitive.Title;

const AlertDialogDescription = primitiveWithCn(
  AlertDialogPrimitive.Description,
  "text-sm text-muted-foreground",
) as typeof AlertDialogPrimitive.Description;

const AlertDialogAction = primitiveWithCn(
  AlertDialogPrimitive.Action,
  (className) => cn(buttonVariants(), className),
) as typeof AlertDialogPrimitive.Action;

const AlertDialogCancel = primitiveWithCn(
  AlertDialogPrimitive.Cancel,
  (className) =>
    cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
) as typeof AlertDialogPrimitive.Cancel;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
