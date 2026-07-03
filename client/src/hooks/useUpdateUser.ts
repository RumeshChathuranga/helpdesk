import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateUserBody } from "core";
import { updateUser, userKeys } from "@/lib/users";
import type { UserListItem } from "@/pages/UsersTable";

export type UpdateUserVariables = {
  id: string;
  data: UpdateUserBody;
};

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, Error, UpdateUserVariables>({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
