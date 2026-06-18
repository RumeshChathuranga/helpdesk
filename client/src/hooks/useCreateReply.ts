import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { CreateReplyBody } from "core";
import { createReply, ticketKeys } from "@/lib/tickets";
import type { TicketReply } from "@/lib/tickets";

export function useCreateReply(
  ticketId: string,
): UseMutationResult<TicketReply, Error, CreateReplyBody> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReplyBody) => createReply(ticketId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(ticketId),
      });
    },
  });
}
