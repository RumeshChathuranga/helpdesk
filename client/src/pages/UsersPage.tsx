import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { CreateUserDialog } from "./CreateUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { UsersTable, type UserListItem } from "./UsersTable";

type UsersResponse = { users: UserListItem[] };

type UsersDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; user: UserListItem }
  | { mode: "delete"; user: UserListItem };

export function UsersPage() {
  const [dialog, setDialog] = useState<UsersDialogState>({ mode: "closed" });

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts, credentials, roles, and administrative permissions.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-xl"
          onClick={() => setDialog({ mode: "create" })}
        >
          Create user
        </Button>
      </div>

      <CreateUserDialog
        open={dialog.mode === "create"}
        onOpenChange={(next) => {
          if (!next) setDialog({ mode: "closed" });
        }}
      />

      <EditUserDialog
        open={dialog.mode === "edit"}
        onOpenChange={(next) => {
          if (!next) setDialog({ mode: "closed" });
        }}
        user={dialog.mode === "edit" ? dialog.user : null}
      />

      <DeleteUserDialog
        open={dialog.mode === "delete"}
        onOpenChange={(next) => {
          if (!next) setDialog({ mode: "closed" });
        }}
        user={dialog.mode === "delete" ? dialog.user : null}
      />

      {isPending && <UsersTable variant="loading" />}

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
        <UsersTable
          variant="data"
          users={data}
          onEditUser={(u) => setDialog({ mode: "edit", user: u })}
          onDeleteUser={(u) => setDialog({ mode: "delete", user: u })}
        />
      )}
    </div>
  );
}
