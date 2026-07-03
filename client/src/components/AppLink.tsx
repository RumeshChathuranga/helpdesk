import { Link, type LinkProps } from "react-router";
import { cn } from "@/lib/utils";

type AppLinkProps = LinkProps & {
  truncate?: boolean;
  underline?: boolean;
};

export function AppLink({
  className,
  truncate = false,
  underline = true,
  ...props
}: AppLinkProps) {
  return (
    <Link
      className={cn(
        "font-medium text-primary hover:text-primary/80 transition-colors",
        underline && "hover:underline",
        truncate && "max-w-xs truncate block",
        className,
      )}
      {...props}
    />
  );
}

