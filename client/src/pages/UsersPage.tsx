import { useQuery } from "@tanstack/react-query";
import axios, { isAxiosError } from "axios";
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

function getErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const d = e.response?.data;
    if (
      d &&
      typeof d === "object" &&
      "error" in d &&
      typeof (d as { error: unknown }).error === "string"
    ) {
      return (d as { error: string }).error;
    }
    return e.message;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong";
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function UsersPage() {
  const { data, isPending, isError, error, isSuccess } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data: body } = await axios.get<UsersResponse>("/api/users", {
        withCredentials: true,
      });
      if (!Array.isArray(body.users)) {
        throw new Error("Invalid response from server");
      }
      return body.users;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {isPending && (
        <div className="flex items-center gap-3 text-gray-600">
          <div
            className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin"
            aria-hidden
          />
          <span>Loading users…</span>
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && data.length === 0 && (
        <p className="text-gray-600">No users found.</p>
      )}

      {isSuccess && data.length > 0 && (
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
                {data.map((u) => (
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
