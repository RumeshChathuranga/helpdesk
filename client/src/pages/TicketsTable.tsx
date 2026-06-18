import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import type { TicketCategory, TicketStatus } from "core";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  BILLING: "Billing",
  TECHNICAL: "Technical",
  GENERAL: "General",
  FEATURE_REQUEST: "Feature request",
  BUG: "Bug",
  OTHER: "Other",
};

function requesterSortValue(ticket: TicketListItem): string {
  return [ticket.fromName, ticket.fromEmail].filter(Boolean).join(" ");
}

function RequesterCell({ ticket }: { ticket: TicketListItem }) {
  if (!ticket.fromName && !ticket.fromEmail) {
    return <span className="text-gray-700">—</span>;
  }

  if (ticket.fromName && ticket.fromEmail) {
    return (
      <div className="min-w-0 max-w-xs">
        <div className="font-medium text-gray-900 truncate">{ticket.fromName}</div>
        <div className="text-xs text-gray-500 truncate">{ticket.fromEmail}</div>
      </div>
    );
  }

  return (
    <span className="text-gray-700 truncate block max-w-xs">
      {ticket.fromName ?? ticket.fromEmail}
    </span>
  );
}

function SortIndicator({
  direction,
}: {
  direction: false | "asc" | "desc";
}) {
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  return (
    <ChevronsUpDown
      className="h-3.5 w-3.5 shrink-0 opacity-40"
      aria-hidden="true"
    />
  );
}

const columns: ColumnDef<TicketListItem>[] = [
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 max-w-xs truncate block">
        {row.original.subject}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={STATUS_BADGE[row.original.status]}>
        {STATUS_LABEL[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="text-gray-700">
        {CATEGORY_LABEL[row.original.category]}
      </span>
    ),
  },
  {
    id: "requester",
    accessorFn: (row) => requesterSortValue(row),
    header: "Requester",
    cell: ({ row }) => <RequesterCell ticket={row.original} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-gray-600 tabular-nums">
        {dateFormatter.format(new Date(row.original.createdAt))}
      </span>
    ),
  },
];

type TicketsTableProps = {
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
} & (
  | { variant: "loading" }
  | { variant: "data"; tickets: TicketListItem[] }
);

export function TicketsTable(props: TicketsTableProps) {
  const isLoading = props.variant === "loading";
  const tickets = props.variant === "data" ? props.tickets : [];

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting: props.sorting },
    onSortingChange: props.onSortingChange,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

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
          <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : "none";

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-3"
                      aria-sort={ariaSort}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1.5 hover:text-gray-900",
                            sorted && "text-gray-900",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <SortIndicator direction={sorted} />
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
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
                      <Skeleton className="mt-1 h-3 w-40" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
