import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import {
  DEFAULT_TICKET_LIST_SORT,
  sortingStateToTicketListSort,
  ticketListSortToSortingState,
} from "core";
import { useEffect, useMemo, useState } from "react";
import { fetchTickets, ticketKeys } from "@/lib/tickets";
import type {
  TicketCategoryFilter,
  TicketStatusFilter,
} from "@/pages/TicketFilters";

const SEARCH_DEBOUNCE_MS = 300;

export function useTickets() {
  const [sorting, setSorting] = useState<SortingState>(
    ticketListSortToSortingState(DEFAULT_TICKET_LIST_SORT),
  );
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] =
    useState<TicketCategoryFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const sort = sortingStateToTicketListSort(sorting);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(
    () => ({
      sort,
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [sort, statusFilter, categoryFilter, debouncedSearch],
  );

  const query = useQuery({
    queryKey: ticketKeys.list(listParams),
    queryFn: () => fetchTickets(listParams),
    placeholderData: keepPreviousData,
  });

  return {
    tickets: query.data ?? [],
    sorting,
    setSorting,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
