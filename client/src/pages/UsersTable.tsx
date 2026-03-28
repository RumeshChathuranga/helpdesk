import { Skeleton } from "@/components/ui/skeleton";

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
    <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
      <tr>
        <th scope="col" className="px-4 py-3">
          Name
        </th>
        <th scope="col" className="px-4 py-3">
          Email
        </th>
        <th scope="col" className="px-4 py-3">
          Role
        </th>
        <th scope="col" className="px-4 py-3">
          Verified
        </th>
        <th scope="col" className="px-4 py-3">
          Created
        </th>
      </tr>
    </thead>
  );
}

type UsersTableProps =
  | { variant: "loading" }
  | { variant: "data"; users: UserListItem[] };

export function UsersTable(props: UsersTableProps) {
  const isLoading = props.variant === "loading";
  const users = props.variant === "data" ? props.users : [];

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
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
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-44 max-w-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-9" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.role === "ADMIN"
                            ? "inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800"
                            : "inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.emailVerified ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {dateFormatter.format(new Date(u.createdAt))}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
