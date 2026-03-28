import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  emailVerified: boolean;
  createdAt: string;
};

type UsersResponse = { users: UserListItem[] };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function UsersPage() {
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/users", { credentials: "include" });
        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        if (
          !data ||
          typeof data !== "object" ||
          !("users" in data) ||
          !Array.isArray((data as UsersResponse).users)
        ) {
          throw new Error("Invalid response from server");
        }

        if (!cancelled) {
          setUsers((data as UsersResponse).users);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
          setUsers(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {loading && (
        <div className="flex items-center gap-3 text-gray-600">
          <div
            className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin"
            aria-hidden
          />
          <span>Loading users…</span>
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && users && users.length === 0 && (
        <p className="text-gray-600">No users found.</p>
      )}

      {!loading && !error && users && users.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
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
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
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
      )}
    </div>
  );
}
