import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createUserBodySchema, type CreateUserBody } from "core";
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
import { useCreateUser } from "@/hooks/useCreateUser";
import {
  FormRootErrorAlert,
  UserAccountFormFields,
} from "./UserAccountFormFields";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const form = useForm<CreateUserBody>({
    resolver: zodResolver(createUserBodySchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const createMutation = useCreateUser();

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset();
      form.clearErrors("root");
      createMutation.reset();
    }
  }

  async function onSubmit(values: CreateUserBody) {
    form.clearErrors("root");
    try {
      await createMutation.mutateAsync(values);
      onOpenChange(false);
      form.reset();
    } catch (e) {
      form.setError("root", { message: getErrorMessage(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a new agent account. They can sign in with this email and
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
              passwordVariant="create"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
