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
 * Builds In-Reply-To / References for an outbound reply. `priorMessages` is the
 * ticket's earlier replies, oldest first.
 *
 * In-Reply-To is the last inbound message, falling back to the ticket's own id.
 * References is that message's ancestor chain (RFC 5322), capped to root plus
 * newest so the folded header stays under the 998-octet line limit.
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

/** Collapses repeated "Re: Re:", "RE:", "Re[2]:" runs to exactly one "Re: ". */
export function buildReplySubject(subject: string): string {
  const base = subject.replace(RE_PREFIX, "").trim();
  return `Re: ${base.length > 0 ? base : "(no subject)"}`;
}
