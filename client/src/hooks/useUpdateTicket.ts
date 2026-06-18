import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { UpdateTicketBody } from "core";
import { fetchAgents, ticketKeys, updateTicket } from "@/lib/tickets";
import type { TicketListItem } from "@/pages/TicketsTable";

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

export function useUpdateTicket(
  ticketId: string,
): UseMutationResult<TicketListItem, Error, UpdateTicketBody> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTicketBody) => updateTicket(ticketId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(ticketId),
      });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}
