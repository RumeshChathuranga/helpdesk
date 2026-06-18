import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useTickets } from "@/hooks/useTickets";
import { TicketFilters } from "./TicketFilters";
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
    isPending,
    isError,
    error,
    isSuccess,
  } = useTickets();

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

      {isSuccess && tickets.length > 0 && (
        <TicketsTable
          variant="data"
          tickets={tickets}
          sorting={sorting}
          onSortingChange={setSorting}
        />
      )}
    </div>
  );
}
