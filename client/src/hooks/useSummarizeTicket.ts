import { useQuery } from "@tanstack/react-query";
import { summarizeTicket } from "@/lib/tickets";

export function useSummarizeTicket(ticketId: string) {
  return useQuery({
    queryKey: ["ticket-summary", ticketId],
    queryFn: () => summarizeTicket(ticketId),
    enabled: false,          // don't run on mount — user triggers it
    staleTime: Infinity,     // keep the result until manually refetched
    retry: false,
  });
}
