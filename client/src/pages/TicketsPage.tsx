import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useTickets } from "@/hooks/useTickets";
import { TicketFilters } from "./TicketFilters";
import { TicketsPagination } from "./TicketsPagination";
import { TicketsTable } from "./TicketsTable";

export function TicketsPage() {
  const {
    tickets,
    sorting,
    setSorting,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    page,
    pageSize,
    total,
    setPage,
    isPending,
    isError,
    error,
    isSuccess,
  } = useTickets();

  const showTable = isSuccess && tickets.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
      </div>

      <TicketFilters
        search={searchInput}
        status={statusFilter}
        category={categoryFilter}
        onSearchChange={setSearchInput}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
      />

      {isPending && (
        <TicketsTable
          variant="loading"
          sorting={sorting}
          onSortingChange={setSorting}
        />
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load tickets</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && tickets.length === 0 && (
        <p className="text-gray-600">No tickets found.</p>
      )}

      {showTable && (
        <>
          <TicketsTable
            variant="data"
            tickets={tickets}
            sorting={sorting}
            onSortingChange={setSorting}
          />
          <TicketsPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
