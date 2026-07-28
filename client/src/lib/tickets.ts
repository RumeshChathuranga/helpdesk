import { api } from "@/lib/api";
import type { ApproveReplyBody, CreateReplyBody, UpdateTicketBody } from "core";
import {
  DEFAULT_TICKET_PAGE_SIZE,
  type EmailDeliveryState,
  type ReplyApprovalState,
  type ReplyDirection,
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
  direction: ReplyDirection;
  approval: ReplyApprovalState;
  deliveryState: EmailDeliveryState;
  sentAt: string | null;
  deliveryError: string | null;
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
  const { data: body } = await api.get<TicketsResponse>("/tickets", {
    params: {
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
      ...(params.status ? { status: params.status } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
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
  const { data: body } = await api.get<TicketDetailResponse>(
    `/tickets/${id}`,
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
  const { data: body } = await api.post<{ reply: TicketReply }>(
    `/tickets/${ticketId}/replies`,
    data,
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

function assertValidReply(reply: unknown): asserts reply is TicketReply {
  if (
    !reply ||
    typeof (reply as { id?: unknown }).id !== "string" ||
    typeof (reply as { body?: unknown }).body !== "string"
  ) {
    throw new Error("Invalid response from server");
  }
}

export async function approveReply(
  ticketId: string,
  replyId: string,
  body?: ApproveReplyBody,
): Promise<TicketReply> {
  const { data } = await api.post<{ reply: TicketReply }>(
    `/tickets/${ticketId}/replies/${replyId}/approve`,
    body ?? {},
  );
  assertValidReply(data.reply);
  return data.reply;
}

export async function discardReply(
  ticketId: string,
  replyId: string,
): Promise<TicketReply> {
  const { data } = await api.post<{ reply: TicketReply }>(
    `/tickets/${ticketId}/replies/${replyId}/discard`,
    {},
  );
  assertValidReply(data.reply);
  return data.reply;
}

export async function retrySendReply(
  ticketId: string,
  replyId: string,
): Promise<TicketReply> {
  const { data } = await api.post<{ reply: TicketReply }>(
    `/tickets/${ticketId}/replies/${replyId}/retry-send`,
    {},
  );
  assertValidReply(data.reply);
  return data.reply;
}

export async function polishReply(
  ticketId: string,
  draft: string,
): Promise<string> {
  const { data: body } = await api.post<{ polished: string }>(
    `/tickets/${ticketId}/polish-reply`,
    { draft },
  );

  if (typeof body.polished !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.polished;
}

export async function summarizeTicket(ticketId: string): Promise<string> {
  const { data: body } = await api.post<{ summary: string }>(
    `/tickets/${ticketId}/summarize`,
    {},
  );

  if (typeof body.summary !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.summary;
}

export async function fetchAgents(): Promise<AgentListItem[]> {
  const { data: body } = await api.get<AgentsResponse>("/users/agents");

  if (!Array.isArray(body.users)) {
    throw new Error("Invalid response from server");
  }

  return body.users;
}

export async function updateTicket(
  id: string,
  data: UpdateTicketBody,
): Promise<TicketListItem> {
  const { data: body } = await api.patch<{ ticket: TicketListItem }>(
    `/tickets/${id}`,
    data,
  );

  if (!body.ticket || typeof body.ticket.id !== "string") {
    throw new Error("Invalid response from server");
  }

  return body.ticket;
}

export { DEFAULT_TICKET_PAGE_SIZE };

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>("/tickets/stats");
  return data;
}
