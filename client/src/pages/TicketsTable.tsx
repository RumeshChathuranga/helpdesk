import { Skeleton } from "@/components/ui/skeleton";
import type { TicketCategory, TicketStatus } from "core";

export type TicketListItem = {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: number;
  fromEmail: string | null;
  fromName: string | null;
  assignedToId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const SKELETON_ROWS = 6;

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: "inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800",
  IN_PROGRESS:
    "inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800",
  RESOLVED:
    "inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800",
  CLOSED:
    "inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  BILLING: "Billing",
  TECHNICAL: "Technical",
  GENERAL: "General",
  FEATURE_REQUEST: "Feature request",
  BUG: "Bug",
  OTHER: "Other",
};

function formatRequester(ticket: TicketListItem): string {
  if (ticket.fromName) return ticket.fromName;
  if (ticket.fromEmail) return ticket.fromEmail;
  return "—";
}

function TicketsTableHead() {
  return (
    <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
      <tr>
        <th scope="col" className="px-4 py-3">
          Subject
        </th>
        <th scope="col" className="px-4 py-3">
          Status
        </th>
        <th scope="col" className="px-4 py-3">
          Category
        </th>
        <th scope="col" className="px-4 py-3">
          Requester
        </th>
        <th scope="col" className="px-4 py-3">
          Created
        </th>
      </tr>
    </thead>
  );
}

type TicketsTableProps =
  | { variant: "loading" }
  | { variant: "data"; tickets: TicketListItem[] };

export function TicketsTable(props: TicketsTableProps) {
  const isLoading = props.variant === "loading";
  const tickets = props.variant === "data" ? props.tickets : [];

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
      {...(isLoading
        ? {
            role: "status" as const,
            "aria-busy": true,
            "aria-label": "Loading tickets",
          }
        : {})}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <TicketsTableHead />
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-48 max-w-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20 rounded-md" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                  </tr>
                ))
              : tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[ticket.status]}>
                        {STATUS_LABEL[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {CATEGORY_LABEL[ticket.category]}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatRequester(ticket)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {dateFormatter.format(new Date(ticket.createdAt))}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
