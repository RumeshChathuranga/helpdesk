import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2 } from "lucide-react";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  emailVerified: boolean;
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const SKELETON_ROWS = 6;

function UsersTableHead() {
  return (
    <thead className="bg-secondary/40 text-muted-foreground font-semibold border-b border-border/80 text-xs uppercase tracking-wider">
      <tr>
        <th scope="col" className="px-5 py-4">
          Name
        </th>
        <th scope="col" className="px-5 py-4">
          Email
        </th>
        <th scope="col" className="px-5 py-4">
          Role
        </th>
        <th scope="col" className="px-5 py-4">
          Verified
        </th>
        <th scope="col" className="px-5 py-4">
          Created
        </th>
        <th scope="col" className="px-5 py-4 w-[1%]">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

type UsersTableProps =
  | { variant: "loading" }
  | {
      variant: "data";
      users: UserListItem[];
      onEditUser?: (user: UserListItem) => void;
      onDeleteUser?: (user: UserListItem) => void;
    };

export function UsersTable(props: UsersTableProps) {
  const isLoading = props.variant === "loading";
  const users = props.variant === "data" ? props.users : [];
  const onEditUser = props.variant === "data" ? props.onEditUser : undefined;
  const onDeleteUser =
    props.variant === "data" ? props.onDeleteUser : undefined;

  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden shadow-md"
      {...(isLoading
        ? {
            role: "status" as const,
            "aria-busy": true,
            "aria-label": "Loading users",
          }
        : {})}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <UsersTableHead />
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} className="bg-card">
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-28 bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-44 max-w-full bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-5 w-16 rounded-md bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-9 bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-40 bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-8 w-8 rounded-md mx-auto bg-muted/60" />
                    </td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/20 transition-colors duration-150">
                    <td className="px-5 py-4 font-semibold text-foreground font-mono text-xs">
                      {u.name}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          u.role === "ADMIN"
                            ? "inline-flex rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-blue-400 border border-blue-500/20"
                            : "inline-flex rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-zinc-500 border border-zinc-500/20"
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs">
                      {u.emailVerified ? "Yes" : "No"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs tabular-nums">
                      {dateFormatter.format(new Date(u.createdAt))}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        {onEditUser && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all"
                            aria-label={`Edit user ${u.name}`}
                            onClick={() => onEditUser(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDeleteUser && u.role !== "ADMIN" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                            aria-label={`Delete user ${u.name}`}
                            onClick={() => onDeleteUser(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

