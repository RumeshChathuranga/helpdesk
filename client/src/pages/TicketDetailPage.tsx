import { isAxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useTicket } from "@/hooks/useTicket";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { TicketReply } from "@/lib/tickets";
import { EditTicketForm } from "./EditTicketForm";
import { ReplyForm } from "./ReplyForm";
import {
  CATEGORY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "./TicketsTable";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function RequesterInfo({
  fromName,
  fromEmail,
}: {
  fromName: string | null;
  fromEmail: string | null;
}) {
  if (!fromName && !fromEmail) {
    return <span className="text-gray-700">—</span>;
  }

  if (fromName && fromEmail) {
    return (
      <div>
        <div className="font-medium text-gray-900">{fromName}</div>
        <div className="text-sm text-gray-500">{fromEmail}</div>
      </div>
    );
  }

  return (
    <span className="text-gray-700">{fromName ?? fromEmail}</span>
  );
}

function ReplyItem({ reply }: { reply: TicketReply }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <time dateTime={reply.createdAt}>
          {dateFormatter.format(new Date(reply.createdAt))}
        </time>
        {reply.isAi && (
          <span className="inline-flex rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
            AI
          </span>
        )}
        {reply.sentEmail && (
          <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
            Sent via email
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-gray-800">{reply.body}</p>
    </article>
  );
}

function TicketDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading ticket"
      className="lg:grid lg:grid-cols-[1fr_18rem] lg:gap-8"
    >
      <div className="space-y-6 min-w-0">
        <Skeleton className="h-8 w-96 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <aside>
        <Skeleton className="h-64 w-full rounded-xl" />
      </aside>
    </div>
  );
}

export function TicketDetailPage() {
  const { ticket, isPending, isError, error, isSuccess } = useTicket();

  const isNotFound =
    isError && isAxiosError(error) && error.response?.status === 404;

  return (
    <div>
      <div className="mb-6">
        <AppLink
          to="/tickets"
          underline={false}
          className="inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tickets
        </AppLink>
      </div>

      {isPending && <TicketDetailSkeleton />}

      {isNotFound && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Ticket not found</h1>
          <p className="text-gray-600">
            This ticket may have been deleted or the link is invalid.
          </p>
        </div>
      )}

      {isError && !isNotFound && (
        <Alert variant="destructive">
          <AlertTitle>Could not load ticket</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && ticket && (
        <div className="lg:grid lg:grid-cols-[1fr_18rem] lg:items-start lg:gap-8">
          <div className="space-y-6 min-w-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={STATUS_BADGE[ticket.status]}>
                  {STATUS_LABEL[ticket.status]}
                </span>
                <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                  {CATEGORY_LABEL[ticket.category]}
                </span>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Requester</dt>
                <dd className="mt-1">
                  <RequesterInfo
                    fromName={ticket.fromName}
                    fromEmail={ticket.fromEmail}
                  />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Assignee</dt>
                <dd className="mt-1 text-gray-900">
                  {ticket.assignedTo?.name ?? "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-gray-900 tabular-nums">
                  {dateFormatter.format(new Date(ticket.createdAt))}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Updated</dt>
                <dd className="mt-1 text-gray-900 tabular-nums">
                  {dateFormatter.format(new Date(ticket.updatedAt))}
                </dd>
              </div>
            </dl>

            {ticket.aiSummary && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                <h2 className="mb-2 text-sm font-semibold text-violet-900">
                  AI summary
                </h2>
                <p className="whitespace-pre-wrap text-sm text-violet-900/90">
                  {ticket.aiSummary}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Original message
              </h2>
              <p className="whitespace-pre-wrap text-gray-800">{ticket.body}</p>
            </div>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Replies ({ticket.replies.length})
              </h2>
              {ticket.replies.length === 0 ? (
                <p className="text-sm text-gray-500">No replies yet.</p>
              ) : (
                <div className="space-y-3">
                  {ticket.replies.map((reply) => (
                    <ReplyItem key={reply.id} reply={reply} />
                  ))}
                </div>
              )}
            </section>

            <ReplyForm ticketId={ticket.id} />
          </div>

          <aside className="mt-6 lg:mt-0 lg:sticky lg:top-6">
            <EditTicketForm ticket={ticket} />
          </aside>
        </div>
      )}
    </div>
  );
}
