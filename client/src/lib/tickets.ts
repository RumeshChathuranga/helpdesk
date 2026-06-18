import axios from "axios";
import type { TicketListSort } from "core";
import type { TicketListItem } from "@/pages/TicketsTable";

export type TicketsListParams = {
  sort: TicketListSort;
  status?: TicketListItem["status"];
  category?: TicketListItem["category"];
  search?: string;
};

export const ticketKeys = {
  all: ["tickets"] as const,
  list: (params: TicketsListParams) =>
    [...ticketKeys.all, "list", params] as const,
};

type TicketsResponse = { tickets: TicketListItem[] };

export async function fetchTickets(
  params: TicketsListParams,
): Promise<TicketListItem[]> {
  const { data: body } = await axios.get<TicketsResponse>("/api/tickets", {
    params: {
      sort: params.sort,
      ...(params.status ? { status: params.status } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    withCredentials: true,
  });

  if (!Array.isArray(body.tickets)) {
    throw new Error("Invalid response from server");
  }

  return body.tickets;
}
