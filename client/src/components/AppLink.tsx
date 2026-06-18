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
        "font-medium hover:text-brand-800",
        underline && "hover:underline",
        truncate && "max-w-xs truncate block",
        className,
      )}
      {...props}
    />
  );
}
