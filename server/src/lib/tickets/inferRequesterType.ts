import type { RequesterType } from "core";

const STUDENT_EMAIL_RE = /\.\d{2}@[\w.-]*mrt\.ac\.lk$/i;
const UOM_DOMAIN_RE = /@(?:[\w-]+\.)*(?:uom\.lk|mrt\.ac\.lk)$/i;

const ADMINISTRATIVE_MAILBOXES = new Set([
  "exams",
  "registrar",
  "finance",
  "hr",
  "library",
]);

const TECHNICAL_MAILBOX_RE = /^(?:cites|lab.*|netadmin|webedit)$/i;

/**
 * Infers a requester's role from their email address. Conservative by design —
 * returns null rather than guess, since a wrong badge is worse than none.
 */
export function inferRequesterType(
  fromEmail: string | null | undefined,
): RequesterType | null {
  if (!fromEmail) return null;
  const email = fromEmail.trim().toLowerCase();

  if (STUDENT_EMAIL_RE.test(email)) return "STUDENT";
  if (!UOM_DOMAIN_RE.test(email)) return null;

  const localPart = email.slice(0, email.indexOf("@"));

  if (ADMINISTRATIVE_MAILBOXES.has(localPart)) return "ADMINISTRATIVE_STAFF";
  if (TECHNICAL_MAILBOX_RE.test(localPart)) return "TECHNICAL_STAFF";

  return "ACADEMIC_STAFF";
}
