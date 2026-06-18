import { z } from "zod";
import { ticketCategorySchema, ticketStatusSchema } from "./ticketEnums.js";

export const ticketListSortValues = [
  "subject_asc",
  "subject_desc",
  "status_asc",
  "status_desc",
  "category_asc",
  "category_desc",
  "requester_asc",
  "requester_desc",
  "createdAt_asc",
  "createdAt_desc",
] as const;

export type TicketListSort = (typeof ticketListSortValues)[number];

export const DEFAULT_TICKET_LIST_SORT: TicketListSort = "createdAt_desc";

export const listTicketsQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.optional(),
  sort: z.enum(ticketListSortValues).optional(),
  search: z
    .string()
    .trim()
    .max(200, "Search must be at most 200 characters")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export type TicketListSortingState = { id: string; desc: boolean }[];

type SortDirection = "asc" | "desc";

const columnIdToSortField: Record<string, string> = {
  subject: "subject",
  status: "status",
  category: "category",
  requester: "requester",
  createdAt: "createdAt",
};

const sortFieldToColumnId: Record<string, string> = {
  subject: "subject",
  status: "status",
  category: "category",
  requester: "requester",
  createdAt: "createdAt",
};

function parseTicketListSort(sort: TicketListSort): {
  field: string;
  direction: SortDirection;
} {
  const direction: SortDirection = sort.endsWith("_desc") ? "desc" : "asc";
  const field = sort.slice(0, sort.lastIndexOf("_"));
  return { field, direction };
}

export function sortingStateToTicketListSort(
  sorting: TicketListSortingState,
): TicketListSort {
  const first = sorting[0];
  if (!first) {
    return DEFAULT_TICKET_LIST_SORT;
  }

  const field = columnIdToSortField[first.id] ?? "createdAt";
  const direction = first.desc ? "desc" : "asc";
  return `${field}_${direction}` as TicketListSort;
}

export function ticketListSortToSortingState(
  sort: TicketListSort,
): TicketListSortingState {
  const { field, direction } = parseTicketListSort(sort);
  const id = sortFieldToColumnId[field] ?? "createdAt";
  return [{ id, desc: direction === "desc" }];
}

type NullableSort = { sort: SortDirection; nulls: "last" };

export type TicketListOrderBy =
  | { subject: SortDirection }
  | { status: SortDirection }
  | { category: SortDirection }
  | { createdAt: SortDirection }
  | Array<{ fromName: NullableSort } | { fromEmail: NullableSort }>;

export function ticketListSortToOrderBy(sort: TicketListSort): TicketListOrderBy {
  const { field, direction } = parseTicketListSort(sort);

  switch (field) {
    case "subject":
      return { subject: direction };
    case "status":
      return { status: direction };
    case "category":
      return { category: direction };
    case "createdAt":
      return { createdAt: direction };
    case "requester":
      return [
        { fromName: { sort: direction, nulls: "last" } },
        { fromEmail: { sort: direction, nulls: "last" } },
      ];
    default:
      return { createdAt: "desc" };
  }
}
