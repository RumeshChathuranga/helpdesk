# Outbound email setup & testing with your own Gmail account

This app can send agent/AI replies to a customer's real inbox, and can also
*receive* their replies back into the same ticket thread. Neither path needs
a production email provider — for local testing, both directions run over a
single Gmail account using SMTP (outbound) and IMAP (inbound).

There are two independent pieces:

1. **Outbound (SMTP)** — the `send-email` background job delivers replies via
   Gmail's SMTP server. This is real, and would also work in production.
2. **Inbound (IMAP poller)** — a dev-only script (`bun run --filter server
   email:poll`) polls a mailbox and forwards new messages to the app's own
   `/api/webhooks/inbound-email` endpoint. Production inbound email normally
   arrives via a provider webhook (Postmark, SendGrid, Mailgun, etc.); the
   poller exists purely so you can exercise that same code path with a real
   inbox instead of standing up a provider account.

## 1. Create a Gmail App Password

Gmail rejects your normal account password for SMTP/IMAP. You need an **App
Password**, which requires 2-Step Verification to be enabled first.

1. Go to your [Google Account security settings](https://myaccount.google.com/security)
   and turn on **2-Step Verification** if it isn't already on.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Create a new app password (name it something like "helpdesk-dev").
4. Copy the 16-character password Google shows you. It's shown once — the
   env vars below both use it (whitespace in the copied value is fine; the
   app strips spaces before using it).

You can use one Gmail address for everything (the app *is* the "customer"
mailbox you're testing against), or two — one as the helpdesk's sending
address, one as the "customer" who receives and replies. Either works; using
two makes the thread easier to follow when you're reading both inboxes side
by side.

## 2. Configure `server/.env`

Add (or edit) these values in `server/.env` — see `server/.env.example` for
the full list with defaults:

```bash
EMAIL_DRIVER=smtp
EMAIL_FROM=your-gmail-address@gmail.com
EMAIL_FROM_NAME=Helpdesk
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASSWORD=the-16-char-app-password

# Only needed if you want to run the IMAP poller (step 4 below)
IMAP_USER=your-gmail-address@gmail.com
IMAP_PASSWORD=the-16-char-app-password
INBOUND_WEBHOOK_URL=http://localhost:3000/api/webhooks/inbound-email
INBOUND_WEBHOOK_SECRET=<same 32+ char secret already in server/.env>
ALLOW_IMAP_POLLER=true
```

`EMAIL_FROM` **must** equal `SMTP_USER` (or a verified "Send mail as" alias
in your Gmail settings) — Gmail silently rewrites the `From` header
otherwise, which breaks nothing functionally but means the email won't
appear to come from who you configured.

Everywhere except production, `EMAIL_DRIVER` defaults to `log` — replies are
composed and printed to the server console instead of actually sent. That's
the safe default for tests/CI/normal dev, and it's why you have to opt in
explicitly here.

## 3. Test outbound: send a reply to your own inbox

1. Start the app: `bun run dev` (from the repo root).
2. Create a ticket whose "from" email is a real address you can check —
   either through the UI (as if a customer submitted it) or via the seed
   webhook script:
   ```bash
   cd server
   INBOUND_WEBHOOK_SECRET=<your secret> bun scripts/send-webhook.ts
   ```
   (edit the `fromEmail` in that script to an address you control first).
3. Open the ticket in the agent UI and add a reply. The "Also email this
   reply to <address>" checkbox is checked by default whenever the ticket
   has a customer email — leave it checked and click **Send reply**.
4. Watch the server console: `[email] driver = smtp` on startup, then
   `[send-email] Reply <id> sent ✓`. Check the recipient's inbox (and spam
   folder, the first time) — the message arrives with a real `Message-ID`,
   `Subject: Re: <ticket subject>`, and a `Reply-To` pointed back at
   `EMAIL_FROM`.
5. If a ticket was auto-resolved by the AI, the draft won't send
   immediately — see the approval note below.

### AI drafts require approval before they send

Per the S6 guardrail, an AI-generated reply on an **email-sourced** ticket
(one with a `fromEmail`) is never sent automatically — the ticket is pushed
to `OPEN` with the draft attached and an **"Awaiting approval"** badge. On
the ticket detail page you can edit the draft text inline, then **Approve &
send** (queues the real email and resolves the ticket once it's delivered)
or **Discard** it. A send that fails (bad address, SMTP outage) shows a
**Retry send** button instead of silently disappearing.

## 4. Test inbound: reply from Gmail and watch it thread

This is the part that needs the poller, since there's no real inbound
webhook provider wired up in dev.

1. In a second terminal:
   ```bash
   bun run --filter server email:poll
   ```
   It logs `[imap-poller] Polling <user> (INBOX) every 15000ms → ...` and
   then polls on that interval until you `Ctrl-C` it.
2. From the Gmail web UI (or any mail client signed into the account you
   configured as `IMAP_USER`), reply to the email you received in step 3
   above — just hit Reply, write something, send it. Leave the quoted
   history in place; the app only reads the plain-text body but real mail
   clients set `In-Reply-To`/`References` regardless.
3. Within one poll interval, the terminal running `email:poll` logs
   `[imap-poller] <address> → ticket <id> (reply)`.
4. Refresh the ticket in the agent UI — the customer's reply appears in the
   thread, and it's the *same* ticket, not a new one. That's the threading
   logic in `createFromInboundEmail.ts`: it matches the incoming message's
   `In-Reply-To` (falling back to `References`) against every message
   already stored for the ticket, not just the first one — so a whole
   back-and-forth conversation stays on one ticket.
5. Processed messages are marked `\Seen` (or moved to
   `IMAP_PROCESSED_MAILBOX` if you set one) so the same message is never
   re-ingested on the next poll.

## Troubleshooting

- **`Invalid login` / `Application-specific password required`** — you're
  using your normal Gmail password. Go back to step 1 and generate an App
  Password.
- **Nothing shows up in the recipient's inbox** — check spam first. Then
  confirm `EMAIL_DRIVER=smtp` is actually set (the startup log line
  `[email] driver = ...` tells you which one is active) and that the ticket
  actually has a `fromEmail`.
- **The reply landed in the UI but as a new ticket, not appended to the
  existing one** — this only happens if the original message's `Message-ID`
  was never stored (e.g. a reply created before this feature existed).
  Anything sent after this change always carries one.
- **Poller logs a webhook rejection** — the message is left `\Seen: false`
  so it's retried on the next poll; check the logged status/body against
  `server/src/routes/webhooks/inboundEmail.ts` for why it 400'd (most likely
  a missing/invalid `From` address on the message).
- **`ALLOW_IMAP_POLLER` / `SMTP_USER` etc. FATAL on startup** — these are
  deliberate guards. The poller refuses to run at all unless
  `ALLOW_IMAP_POLLER=true` is set, and the SMTP driver refuses to construct
  without both `SMTP_USER` and `SMTP_PASSWORD` — neither should ever be
  silently skipped.

## Using a non-Gmail provider

Everything above is Gmail-specific only in the SMTP/IMAP host defaults
(`smtp.gmail.com` / `imap.gmail.com`, ports 465/993) and the App Password
requirement. Point `SMTP_HOST`/`SMTP_PORT`/`IMAP_HOST`/`IMAP_PORT` at any
other provider's servers and the rest of this guide applies unchanged.
