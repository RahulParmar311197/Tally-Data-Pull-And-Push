# Milestone 1 — Vibe Coding Prompt

You are the coding agent for this repository. Build Milestone 1 only.

## Goal

Create this working path:

Browser -> API -> authenticated WebSocket -> Windows Connector -> TallyPrime

The browser must be able to see connector status and the active Tally company.

## Stack

- Web: Next.js + TypeScript + Tailwind
- API: Node.js + TypeScript + Fastify or NestJS
- Database: PostgreSQL + Prisma
- Connector: C#/.NET 8+ Windows application
- Connector channel: secure WebSocket
- Local development: Docker Compose

## Requirements

1. Create a clean monorepo.
2. Implement API health endpoint.
3. Implement PostgreSQL/Prisma schema for users, organizations, connectors and Tally companies.
4. Implement basic development authentication.
5. Implement connector registration with a unique device identity.
6. Implement authenticated connector WebSocket connection.
7. Implement heartbeat and online/offline status.
8. Implement connector -> Tally connectivity test.
9. Detect the currently available Tally company using the current official TallyPrime integration documentation.
10. Display connector status and company in the web dashboard.
11. Add structured logging and request IDs.
12. Add tests for authentication, connector authorization and organization isolation.
13. Add Docker Compose for PostgreSQL and Redis if Redis is used.
14. Add `.env.example`; never commit secrets.
15. Add OpenAPI documentation.

## Tally rules

Do not invent XML/JSON formats or endpoints. Before implementing Tally communication, consult the current official TallyPrime integration documentation and isolate raw protocol handling inside the connector/Tally protocol package.

Never expose Tally's local port publicly.

## Security

- TLS in production
- short-lived credentials/tokens
- connector revocation
- organization/company authorization
- no Tally credentials in the mobile/web frontend
- no secrets in Git

## Scope boundary

Do NOT implement financial voucher writes or OpenAI integration in Milestone 1.

## Working method

Inspect the repository first. Implement in small increments. Run tests after each major component. Fix failures before moving on. Keep documentation updated.

At the end, report files changed, commands to run, tests executed, and any remaining blockers.
