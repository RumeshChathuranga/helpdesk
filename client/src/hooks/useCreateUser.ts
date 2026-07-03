import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUserBody } from "core";
import { createUser, userKeys } from "@/lib/users";
import type { UserListItem } from "@/pages/UsersTable";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, Error, CreateUserBody>({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
