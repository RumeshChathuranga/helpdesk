import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { retrySendReply, ticketKeys } from "@/lib/tickets";
import type { TicketReply } from "@/lib/tickets";

export function useRetrySendReply(
  ticketId: string,
): UseMutationResult<TicketReply, Error, { replyId: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ replyId }) => retrySendReply(ticketId, replyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(ticketId),
      });
    },
  });
}
