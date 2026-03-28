import type { Control } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/** Shared shape for create/edit user forms (name, email, password). */
export type AccountFormValues = {
  name: string;
  email: string;
  password: string;
};

type UserAccountFormFieldsProps = {
  control: Control<AccountFormValues>;
  passwordVariant: "create" | "edit";
};

export function FormRootErrorAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function UserAccountFormFields({
  control,
  passwordVariant,
}: UserAccountFormFieldsProps) {
  const passwordLabel = passwordVariant === "create" ? "Password" : "New password";

  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input autoComplete="name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="text"
                inputMode="email"
                autoComplete="email"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{passwordLabel}</FormLabel>
            <FormControl>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={
                  passwordVariant === "edit"
                    ? "Leave blank to keep current password"
                    : undefined
                }
                {...field}
              />
            </FormControl>
            {passwordVariant === "edit" && (
              <FormDescription>
                Leave blank to keep the current password.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
