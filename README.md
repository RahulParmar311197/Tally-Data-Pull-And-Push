# Tally Data Pull And Push

A secure TallyPrime remote-access platform: mobile/web client -> API -> Windows Tally Connector -> TallyPrime.

## Current goal: Milestone 1

Build the foundation first:

- Windows Tally Connector
- API
- PostgreSQL
- Web dashboard
- Secure connector registration
- WebSocket connector channel
- Tally connectivity test
- Active company detection
- Read-only Trial Balance export

## Principles

- TallyPrime remains the accounting source of truth.
- Never expose Tally's local HTTP port directly to the Internet.
- Financial writes require validation, explicit confirmation, idempotency and audit logging.
- AI is optional and provider-agnostic.
- Initial development should work without paid AI or cloud services where possible.

## Local end-to-end setup

### 1. Start PostgreSQL and Redis

From the repository root:

```bash
docker compose up -d
```

### 2. Install and configure the API

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run prisma:push --workspace=@tally/api
```

The development API defaults to `http://127.0.0.1:4000`.

Start it with:

```bash
npm run dev:api
```

### 3. Start the web dashboard

In another terminal:

```bash
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

Open `http://localhost:3000`.

### 4. Configure TallyPrime on the Windows machine

Enable TallyPrime's HTTP server/integration service on its local port (normally `9000`) and keep it bound to the local machine/network only. Do **not** port-forward or expose port 9000 to the public Internet.

The connector defaults to:

```text
TALLY_URL=http://127.0.0.1:9000/
```

The connector uses Tally's XML-over-HTTP integration. Trial Balance uses Tally's native `Trial Balance` report export with XML format.

### 5. Build the Windows connector

On Windows with .NET 8 SDK:

```powershell
dotnet build apps/connector/TallyRemoteConnector.csproj
```

### 6. Register the Windows connector

From PowerShell on the same Windows machine, while the API is running:

```powershell
.\apps\connector\bootstrap.ps1
```

This creates a persistent device ID and stores the connector credential in the current Windows user's environment. It also configures the API WebSocket URL.

If the API is on another reachable machine, pass its base URL:

```powershell
.\apps\connector\bootstrap.ps1 -ApiBase "http://YOUR_API_HOST:4000"
```

For Internet deployment the API endpoint should be HTTPS and the connector should use WSS; never expose Tally port 9000.

### 7. Run the connector

Start a new PowerShell window so the saved environment variables are available:

```powershell
dotnet run --project apps/connector/TallyRemoteConnector.csproj
```

Expected flow:

```text
Windows Connector
      |
      | authenticated WebSocket
      v
     API
      |
      | local HTTP/XML
      v
 TallyPrime :9000
```

The connector automatically reconnects after API/network failures and periodically reports heartbeats. It also reports the active Tally company when it connects.

### 8. Use the dashboard

Refresh the dashboard. The registered connector should appear as Online when the connector WebSocket is connected.

Use:

- **Read current company** to verify company detection.
- **Read trial balance** to request the native Tally Trial Balance report through the connector.

If the connector is offline, reads fail safely instead of attempting to contact Tally from the web application.

## Development validation

GitHub Actions validates the Node API, Prisma schema, API tests, and .NET connector build on pushes to `main`.

Runtime validation against a real TallyPrime installation still requires a Windows machine running TallyPrime; CI cannot provide that external accounting system.

## Remote Internet architecture

The production direction is:

```text
Mobile / Web
     |
   HTTPS
     |
     v
 Public API / relay
     ^
     |
 authenticated WSS (outbound)
     |
 Windows Tally Connector
     |
 localhost:9000
     v
 TallyPrime
```

The Windows connector makes the outbound connection. This means the Tally machine does not need an inbound public port. A free/local tunnel or VPN can be used during development; paid cloud infrastructure is not required to continue building the core application.

## Next implementation stages

1. Runtime-test current-company and Trial Balance against a real TallyPrime installation.
2. Add stronger API integration tests for connector authentication, organization isolation, registration conflicts, reconnects, and read timeouts.
3. Add ledger/master read operations.
4. Add the mobile client.
5. Add audited, idempotent financial writes only after read flows are stable.
6. Add optional local AI tooling first; keep OpenAI/provider integration behind an abstraction.

See `docs/` and `prompts/` for the build plan.
