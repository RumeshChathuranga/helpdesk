import { useQuery } from "@tanstack/react-query";
import { fetchUsers, userKeys } from "@/lib/users";

export function useUsers() {
  const query = useQuery({
    queryKey: userKeys.all,
    queryFn: fetchUsers,
  });

  return {
    users: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
