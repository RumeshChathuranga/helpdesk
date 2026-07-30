import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useTickets } from "@/hooks/useTickets";
import { TicketFilters } from "./TicketFilters";
import { Pagination } from "@/components/Pagination";
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
    requesterTypeFilter,
    setRequesterTypeFilter,
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage, filter, and track incoming customer support requests.
        </p>
      </div>

      <TicketFilters
        search={searchInput}
        status={statusFilter}
        category={categoryFilter}
        requesterType={requesterTypeFilter}
        onSearchChange={setSearchInput}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onRequesterTypeChange={setRequesterTypeFilter}
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
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            ariaLabel="Tickets pagination"
          />
        </>
      )}
    </div>
  );
}
