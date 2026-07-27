export function isEmailSourced(ticket: { fromEmail: string | null }): boolean {
  return Boolean(ticket.fromEmail);
}
