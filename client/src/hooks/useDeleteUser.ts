import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUser, userKeys } from "@/lib/users";

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
