import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { ApproveReplyBody } from "core";
import { approveReply, ticketKeys } from "@/lib/tickets";
import type { TicketReply } from "@/lib/tickets";

export function useApproveReply(
  ticketId: string,
): UseMutationResult<TicketReply, Error, { replyId: string; body?: ApproveReplyBody }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ replyId, body }) => approveReply(ticketId, replyId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(ticketId),
      });
    },
  });
}
