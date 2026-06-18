import type { TicketCategory, TicketStatus } from "core";
import { ticketCategorySchema, ticketStatusSchema } from "core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, STATUS_LABEL } from "./TicketsTable";

export type TicketStatusFilter = TicketStatus | "ALL";
export type TicketCategoryFilter = TicketCategory | "ALL";

const selectClassName = cn(
  "flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);

type TicketFiltersProps = {
  search: string;
  status: TicketStatusFilter;
  category: TicketCategoryFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: TicketStatusFilter) => void;
  onCategoryChange: (value: TicketCategoryFilter) => void;
};

export function TicketFilters({
  search,
  status,
  category,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
}: TicketFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <Label htmlFor="ticket-search">Search</Label>
        <Input
          id="ticket-search"
          type="search"
          placeholder="Search subject, body, or requester"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-status-filter">Status</Label>
        <select
          id="ticket-status-filter"
          className={selectClassName}
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as TicketStatusFilter)
          }
        >
          <option value="ALL">All statuses</option>
          {ticketStatusSchema.options.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-category-filter">Category</Label>
        <select
          id="ticket-category-filter"
          className={selectClassName}
          value={category}
          onChange={(event) =>
            onCategoryChange(event.target.value as TicketCategoryFilter)
          }
        >
          <option value="ALL">All categories</option>
          {ticketCategorySchema.options.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
