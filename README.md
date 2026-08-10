# AI-Powered Helpdesk Ticket Management System

An intelligent, full-stack support ticket management system designed to streamline customer service operations. By leveraging artificial intelligence, this platform automates the triage process, resolves common queries instantly, and assists human agents in delivering faster, more personalized support.

This project was built to demonstrate full-stack development capabilities, advanced AI integration, and production-ready system design.

## The Inspiration

The idea for this project was born out of a real-world frustration with inefficient support systems. After submitting two identical IT help tickets on behalf of friends, I noticed a glaring inconsistency: one ticket took two days to resolve, while the other took only one. Despite the drastically different wait times, the ultimate resolution and reply from the support team were exactly the same. 

This experience highlighted a clear opportunity for optimization. If an issue is common enough to have a standardized reply, why can't we automate the resolution process using a centralized knowledge base? This project is my solution to that problem—a system designed to provide instant, consistent answers for known issues while freeing up human agents to tackle unique, complex problems.

## Key Features

### AI-Powered Capabilities (Powered by GitHub Models & AI SDK)
- **Intelligent Ticket Classification:** Incoming support tickets are automatically analyzed and categorized (e.g., Billing, Technical, Bug, Feature Request) upon creation via background jobs, eliminating manual triage.
- **Hybrid Retrieval-Augmented Generation (RAG):** Knowledge base articles are split into overlapping, token-aware passages before embedding, so long documents stay fully retrievable instead of being truncated at the embedding model's context window. Each ticket is resolved by fusing two searches — `pgvector` cosine similarity (HNSW-indexed) for semantic matches and Postgres full-text search for exact terms like error codes or product names — combined by Reciprocal Rank Fusion, then expanded to neighbouring passages so the AI sees complete context rather than isolated fragments. See [`docs/knowledge-base.md`](docs/knowledge-base.md). If a clear answer is found on a ticket with no customer email, it's sent immediately; on an email-sourced ticket the draft is held for human approval before it's ever emailed out (see Outbound Email below).
- **Smart Escalation:** The AI safely detects edge cases—such as legal threats, chargebacks, out-of-policy refund requests, or complex technical issues—and immediately escalates them to human agents.
- **Agent Draft Polishing:** Agents can write quick, rough drafts, and the AI will instantly refine the text to ensure professional grammar, clarity, empathy, and consistent brand formatting.
- **Conversation Summarization:** For lengthy ticket threads, the AI generates a concise, 3-5 bullet point summary highlighting the core issue, actions taken, and next steps, providing agents with instant context.

### Core Helpdesk Features
- **Ticket Management:** Comprehensive dashboard to view, filter, sort, and manage tickets.
- **Role-Based Access Control:** Differentiated roles for Admins (user management, system configuration) and Agents (ticket handling).
- **Knowledge Base UI:** Paginated, searchable admin interface for managing knowledge documents, each showing live processing status (queued/processing/ready/failed) and passage count as the background worker chunks and embeds it.
- **Inbound Email Webhooks:** Secure webhook endpoints configured to parse raw inbound email payloads directly into structured support tickets, threading replies (including replies-to-replies) onto the correct ticket via `In-Reply-To`/`References`.
- **Outbound Email:** Agent and (approved) AI replies are delivered to the customer's inbox through a pluggable email adapter (SMTP in production, a no-op console logger everywhere else) via a `pg-boss` background job with retry and idempotent delivery. See [`docs/email-setup.md`](docs/email-setup.md) to configure it and test the full send/receive loop against your own Gmail account.
- **Background Job Processing:** Robust asynchronous job queue (using `pg-boss`) to handle AI classification, embedding generation, and auto-reply tasks reliably in the background without blocking the main API thread.
- **Split API / Worker Processes:** One image, one entrypoint, three modes via `APP_ROLE` (`all` for local dev, `api` and `worker` in containers) — so the web tier and the AI pipeline scale and fail independently. Both expose `/api/health/live` (process alive, never touches the DB) and `/api/health/ready` (accepting traffic; returns 503 while draining or when Postgres is unreachable), and both drain in-flight requests and jobs on `SIGTERM` before exiting.
- **Monorepo Architecture:** Clean codebase separation using Bun workspaces (`packages/core`) to share types and validation schemas across the client and server.

## Tech Stack

**Frontend:**
- React (TypeScript)
- Tailwind CSS
- React Router

**Backend:**
- Bun & Express (TypeScript)
- Prisma (ORM)
- pg-boss (Background Jobs & Message Queuing)

**Database:**
- PostgreSQL (with `pgvector` extension for high-performance cosine similarity searches)

**AI Integration:**
- Vercel AI SDK
- GitHub Models Inference Endpoint (utilizing the `o4-mini` model)
- Transformers.js (Local ML inference using the `Xenova/all-MiniLM-L6-v2` embedding model)

**Deployment & Tooling:**
- Bun (Package manager and runtime)
- Docker & Docker Compose (Containerization)
- Kubernetes via Helm charts (`deploy/`), with PostgreSQL managed by the CloudNativePG operator; [k3d](https://k3d.io/) for a local cluster
- GitHub Actions (CI, image build/publish to GHCR) with Trivy scanning, SPDX SBOM, and keyless Cosign signing
- Jenkins (`Jenkinsfile`) mirroring the CI stages on a self-hosted controller

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (Recommended package manager)
- PostgreSQL running locally or via Docker
- A GitHub Models Token (`GITHUB_MODELS_TOKEN`)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd helpdesk
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Environment Setup**
   Copy the example environment files and configure your variables:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
   *Make sure to add your `DATABASE_URL` and `GITHUB_MODELS_TOKEN` in `server/.env`.*
   *(The root `.env.example` is only used for the Docker Compose setup below.)*
   *Outbound email defaults to a console logger (`EMAIL_DRIVER=log`) — no extra setup needed to run the app. To send real emails and test the full reply loop against your own inbox, see [`docs/email-setup.md`](docs/email-setup.md).*

4. **Database Setup**
   Deploy the database schema and seed the initial data (including the AI agent):
   ```bash
   bun run db:migrate:deploy
   bun run db:seed
   bun run db:seed:ai
   ```

5. **Start the Development Servers**
   Run the frontend and backend concurrently:
   ```bash
   bun run dev
   ```
   The API listens on `http://localhost:3000`; Vite serves the client on `http://localhost:5173` and proxies `/api` requests to the API.

## Testing

```bash
bun run test:client   # Vitest — client unit tests
bun run test:server   # Bun test — server route tests (needs the test DB, see below)
bun run test:e2e      # Playwright end-to-end tests
```

Server and e2e tests run against a separate Postgres database. Configure `server/.env.test` (see `server/.env.test.example`), then run `bun run db:test:setup` once to apply migrations and `bun run db:test:seed` to create the fixture users (admin, agent, AI) and sample tickets before `bun run test:server` or `bun run test:e2e`.

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR: lint, typecheck, `test:client`, `test:server`
against a `pgvector/pgvector:pg15` service container, and `bun audit` (reported in full, gated at
critical). Once those pass it calls `build-image.yml`, which builds the release image and then:

- scans it with Trivy — the full report goes to the GitHub Security tab, the build fails on `CRITICAL`
- generates an SPDX SBOM
- **on a push to `master` only**, pushes to GHCR, signs the digest with keyless Cosign, and attaches
  the SBOM as an attestation

PRs build and scan but never publish, so nothing unscanned is ever pushed and nothing unpublished is
ever signed. Third-party actions are pinned by commit SHA, and the Trivy image by digest. Published
images land at `ghcr.io/rumeshchathuranga/helpdesk`, tagged `sha-<long-sha>` plus the branch name and
`latest` on `master`. The dev overlay defaults to `latest` so a fresh clone runs; pin the `sha-` tag
for anything you care about reproducing.

`Jenkinsfile` mirrors the lint/typecheck/test/build stages on a self-hosted Jenkins controller
(setup in `jenkins/`). GitHub Actions remains the real gate — Jenkins does not scan, SBOM, or sign.

## Docker Deployment

To spin up the entire stack locally using Docker Compose:

```bash
cp .env.example .env      # at minimum, set BETTER_AUTH_SECRET — compose refuses to start without it
docker compose up --build -d
```

Four services come up: `db` (pgvector), a one-shot `migrate` job, then `api` and `worker`. Migrations
are deliberately a separate service rather than part of the app's start command, so two replicas
booting together can't race each other. The app is served on `http://localhost:3000`.

## Kubernetes Deployment

For a real cluster (or a local [k3d](https://k3d.io/) cluster — config in `deploy/k3d/`) instead
of a single Docker host, Helm charts live in `deploy/`. The database is a separate release so its
lifecycle is independent of the app; migrations run automatically as a Helm hook before any app
pod starts.

```bash
# 1. CloudNativePG operator, then the database it manages
helm upgrade --install cnpg cnpg/cloudnative-pg -n cnpg-system --create-namespace --wait
helm upgrade --install helpdesk-db deploy/charts/helpdesk-db -n helpdesk --create-namespace \
  -f deploy/envs/dev/db-values.yaml --wait

# 2. App secrets (never templated into the chart — see deploy/charts/helpdesk/values.yaml)
kubectl create secret generic helpdesk-secrets -n helpdesk \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=GITHUB_MODELS_TOKEN=<your-token>

# 3. The app itself
helm upgrade --install helpdesk deploy/charts/helpdesk -n helpdesk \
  -f deploy/envs/dev/values.yaml --wait
```

The API and worker run as separate Deployments from the same image (`APP_ROLE`), pulled from
`ghcr.io/rumeshchathuranga/helpdesk` and fronted by an Ingress, with an HPA and PodDisruptionBudget
on the API and NetworkPolicies scoping each pod to only the traffic it needs. The
`/api/health/live` and `/api/health/ready` endpoints back the liveness and readiness probes, so a
pod is pulled out of the Service while it drains rather than dropping in-flight replies.

> **Status:** the charts are `helm lint` / `helm template` clean and the k3d cluster config is
> committed, but the end-to-end `helm install` on a live cluster — and the zero-dropped-requests
> check under load during a rolling restart — has not been run yet. Treat this section as the
> intended path, not a verified one.

## Observability

The app exports Prometheus metrics on a **separate port** (`METRICS_PORT`, default `9464`) rather
than a path on the API port. The Ingress routes only the API port, so `/metrics` is reachable from
inside the cluster and nowhere else — and the worker, which serves no API, still gets a scrape
target. Logs are structured JSON via pino; nothing writes to `console` except the one pre-logger
config check.

Alongside the usual RED metrics for HTTP, the interesting series are domain ones:

| Metric | Question it answers |
| --- | --- |
| `helpdesk_tickets_processed_total{outcome}` | What fraction of tickets the AI resolved without a human |
| `helpdesk_pgboss_queue_depth{queue,state}` | Is the pipeline keeping up — the correct autoscaling signal for the worker, where CPU is not |
| `helpdesk_ticket_pipeline_duration_seconds` | End-to-end latency from ticket creation, queue wait included |
| `helpdesk_stale_tickets_swept_total` | **Alerted on at any non-zero value** — the sweeper only ever touches a ticket the primary pipeline dropped |
| `helpdesk_ai_provider_errors_total{operation}` | GitHub Models degradation, split by classify/resolve/summarize/polish |
| `helpdesk_rag_retrievals_total{result}` | How often the knowledge base clears the similarity floor |

The Helm chart ships a `PodMonitor`, a `PrometheusRule` with nine alerts, and the Grafana dashboard
itself as a ConfigMap — so a metric rename and the panel that draws it change in the same commit.
Prometheus, Grafana, Alertmanager, Loki and Grafana Alloy are installed by Argo CD from
`deploy/argocd/apps/`. Setup and verification: `devops-docs/setup/kube-prometheus-stack.md`.

CI renders the chart for every environment overlay and runs `promtool check rules` over the
resulting alert expressions, so a typo'd PromQL query fails the build instead of silently never
firing.
