import { useState } from "react";
import { AGENT_VISIBLE_STATUSES } from "core";
import type { EmailDeliveryState } from "core";
import { isAxiosError } from "axios";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApproveReply } from "@/hooks/useApproveReply";
import { useDiscardReply } from "@/hooks/useDiscardReply";
import { useRetrySendReply } from "@/hooks/useRetrySendReply";
import { useSummarizeTicket } from "@/hooks/useSummarizeTicket";
import { useTicket } from "@/hooks/useTicket";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";
import type { TicketReply } from "@/lib/tickets";
import { EditTicketForm } from "./EditTicketForm";
import { ReplyForm } from "./ReplyForm";
import {
  CATEGORY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "./TicketsTable";

const BADGE_BASE = "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border";

const DELIVERY_BADGE: Partial<Record<EmailDeliveryState, string>> = {
  QUEUED: `${BADGE_BASE} bg-slate-500/10 text-slate-400 border-slate-500/20`,
  SENDING: `${BADGE_BASE} bg-slate-500/10 text-slate-400 border-slate-500/20`,
  SENT: `${BADGE_BASE} bg-blue-500/10 text-blue-400 border-blue-500/20`,
  FAILED: `${BADGE_BASE} bg-red-500/10 text-red-400 border-red-500/20`,
};

const DELIVERY_LABEL: Partial<Record<EmailDeliveryState, string>> = {
  QUEUED: "Queued",
  SENDING: "Sending…",
  SENT: "Sent Email",
  FAILED: "Send failed",
};

const PENDING_BADGE = `${BADGE_BASE} bg-amber-500/10 text-amber-400 border-amber-500/20`;

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
    return <span className="text-muted-foreground">—</span>;
  }

  if (fromName && fromEmail) {
    return (
      <div className="font-mono text-xs">
        <div className="font-semibold text-foreground">{fromName}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{fromEmail}</div>
      </div>
    );
  }

  return (
    <span className="text-foreground font-mono text-xs">
      {fromName ?? fromEmail ?? ""}
    </span>
  );
}

function ApprovalPanel({
  ticketId,
  reply,
  customerEmail,
}: {
  ticketId: string;
  reply: TicketReply;
  customerEmail: string | null;
}) {
  const [draft, setDraft] = useState(reply.body);
  const approveMutation = useApproveReply(ticketId);
  const discardMutation = useDiscardReply(ticketId);
  const isBusy = approveMutation.isPending || discardMutation.isPending;

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <textarea
        className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-sans disabled:cursor-not-allowed disabled:opacity-50"
        value={draft}
        disabled={isBusy}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="mt-2 text-xs text-amber-300/80 font-mono">
        {customerEmail
          ? `Will be emailed to ${customerEmail}`
          : "This ticket has no customer email address."}
      </p>

      {(approveMutation.isError || discardMutation.isError) && (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400 font-mono">
          {getErrorMessage(approveMutation.error ?? discardMutation.error)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          id="approve-reply-btn"
          disabled={isBusy || !customerEmail || !draft.trim()}
          onClick={() =>
            approveMutation.mutate({
              replyId: reply.id,
              body: draft.trim() === reply.body ? undefined : { body: draft },
            })
          }
        >
          {approveMutation.isPending ? "Sending…" : "Approve & send"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          id="discard-reply-btn"
          disabled={isBusy}
          onClick={() => discardMutation.mutate({ replyId: reply.id })}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function ReplyItem({
  ticketId,
  reply,
  customerEmail,
}: {
  ticketId: string;
  reply: TicketReply;
  customerEmail: string | null;
}) {
  const retryMutation = useRetrySendReply(ticketId);
  const isPendingApproval = reply.approval === "PENDING_APPROVAL";
  const isDiscarded = reply.approval === "DISCARDED";
  const deliveryBadgeClass = DELIVERY_BADGE[reply.deliveryState];
  const deliveryLabel = DELIVERY_LABEL[reply.deliveryState];

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card/45 p-5 shadow-sm hover:border-border/80 transition-all duration-200",
        isDiscarded && "opacity-60",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
        <time dateTime={reply.createdAt}>
          {dateFormatter.format(new Date(reply.createdAt))}
        </time>
        {reply.isAi && (
          <span className="inline-flex rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400 border border-violet-500/20">
            AI Agent
          </span>
        )}
        {isPendingApproval && <span className={PENDING_BADGE}>Awaiting approval</span>}
        {isDiscarded && (
          <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
            Discarded
          </span>
        )}
        {deliveryBadgeClass && deliveryLabel && (
          <span className={deliveryBadgeClass} title={reply.deliveryError ?? undefined}>
            {deliveryLabel}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-sans">
        {reply.body}
      </p>

      {isPendingApproval && (
        <ApprovalPanel ticketId={ticketId} reply={reply} customerEmail={customerEmail} />
      )}

      {reply.deliveryState === "FAILED" && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="retry-send-btn"
            disabled={retryMutation.isPending}
            onClick={() => retryMutation.mutate({ replyId: reply.id })}
          >
            {retryMutation.isPending ? "Retrying…" : "Retry send"}
          </Button>
          {retryMutation.isError && (
            <span className="text-xs text-red-400 font-mono">
              {getErrorMessage(retryMutation.error)}
            </span>
          )}
        </div>
      )}
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
  const { ticket, ticketId, isPending, isError, error, isSuccess } = useTicket();
  const {
    data: summary,
    isFetching: isSummarizing,
    isSuccess: queryHasSummary,
    isError: hasSummaryError,
    error: summaryError,
    refetch: summarize,
  } = useSummarizeTicket(ticketId);

  const isNotFound =
    isError && isAxiosError(error) && error.response?.status === 404;

  const displaySummary = summary ?? ticket?.aiSummary ?? null;
  const hasSummary = queryHasSummary || Boolean(ticket?.aiSummary);

  const isHiddenStatus = Boolean(
    ticket && !(AGENT_VISIBLE_STATUSES as readonly string[]).includes(ticket.status),
  );

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
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Ticket not found</h1>
          <p className="text-muted-foreground text-sm">
            This ticket may have been deleted or the link is invalid.
          </p>
        </div>
      )}

      {isError && !isNotFound && (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/5">
          <AlertTitle className="text-red-400 font-mono font-semibold text-sm">Could not load ticket</AlertTitle>
          <AlertDescription className="text-red-400/90 text-xs">{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && ticket && (
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8">
          <div className="space-y-6 min-w-0">
            <div className="bg-card/30 border border-border/80 rounded-2xl p-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {ticket.subject}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className={STATUS_BADGE[ticket.status]}>
                  {STATUS_LABEL[ticket.status]}
                </span>
                <span className="inline-flex rounded-full bg-secondary text-muted-foreground px-2.5 py-0.5 text-xs font-mono font-semibold border border-border">
                  {CATEGORY_LABEL[ticket.category]}
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="mb-4 text-xs font-bold tracking-wider uppercase font-mono text-muted-foreground">
                Ticket Information
              </h2>
              <dl className="grid gap-6 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider font-mono">Requester</dt>
                  <dd className="mt-1.5">
                    <RequesterInfo
                      fromName={ticket.fromName}
                      fromEmail={ticket.fromEmail}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider font-mono">Assignee</dt>
                  <dd className="mt-1.5 text-foreground font-medium">
                    {ticket.assignedTo?.name ?? (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider font-mono">Created</dt>
                  <dd className="mt-1.5 text-muted-foreground font-mono text-xs">
                    {dateFormatter.format(new Date(ticket.createdAt))}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider font-mono">Updated</dt>
                  <dd className="mt-1.5 text-muted-foreground font-mono text-xs">
                    {dateFormatter.format(new Date(ticket.updatedAt))}
                  </dd>
                </div>
              </dl>
            </div>

            {/* AI Summary panel — shows generated or persisted summary */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase font-mono text-primary">
                  <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" aria-hidden="true" />
                  AI Summary
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  id="summarize-ticket-btn"
                  disabled={isSummarizing}
                  onClick={() => summarize()}
                  className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-200 rounded-xl"
                  title="Generate or regenerate an AI summary of this ticket and conversation"
                >
                  {isSummarizing ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Summarizing…
                    </>
                  ) : hasSummary ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Summarize
                    </>
                  )}
                </Button>
              </div>

              {hasSummaryError && (
                <p className="text-xs text-red-400 font-mono">
                  <span className="font-semibold text-red-500">Error:</span>{" "}
                  {getErrorMessage(summaryError)}
                </p>
              )}

              {isSummarizing && !displaySummary && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-primary/10" />
                  <Skeleton className="h-4 w-5/6 bg-primary/10" />
                  <Skeleton className="h-4 w-4/6 bg-primary/10" />
                </div>
              )}

              {hasSummary && displaySummary && (
                <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-sans">
                  {displaySummary}
                </p>
              )}

              {!hasSummary && !isSummarizing && !hasSummaryError && (
                <p className="text-xs text-muted-foreground/60 italic font-mono">
                  Click &ldquo;Summarize&rdquo; to generate an AI summary of this ticket and its conversation.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
              <h2 className="mb-4 text-xs font-bold tracking-wider uppercase font-mono text-foreground">
                Original message
              </h2>
              <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-sans">
                {ticket.body}
              </p>
            </div>

            <section className="space-y-4">
              <h2 className="text-xs font-bold tracking-wider uppercase font-mono text-foreground">
                Replies ({ticket.replies.length})
              </h2>
              {ticket.replies.length === 0 ? (
                <p className="text-xs text-muted-foreground italic font-mono bg-card/20 p-4 border border-border/50 rounded-xl text-center">No replies yet.</p>
              ) : (
                <div className="space-y-3">
                  {ticket.replies.map((reply) => (
                    <ReplyItem
                      key={reply.id}
                      ticketId={ticket.id}
                      reply={reply}
                      customerEmail={ticket.fromEmail}
                    />
                  ))}
                </div>
              )}
            </section>

            <ReplyForm ticketId={ticket.id} customerEmail={ticket.fromEmail} />
          </div>

          <aside className="mt-6 lg:mt-0 lg:sticky lg:top-6">
            {isHiddenStatus ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-300">
                <p className="font-semibold mb-1">Still processing</p>
                <p className="text-amber-300/80">
                  This ticket is still being processed by AI and can&rsquo;t be edited yet.
                </p>
              </div>
            ) : (
              <EditTicketForm ticket={ticket} />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
