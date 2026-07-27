import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { discardReply, ticketKeys } from "@/lib/tickets";
import type { TicketReply } from "@/lib/tickets";

export function useDiscardReply(
  ticketId: string,
): UseMutationResult<TicketReply, Error, { replyId: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ replyId }) => discardReply(ticketId, replyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(ticketId),
      });
    },
  });
}
