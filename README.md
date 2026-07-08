# AI-Powered Helpdesk Ticket Management System

An intelligent, full-stack support ticket management system designed to streamline customer service operations. By leveraging artificial intelligence, this platform automates the triage process, resolves common queries instantly, and assists human agents in delivering faster, more personalized support.

This project was built to demonstrate full-stack development capabilities, advanced AI integration, and production-ready system design.

## The Inspiration

The idea for this project was born out of a real-world frustration with inefficient support systems. After submitting two identical IT help tickets on behalf of friends, I noticed a glaring inconsistency: one ticket took two days to resolve, while the other took only one. Despite the drastically different wait times, the ultimate resolution and reply from the support team were exactly the same. 

This experience highlighted a clear opportunity for optimization. If an issue is common enough to have a standardized reply, why can't we automate the resolution process using a centralized knowledge base? This project is my solution to that problem—a system designed to provide instant, consistent answers for known issues while freeing up human agents to tackle unique, complex problems.

## Key Features

### AI-Powered Capabilities (Powered by GitHub Models & AI SDK)
- **Intelligent Ticket Classification:** Incoming support tickets are automatically analyzed and categorized (e.g., Billing, Technical, Bug, Feature Request) upon creation via background jobs, eliminating manual triage.
- **Retrieval-Augmented Generation (RAG):** The AI autonomously resolves tickets using a highly optimized, local RAG pipeline. Incoming tickets are converted into vector embeddings via `transformers.js` (`Xenova/all-MiniLM-L6-v2`) and semantically searched against a `pgvector` database to instantly inject the most relevant Knowledge Base context. If a clear answer is found, it sends a reply and resolves the ticket instantly.
- **Smart Escalation:** The AI safely detects edge cases—such as legal threats, chargebacks, out-of-policy refund requests, or complex technical issues—and immediately escalates them to human agents.
- **Agent Draft Polishing:** Agents can write quick, rough drafts, and the AI will instantly refine the text to ensure professional grammar, clarity, empathy, and consistent brand formatting.
- **Conversation Summarization:** For lengthy ticket threads, the AI generates a concise, 3-5 bullet point summary highlighting the core issue, actions taken, and next steps, providing agents with instant context.

### Core Helpdesk Features
- **Ticket Management:** Comprehensive dashboard to view, filter, sort, and manage tickets.
- **Role-Based Access Control:** Differentiated roles for Admins (user management, system configuration) and Agents (ticket handling).
- **Knowledge Base UI:** Dedicated admin interface to seamlessly add, manage, and delete vector-embedded Knowledge Base snippets directly from the UI.
- **Inbound Email Webhooks:** Secure webhook endpoints configured to parse raw inbound email payloads directly into structured support tickets.
- **Background Job Processing:** Robust asynchronous job queue (using `pg-boss`) to handle AI classification, embedding generation, and auto-reply tasks reliably in the background without blocking the main API thread.
- **Monorepo Architecture:** Clean codebase separation using Turborepo/npm workspaces to share types and validation schemas across the client and server.

## Tech Stack

**Frontend:**
- React (TypeScript)
- Tailwind CSS
- React Router

**Backend:**
- Node.js & Express (TypeScript)
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
   Copy the example environment file and configure your variables:
   ```bash
   cp .env.example .env
   ```
   *Make sure to add your `DATABASE_URL` and `GITHUB_MODELS_TOKEN`.*

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

## Docker Deployment

To spin up the entire stack (Database and Application) locally using Docker Compose:

```bash
docker compose up --build -d
```
