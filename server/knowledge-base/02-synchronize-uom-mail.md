# Synchronize your UoM mail with Gmail, Outlook, or Thunderbird

> Source: https://uom.lk/cites/support/synchronize-UOM-mail
> Retrieved: 2026-07-30 · Status: SOURCED (extracted from the live CITeS page — treat the URL as authoritative for anything not covered here)

### Q: How do I add my UoM email to the Gmail app?

In Gmail, open Settings, go to **Accounts and Import**, and add your UoM mail account (format `yourname@uom.lk`). Select **POP3** import with SSL encryption. Configure the outgoing (SMTP) server as `submit.uom.lk` on port **587** using TLS security. You will be asked to verify the account with a code sent to your UoM WebMail inbox at `webmail.mrt.ac.lk`. Set your reply-from address to match your UoM address so replies do not go out under the wrong sender.

### Q: How do I add my UoM email to Thunderbird?

In Thunderbird, open the **Accounts** menu and add a new mail account. Enter your name, your UoM email address, and your password. If automatic setup fails, switch to manual configuration and enter the server settings provided by CITeS. Test the connection before retrieving messages to confirm the incoming and outgoing servers are both accepted.

### Q: How do I add my UoM email to Outlook?

In Outlook, go to **Control Panel > Mail** and choose manual setup with the **POP** or **IMAP** protocol. Note: the exact steps may not match the newest version of Outlook, since Microsoft periodically changes its account-setup flow. Configure outgoing server authentication and the advanced server settings as specified by CITeS, then allow time for older messages to finish synchronizing after the account is added.
