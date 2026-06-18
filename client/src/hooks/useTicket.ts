import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { fetchTicket, ticketKeys } from "@/lib/tickets";

export function useTicket() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? "";

  const query = useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => fetchTicket(ticketId),
    enabled: !!ticketId,
  });

  return {
    ticket: query.data,
    ticketId,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
