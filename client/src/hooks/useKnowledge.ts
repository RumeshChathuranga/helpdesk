import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { DEFAULT_KNOWLEDGE_PAGE_SIZE, type CreateKnowledgeBody } from "core";
import { useEffect, useMemo, useState } from "react";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchKnowledgeDocuments,
  knowledgeKeys,
} from "@/lib/knowledge";

const SEARCH_DEBOUNCE_MS = 300;

/** How often to re-check while the embed worker is still chunking a document. */
const PROCESSING_POLL_MS = 3000;

export function useKnowledge() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_KNOWLEDGE_PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, debouncedSearch],
  );

  const query = useQuery({
    queryKey: knowledgeKeys.list(listParams),
    queryFn: () => fetchKnowledgeDocuments(listParams),
    placeholderData: keepPreviousData,
    // Chunking and embedding happen in a background job, so poll while anything
    // on this page is still in flight — and only then.
    refetchInterval: (query) =>
      query.state.data?.documents.some(
        (doc) => doc.status === "PENDING" || doc.status === "PROCESSING",
      )
        ? PROCESSING_POLL_MS
        : false,
  });

  const addMutation = useMutation({
    mutationFn: (values: CreateKnowledgeBody) => createKnowledgeDocument(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledgeDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });

  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? DEFAULT_KNOWLEDGE_PAGE_SIZE;

  return {
    documents: query.data?.documents ?? [],
    searchInput,
    setSearchInput,
    page: query.data?.page ?? page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    setPage,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
    addKnowledge: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    deleteKnowledge: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
