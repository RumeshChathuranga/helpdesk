import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import {
  DEFAULT_TICKET_LIST_SORT,
  sortingStateToTicketListSort,
  ticketListSortToSortingState,
} from "core";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TICKET_PAGE_SIZE,
  fetchTickets,
  ticketKeys,
} from "@/lib/tickets";
import type {
  TicketCategoryFilter,
  TicketRequesterTypeFilter,
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
  const [requesterTypeFilter, setRequesterTypeFilter] =
    useState<TicketRequesterTypeFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const sort = sortingStateToTicketListSort(sorting);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [sort, statusFilter, categoryFilter, requesterTypeFilter, debouncedSearch]);

  const listParams = useMemo(
    () => ({
      sort,
      page,
      pageSize: DEFAULT_TICKET_PAGE_SIZE,
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
      ...(requesterTypeFilter !== "ALL"
        ? { requesterType: requesterTypeFilter }
        : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [sort, page, statusFilter, categoryFilter, requesterTypeFilter, debouncedSearch],
  );

  const query = useQuery({
    queryKey: ticketKeys.list(listParams),
    queryFn: () => fetchTickets(listParams),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? DEFAULT_TICKET_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    tickets: query.data?.tickets ?? [],
    sorting,
    setSorting,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    requesterTypeFilter,
    setRequesterTypeFilter,
    page: query.data?.page ?? page,
    pageSize,
    total,
    totalPages,
    setPage,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
