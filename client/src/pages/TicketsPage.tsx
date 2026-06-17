import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import axios from "axios";
import {
  DEFAULT_TICKET_LIST_SORT,
  sortingStateToTicketListSort,
  ticketListSortToSortingState,
} from "core";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { TicketsTable, type TicketListItem } from "./TicketsTable";

type TicketsResponse = { tickets: TicketListItem[] };

export function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>(
    ticketListSortToSortingState(DEFAULT_TICKET_LIST_SORT),
  );
  const sort = sortingStateToTicketListSort(sorting);

  const { data, isPending, isError, error, isSuccess } = useQuery({
    queryKey: ["tickets", { sort }],
    queryFn: async () => {
      const { data: body } = await axios.get<TicketsResponse>("/api/tickets", {
        params: { sort },
        withCredentials: true,
      });
      if (!Array.isArray(body.tickets)) {
        throw new Error("Invalid response from server");
      }
      return body.tickets;
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
      </div>

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

      {isSuccess && data.length === 0 && (
        <p className="text-gray-600">No tickets found.</p>
      )}

      {isSuccess && data.length > 0 && (
        <TicketsTable
          variant="data"
          tickets={data}
          sorting={sorting}
          onSortingChange={setSorting}
        />
      )}
    </div>
  );
}
