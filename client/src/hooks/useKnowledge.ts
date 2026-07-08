import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchKnowledge,
  addKnowledge,
  deleteKnowledge,
  knowledgeKeys,
} from "../lib/knowledge";

export function useKnowledge() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: knowledgeKeys.all,
    queryFn: fetchKnowledge,
  });

  const addMutation = useMutation({
    mutationFn: (text: string) => addKnowledge(text),
    onSuccess: () => {
      // Note: Processing happens asynchronously on the backend.
      // Invalidation might not immediately show the new item, 
      // but we do it anyway for completeness.
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });

  return {
    chunks: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
    addKnowledge: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    deleteKnowledge: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
