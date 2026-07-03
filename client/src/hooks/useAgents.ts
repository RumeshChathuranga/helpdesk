import { useQuery } from "@tanstack/react-query";
import { fetchAgents, ticketKeys } from "@/lib/tickets";

export function useAgents() {
  const query = useQuery({
    queryKey: ticketKeys.agents,
    queryFn: fetchAgents,
  });

  return {
    agents: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
