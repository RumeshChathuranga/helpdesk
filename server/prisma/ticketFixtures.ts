import type { TicketCategory, TicketStatus } from "@prisma/client";

export type TicketFixture = {
  externalMessageId: string;
  subject: string;
  body: string;
  status: TicketStatus;
  category: TicketCategory;
  fromEmail: string;
  fromName: string | null;
  createdAt: Date;
};

const STATUSES: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const SCENARIOS: Array<{
  subject: string;
  body: string;
  category: TicketCategory;
  fromName: string;
  fromEmail: string;
}> = [
  {
    subject: "Cannot reset password",
    body: "I clicked forgot password twice but never received the reset email. Checked spam folder too.",
    category: "TECHNICAL",
    fromName: "Jane Customer",
    fromEmail: "jane.customer@gmail.com",
  },
  {
    subject: "Duplicate charge on my card",
    body: "I was charged twice for my subscription on March 12. Please refund the duplicate payment.",
    category: "BILLING",
    fromName: "Michael Torres",
    fromEmail: "m.torres@acmecorp.com",
  },
  {
    subject: "Export to CSV not working",
    body: "When I click Export on the reports page, the download starts but the file is empty.",
    category: "BUG",
    fromName: "Priya Sharma",
    fromEmail: "priya@northwind.io",
  },
  {
    subject: "Request for SSO integration",
    body: "Our security team requires SAML SSO before we can roll this out to 200 employees.",
    category: "FEATURE_REQUEST",
    fromName: "David Chen",
    fromEmail: "david.chen@enterprise.com",
  },
  {
    subject: "How do I add a team member?",
    body: "I am the account owner but cannot find where to invite colleagues to our workspace.",
    category: "GENERAL",
    fromName: "Emily Watson",
    fromEmail: "emily.w@startup.co",
  },
  {
    subject: "Invoice missing VAT number",
    body: "Our finance department needs invoices to include our VAT ID GB123456789 for compliance.",
    category: "BILLING",
    fromName: "James O'Brien",
    fromEmail: "accounts@brightline.uk",
  },
  {
    subject: "Mobile app crashes on login",
    body: "After the latest update, the iOS app closes immediately when I enter my credentials.",
    category: "BUG",
    fromName: "Sarah Kim",
    fromEmail: "sarah.kim@outlook.com",
  },
  {
    subject: "Need to cancel subscription",
    body: "Please cancel my annual plan effective immediately. Confirmation number if available.",
    category: "BILLING",
    fromName: "Robert Miller",
    fromEmail: "robert.m@gmail.com",
  },
  {
    subject: "API rate limit too low",
    body: "We hit 429 errors during nightly sync jobs. Can our limit be increased to 5000 req/hour?",
    category: "TECHNICAL",
    fromName: "Alex Rivera",
    fromEmail: "alex@datapipeline.dev",
  },
  {
    subject: "Dark mode for dashboard",
    body: "Several agents have asked for a dark theme option to reduce eye strain on night shifts.",
    category: "FEATURE_REQUEST",
    fromName: "Lisa Nguyen",
    fromEmail: "lisa.nguyen@supportdesk.com",
  },
  {
    subject: "Wrong plan applied after upgrade",
    body: "I upgraded to Pro yesterday but my account still shows the Starter plan limits.",
    category: "BILLING",
    fromName: "Chris Anderson",
    fromEmail: "c.anderson@freelance.design",
  },
  {
    subject: "Webhook deliveries failing",
    body: "Our endpoint returns 200 but the dashboard shows failed deliveries since Monday.",
    category: "TECHNICAL",
    fromName: "DevOps Team",
    fromEmail: "devops@stackflow.io",
  },
  {
    subject: "Cannot verify email address",
    body: "The verification link says expired even though I clicked it within 5 minutes.",
    category: "TECHNICAL",
    fromName: "Maria Gonzalez",
    fromEmail: "maria.g@yahoo.com",
  },
  {
    subject: "Refund for unused months",
    body: "We cancelled in January but were billed again in February. Requesting a prorated refund.",
    category: "BILLING",
    fromName: "Hannah Brooks",
    fromEmail: "hannah@brooksco.com",
  },
  {
    subject: "Search returns stale results",
    body: "Tickets created today do not appear in search until I log out and back in.",
    category: "BUG",
    fromName: "Kevin Patel",
    fromEmail: "kevin.p@helphub.io",
  },
  {
    subject: "Bulk assign tickets feature",
    body: "Would love to select multiple tickets and assign them to an agent in one action.",
    category: "FEATURE_REQUEST",
    fromName: "Rachel Green",
    fromEmail: "rachel@agencyone.com",
  },
  {
    subject: "Account locked after failed logins",
    body: "I typed the wrong password a few times and now see account locked. Need unlock ASAP.",
    category: "GENERAL",
    fromName: "Tom Hughes",
    fromEmail: "tom.hughes@company.net",
  },
  {
    subject: "Payment method update failed",
    body: "New Visa card keeps getting declined with error card_not_supported though it works elsewhere.",
    category: "BILLING",
    fromName: "Sophie Laurent",
    fromEmail: "sophie@atelier.fr",
  },
  {
    subject: "Slack integration not posting",
    body: "Connected Slack workspace but new ticket notifications stopped arriving 3 days ago.",
    category: "TECHNICAL",
    fromName: "Marcus Johnson",
    fromEmail: "marcus.j@teamwire.com",
  },
  {
    subject: "PDF attachment preview broken",
    body: "Attached PDFs show a blank preview pane in Chrome and Firefox.",
    category: "BUG",
    fromName: "Yuki Tanaka",
    fromEmail: "yuki.tanaka@corp.jp",
  },
  {
    subject: "Annual invoice copy needed",
    body: "Please send a PDF of our 2024 annual invoice for audit purposes.",
    category: "BILLING",
    fromName: "Finance Dept",
    fromEmail: "finance@globaltrade.com",
  },
  {
    subject: "Custom fields on tickets",
    body: "We need 3 custom dropdown fields per ticket for our internal SLA tracking.",
    category: "FEATURE_REQUEST",
    fromName: "Olivia Carter",
    fromEmail: "olivia@opsmanager.io",
  },
  {
    subject: "Two-factor authentication setup",
    body: "Authenticator app codes are rejected after scanning the QR code successfully.",
    category: "TECHNICAL",
    fromName: "Daniel Wright",
    fromEmail: "dan.wright@securemail.com",
  },
  {
    subject: "Spam tickets from contact form",
    body: "Getting 50+ junk submissions daily through the public form. Any CAPTCHA option?",
    category: "GENERAL",
    fromName: "Support Lead",
    fromEmail: "support@saasproduct.com",
  },
  {
    subject: "Timezone wrong on timestamps",
    body: "All ticket times show UTC but our team works in US Eastern. Can we change display timezone?",
    category: "BUG",
    fromName: "Nathan Reed",
    fromEmail: "nathan.reed@eastcoast.us",
  },
  {
    subject: "Upgrade quote for 50 seats",
    body: "Please send pricing for Enterprise with 50 agents and dedicated support.",
    category: "BILLING",
    fromName: "Victoria Stone",
    fromEmail: "v.stone@bigretail.com",
  },
  {
    subject: "Data export for GDPR request",
    body: "Customer submitted a data access request. How do we export all their ticket history?",
    category: "GENERAL",
    fromName: "Legal Team",
    fromEmail: "privacy@compliantco.eu",
  },
  {
    subject: "Keyboard shortcuts documentation",
    body: "Is there a list of keyboard shortcuts for agents? Could not find it in the help center.",
    category: "GENERAL",
    fromName: "Ben Foster",
    fromEmail: "ben.f@fasttyping.dev",
  },
  {
    subject: "Email replies not threading",
    body: "Customer replies by email create new tickets instead of adding to the existing thread.",
    category: "BUG",
    fromName: "Amanda Lee",
    fromEmail: "amanda.lee@mailroom.io",
  },
  {
    subject: "Role permissions for agents",
    body: "Need read-only role for contractors who should view but not edit tickets.",
    category: "FEATURE_REQUEST",
    fromName: "HR Operations",
    fromEmail: "hr@contractorhub.com",
  },
  {
    subject: "Slow page load on ticket list",
    body: "Tickets page takes 15+ seconds with 2000 open tickets. Any performance tips?",
    category: "TECHNICAL",
    fromName: "IT Admin",
    fromEmail: "itadmin@megacorp.org",
  },
  {
    subject: "Credit not applied to account",
    body: "Support promised a $50 credit last week but it is not visible on our billing page.",
    category: "BILLING",
    fromName: "Grace Murphy",
    fromEmail: "grace.m@smallbiz.com",
  },
  {
    subject: "MacOS desktop notifications",
    body: "Browser notifications work on Windows but not on Safari or Chrome on macOS.",
    category: "BUG",
    fromName: "Ethan Moore",
    fromEmail: "ethan.moore@appleseed.co",
  },
  {
    subject: "Merge duplicate tickets",
    body: "Same customer opened 4 tickets about one outage. Need a merge function.",
    category: "FEATURE_REQUEST",
    fromName: "Call Center",
    fromEmail: "tier1@callcenter.net",
  },
  {
    subject: "Cannot change account email",
    body: "Settings page shows email field as read-only. How do we update primary contact email?",
    category: "GENERAL",
    fromName: "Patricia Walsh",
    fromEmail: "patricia.w@newdomain.com",
  },
  {
    subject: "Webhook signature verification",
    body: "Getting invalid signature errors when validating X-Webhook-Signature header in our app.",
    category: "TECHNICAL",
    fromName: "Backend Team",
    fromEmail: "api@integrators.io",
  },
  {
    subject: "Trial extension request",
    body: "Our evaluation was delayed by holidays. Can we extend the trial by 14 days?",
    category: "BILLING",
    fromName: "Startup Founder",
    fromEmail: "founder@launchpad.studio",
  },
  {
    subject: "Canned responses not saving",
    body: "Created 10 macros yesterday but they disappeared after logging in today.",
    category: "BUG",
    fromName: "Jessica Hall",
    fromEmail: "jessica.h@customersuccess.com",
  },
  {
    subject: "HIPAA compliance documentation",
    body: "Need BAA and security whitepaper before we can store patient-related tickets.",
    category: "GENERAL",
    fromName: "Compliance Officer",
    fromEmail: "compliance@healthclinic.org",
  },
  {
    subject: "Agent workload dashboard",
    body: "Managers want a view of open ticket counts per agent for capacity planning.",
    category: "FEATURE_REQUEST",
    fromName: "Operations Manager",
    fromEmail: "ops@scaleup.io",
  },
  {
    subject: "SMTP relay configuration",
    body: "Outbound replies fail with relay access denied when using our custom mail server.",
    category: "TECHNICAL",
    fromName: "Mail Admin",
    fromEmail: "postmaster@ourdomain.com",
  },
  {
    subject: "Incorrect tax on invoice",
    body: "Invoice shows 20% VAT but we are in a tax-exempt state. Please reissue.",
    category: "BILLING",
    fromName: "Accounts Payable",
    fromEmail: "ap@stateuniversity.edu",
  },
  {
    subject: "Login page blank on mobile Safari",
    body: "Seeing white screen when opening login on iPhone 15 with iOS 17.",
    category: "BUG",
    fromName: "Mobile User",
    fromEmail: "mobile@example.com",
  },
  {
    subject: "Archive old closed tickets",
    body: "Is there bulk archive for tickets closed more than 2 years ago?",
    category: "GENERAL",
    fromName: "Records Manager",
    fromEmail: "records@archiveco.com",
  },
  {
    subject: "Satisfaction survey after resolve",
    body: "Would like CSAT survey emailed automatically when ticket status changes to resolved.",
    category: "FEATURE_REQUEST",
    fromName: "Quality Team",
    fromEmail: "qa@serviceexcellence.com",
  },
  {
    subject: "IP allowlist for API access",
    body: "Security requires restricting API keys to our office IP range 203.0.113.0/24.",
    category: "TECHNICAL",
    fromName: "Security Team",
    fromEmail: "security@lockeddown.io",
  },
  {
    subject: "PO number on invoices",
    body: "All invoices must include PO# 8842-A before our AP team can process payment.",
    category: "BILLING",
    fromName: "Procurement",
    fromEmail: "procurement@govagency.gov",
  },
  {
    subject: "Avatar upload fails",
    body: "Profile photo upload spins forever then shows generic error for PNG files under 1MB.",
    category: "BUG",
    fromName: "Ryan Cooper",
    fromEmail: "ryan.c@photographer.com",
  },
  {
    subject: "Holiday auto-reply setup",
    body: "How do we configure an auto-response for tickets received during office closure?",
    category: "GENERAL",
    fromName: "Office Manager",
    fromEmail: "office@familyclinic.com",
  },
  {
    subject: "Multi-language support",
    body: "Our customers write in Spanish and French. Any plans for multilingual UI?",
    category: "FEATURE_REQUEST",
    fromName: "International Support",
    fromEmail: "intl@globalhelp.com",
  },
];

export function buildTicketFixtures(count = 100): TicketFixture[] {
  const now = Date.now();
  const fixtures: TicketFixture[] = [];

  for (let i = 0; i < count; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length]!;
    const status = STATUSES[i % STATUSES.length]!;
    const dayOffset = i * 6 * 60 * 60 * 1000 + (i % 7) * 45 * 60 * 1000;
    const suffix = i >= SCENARIOS.length ? ` (#${i + 1})` : "";

    fixtures.push({
      externalMessageId: `seed-demo-${String(i + 1).padStart(3, "0")}`,
      subject: `${scenario.subject}${suffix}`,
      body: scenario.body,
      status,
      category: scenario.category,
      fromEmail: scenario.fromEmail,
      fromName: i % 12 === 0 ? null : scenario.fromName,
      createdAt: new Date(now - dayOffset),
    });
  }

  return fixtures;
}
