import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { type UserListItem } from "./UsersTable";

type DeleteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
};

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
}: DeleteUserDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await axios.delete(`/api/users/${userId}`, { withCredentials: true });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onOpenChange(false);
    },
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      deleteMutation.reset();
    }
  }

  const errorMessage =
    deleteMutation.error != null
      ? getErrorMessage(deleteMutation.error)
      : null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove{" "}
            <span className="font-medium text-foreground">
              {user?.name ?? "this user"}
            </span>{" "}
            ({user?.email}) from the team. They will no longer be able to sign
            in. This action cannot be undone from the admin UI.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage != null && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending || user == null}
            onClick={() => {
              if (user == null) return;
              deleteMutation.mutate(user.id);
            }}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete user"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
