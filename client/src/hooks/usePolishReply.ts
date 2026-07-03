import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { polishReply } from "@/lib/tickets";

export function usePolishReply(
  ticketId: string,
): UseMutationResult<string, Error, string> {
  return useMutation({
    mutationFn: (draft: string) => polishReply(ticketId, draft),
  });
}
