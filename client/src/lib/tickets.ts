import axios from "axios";
import type { CreateReplyBody, UpdateTicketBody } from "core";
import {
  DEFAULT_TICKET_PAGE_SIZE,
  type TicketListSort,
} from "core";
import type { TicketListItem } from "@/pages/TicketsTable";

export type TicketAssignee = {
  id: string;
  name: string;
  email: string;
};

export type TicketReply = {
  id: string;
  body: string;
  isAi: boolean;
  sentEmail: boolean;
  externalMessageId: string | null;
  createdAt: string;
};

export type TicketDetail = TicketListItem & {
  body: string;
  externalMessageId: string | null;
  aiSummary: string | null;
  assignedTo: TicketAssignee | null;
  replies: TicketReply[];
};

export type AgentListItem = {
  id: string;
  name: string;
  email: string;
};

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

export type DashboardStats = {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  aiResolvedCount: number;
  aiResolvedPct: number;
  chartData: { date: string; count: number }[];
};

export const ticketKeys = {
  all: ["tickets"] as const,
  list: (params: TicketsListParams) =>
    [...ticketKeys.all, "list", params] as const,
  detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
  agents: [...["tickets"], "agents"] as const,
  stats: [...["tickets"], "stats"] as const,
};

type TicketsResponse = TicketsListResult;
type TicketDetailResponse = { ticket: TicketDetail };
type AgentsResponse = { users: AgentListItem[] };

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

export async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data: body } = await axios.get<TicketDetailResponse>(
    `/api/tickets/${id}`,
    { withCredentials: true },
  );

  if (
    !body.ticket ||
    typeof body.ticket.id !== "string" ||
    typeof body.ticket.subject !== "string" ||
    typeof body.ticket.body !== "string" ||
    !Array.isArray(body.ticket.replies)
  ) {
    throw new Error("Invalid response from server");
  }

  return body.ticket;
}

export async function createReply(
  ticketId: string,
  data: CreateReplyBody,
): Promise<TicketReply> {
  const { data: body } = await axios.post<{ reply: TicketReply }>(
    `/api/tickets/${ticketId}/replies`,
    data,
    { withCredentials: true },
  );

  if (
    !body.reply ||
    typeof body.reply.id !== "string" ||
    typeof body.reply.body !== "string"
  ) {
    throw new Error("Invalid response from server");
  }

  return body.reply;
}

export async function polishReply(
  ticketId: string,
  draft: string,
): Promise<string> {
  const { data: body } = await axios.post<{ polished: string }>(
    `/api/tickets/${ticketId}/polish-reply`,
    { draft },
    { withCredentials: true },
  );

  if (typeof body.polished !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.polished;
}

export async function summarizeTicket(ticketId: string): Promise<string> {
  const { data: body } = await axios.post<{ summary: string }>(
    `/api/tickets/${ticketId}/summarize`,
    {},
    { withCredentials: true },
  );

  if (typeof body.summary !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.summary;
}

export async function fetchAgents(): Promise<AgentListItem[]> {
  const { data: body } = await axios.get<AgentsResponse>("/api/users/agents", {
    withCredentials: true,
  });

  if (!Array.isArray(body.users)) {
    throw new Error("Invalid response from server");
  }

  return body.users;
}

export async function updateTicket(
  id: string,
  data: UpdateTicketBody,
): Promise<TicketListItem> {
  const { data: body } = await axios.patch<{ ticket: TicketListItem }>(
    `/api/tickets/${id}`,
    data,
    { withCredentials: true },
  );

  if (!body.ticket || typeof body.ticket.id !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.ticket;
}

export { DEFAULT_TICKET_PAGE_SIZE };

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await axios.get<DashboardStats>("/api/tickets/stats", {
    withCredentials: true,
  });
  return data;
}
