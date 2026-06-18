import axios from "axios";
import { DEFAULT_TICKET_PAGE_SIZE, type TicketListSort } from "core";
import type { TicketListItem } from "@/pages/TicketsTable";

export type TicketsListParams = {
  sort: TicketListSort;
  page: number;
  pageSize: number;
  status?: TicketListItem["status"];
  category?: TicketListItem["category"];
  search?: string;
};

export type TicketsListResult = {
  tickets: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export const ticketKeys = {
  all: ["tickets"] as const,
  list: (params: TicketsListParams) =>
    [...ticketKeys.all, "list", params] as const,
};

type TicketsResponse = TicketsListResult;

export async function fetchTickets(
  params: TicketsListParams,
): Promise<TicketsListResult> {
  const { data: body } = await axios.get<TicketsResponse>("/api/tickets", {
    params: {
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
      ...(params.status ? { status: params.status } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    withCredentials: true,
  });

  if (
    !Array.isArray(body.tickets) ||
    typeof body.total !== "number" ||
    typeof body.page !== "number" ||
    typeof body.pageSize !== "number"
  ) {
    throw new Error("Invalid response from server");
  }

  return body;
}

export { DEFAULT_TICKET_PAGE_SIZE };
