import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { sanitizePlainText } from "core";
import type { TicketCategory, TicketStatus } from "core";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { AppLink } from "@/components/AppLink";
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

export const STATUS_BADGE: Record<TicketStatus, string> = {
  NEW: "inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-blue-400 border border-blue-500/20",
  PROCESSING:
    "inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-violet-400 border border-violet-500/20",
  OPEN: "inline-flex rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-sky-400 border border-sky-500/20",
  IN_PROGRESS:
    "inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-amber-400 border border-amber-500/20",
  RESOLVED:
    "inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-400 border border-emerald-500/20",
  CLOSED:
    "inline-flex rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-zinc-500 border border-zinc-500/20",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
  PROCESSING: "Processing",
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
    return <span className="text-muted-foreground">—</span>;
  }

  if (ticket.fromName && ticket.fromEmail) {
    return (
      <div className="min-w-0 max-w-xs font-mono text-xs">
        <div className="font-semibold text-foreground truncate">
          {sanitizePlainText(ticket.fromName)}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{ticket.fromEmail}</div>
      </div>
    );
  }

  return (
    <span className="text-foreground font-mono text-xs truncate block max-w-xs">
      {sanitizePlainText(ticket.fromName ?? ticket.fromEmail ?? "")}
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
      <AppLink to={`/tickets/${row.original.id}`} truncate>
        {sanitizePlainText(row.original.subject)}
      </AppLink>
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
      <span className="text-[10px] font-mono font-bold tracking-wider uppercase bg-secondary/80 text-muted-foreground px-2 py-1 rounded border border-border">
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
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
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
      className="rounded-xl border border-border bg-card overflow-hidden shadow-md"
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
          <thead className="bg-secondary/40 text-muted-foreground font-semibold border-b border-border/80 text-xs uppercase tracking-wider">
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
                      className="px-5 py-4"
                      aria-sort={ariaSort}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1.5 hover:text-foreground transition-colors",
                            sorted && "text-foreground font-bold",
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
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} className="bg-card">
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-48 max-w-full bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-5 w-20 rounded-md bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-24 bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-32 bg-muted/60" />
                      <Skeleton className="mt-1.5 h-3 w-40 bg-muted/60" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-40 bg-muted/60" />
                    </td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-secondary/20 transition-colors duration-150">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-4">
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
