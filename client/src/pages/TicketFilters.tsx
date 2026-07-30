import { FIELD_LIMITS } from "core";
import type { RequesterType, TicketCategory, TicketStatus } from "core";
import {
  AGENT_VISIBLE_STATUSES,
  requesterTypeSchema,
  ticketCategorySchema,
} from "core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, REQUESTER_TYPE_LABEL, STATUS_LABEL } from "./TicketsTable";

export type TicketStatusFilter = TicketStatus | "ALL";
export type TicketCategoryFilter = TicketCategory | "ALL";
export type TicketRequesterTypeFilter = RequesterType | "ALL";

const selectClassName = cn(
  "flex h-10 w-full min-w-[10rem] rounded-xl border border-input bg-card hover:bg-secondary/50 text-foreground px-3 py-2 text-sm transition-all duration-200 cursor-pointer",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);

type TicketFiltersProps = {
  search: string;
  status: TicketStatusFilter;
  category: TicketCategoryFilter;
  requesterType: TicketRequesterTypeFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: TicketStatusFilter) => void;
  onCategoryChange: (value: TicketCategoryFilter) => void;
  onRequesterTypeChange: (value: TicketRequesterTypeFilter) => void;
};

export function TicketFilters({
  search,
  status,
  category,
  requesterType,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onRequesterTypeChange,
}: TicketFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <Label htmlFor="ticket-search">Search</Label>
        <Input
          id="ticket-search"
          type="search"
          maxLength={FIELD_LIMITS.search}
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
          {AGENT_VISIBLE_STATUSES.map((value: TicketStatus) => (
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-requester-type-filter">Requester type</Label>
        <select
          id="ticket-requester-type-filter"
          className={selectClassName}
          value={requesterType}
          onChange={(event) =>
            onRequesterTypeChange(
              event.target.value as TicketRequesterTypeFilter,
            )
          }
        >
          <option value="ALL">All requester types</option>
          {requesterTypeSchema.options.map((value) => (
            <option key={value} value={value}>
              {REQUESTER_TYPE_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
