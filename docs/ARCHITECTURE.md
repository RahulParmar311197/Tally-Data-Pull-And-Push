# Architecture

```text
Mobile / Web
     |
     | HTTPS
     v
Cloud API <---- authenticated WebSocket ---- Windows Tally Connector
                                                |
                                                | local HTTP/XML/JSON
                                                v
                                            TallyPrime
```

The cloud layer handles authentication, authorization, connector routing and audit metadata. TallyPrime remains the accounting source of truth.

## Components

- `apps/web` — Next.js client
- `apps/api` — TypeScript API
- `apps/connector` — C#/.NET Windows connector
- `apps/mobile` — Flutter client (later milestone)
- `packages/tally-protocol` — Tally-specific protocol abstraction
- `packages/shared-types` — shared contracts
- PostgreSQL — application metadata
- Redis — optional queue/presence support

## Security

The connector makes outbound connections. Do not expose Tally's local integration port to the public Internet. Every connector is uniquely identifiable and revocable. Financial writes use prepare -> validate -> preview -> explicit confirmation -> execute -> audit.

## AI

AI is an optional adapter. It produces structured intents that the application validates. AI never receives unrestricted database access and never directly executes arbitrary Tally commands.
