export interface ThreadMessage {
  externalMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
}

export interface ThreadHeaders {
  inReplyTo?: string;
  references?: string[];
}

const MAX_REFERENCES = 10;

/**
 * Builds In-Reply-To / References for an outbound reply.
 *
 * `priorMessages` must be the ticket's replies created strictly before the
 * reply being sent, ordered oldest → newest (the ticket's own inbound
 * message is represented separately via `ticketExternalMessageId`).
 *
 * In-Reply-To is the last *inbound* message in the thread — the message we
 * are actually answering — falling back to the ticket's own message id if
 * there is no later inbound reply. References is the ancestor chain of that
 * message (RFC 5322: References = parent's References + parent's
 * Message-ID) — i.e. everything up to and including In-Reply-To, not later
 * sibling replies that happen to exist in the DB — deduplicated and capped
 * to the first element (thread root) plus the most recent MAX_REFERENCES - 1
 * entries so the folded header stays well under the 998-octet line limit.
 */
export function buildThreadHeaders(
  ticketExternalMessageId: string | null,
  priorMessages: ThreadMessage[],
): ThreadHeaders {
  const lastInbound = [...priorMessages]
    .reverse()
    .find((m) => m.direction === "INBOUND" && m.externalMessageId);

  const inReplyTo = lastInbound?.externalMessageId ?? ticketExternalMessageId ?? undefined;

  if (!inReplyTo) {
    return {};
  }

  const fullChain = [
    ticketExternalMessageId,
    ...priorMessages.map((m) => m.externalMessageId),
  ].filter((id): id is string => Boolean(id));

  const deduped: string[] = [];
  for (const id of fullChain) {
    if (!deduped.includes(id)) deduped.push(id);
  }

  const cutIndex = deduped.indexOf(inReplyTo);
  const chainToParent = cutIndex === -1 ? [...deduped, inReplyTo] : deduped.slice(0, cutIndex + 1);

  const references =
    chainToParent.length <= MAX_REFERENCES
      ? chainToParent
      : [chainToParent[0]!, ...chainToParent.slice(-(MAX_REFERENCES - 1))];

  return { inReplyTo, references };
}

const RE_PREFIX = /^\s*(?:re\s*(?:\[\d+\])?\s*:\s*)+/i;

/**
 * Normalises a subject to exactly one "Re: " prefix, collapsing repeated
 * "Re: Re:", "RE:", "Re[2]:" runs from earlier replies in the thread.
 */
export function buildReplySubject(subject: string): string {
  const base = subject.replace(RE_PREFIX, "").trim();
  return `Re: ${base.length > 0 ? base : "(no subject)"}`;
}
