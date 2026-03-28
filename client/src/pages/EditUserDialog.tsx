import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { updateUserBodySchema } from "core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  type AccountFormValues,
  FormRootErrorAlert,
  UserAccountFormFields,
} from "./UserAccountFormFields";
import { type UserListItem } from "./UsersTable";

type EditUserResponse = { user: UserListItem };

type EditUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
};

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(
      updateUserBodySchema,
    ) as Resolver<AccountFormValues>,
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: "",
      });
    }
  }, [user, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      if (!user) {
        throw new Error("No user selected");
      }
      const { data } = await axios.patch<EditUserResponse>(
        `/api/users/${user.id}`,
        values,
        { withCredentials: true },
      );
      return data.user;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onOpenChange(false);
      form.reset();
    },
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset();
      form.clearErrors("root");
      updateMutation.reset();
    }
  }

  async function onSubmit(values: AccountFormValues) {
    if (!user) return;
    form.clearErrors("root");
    try {
      await updateMutation.mutateAsync(values);
    } catch (e) {
      form.setError("root", { message: getErrorMessage(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update this account. Leave the password blank to keep the current
            password.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormRootErrorAlert
              message={form.formState.errors.root?.message}
            />
            <UserAccountFormFields
              control={form.control}
              passwordVariant="edit"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !user}>
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
