# Local run — Milestone 1

## 1. API + web

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

API: `http://127.0.0.1:4000/health`
Web: `http://127.0.0.1:3000`

The development database is PostgreSQL. Start it with Docker if Docker is available:

```bash
docker compose up -d postgres
```

Then initialize the schema:

```bash
npm run prisma:push --workspace=@tally/api
```

## 2. TallyPrime

Enable TallyPrime's HTTP server and use the configured local port (9000 by default). Keep that port local; **never port-forward Tally's HTTP port to the Internet**.

## 3. Register the Windows connector

On Windows with .NET 8 SDK, from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\connector\bootstrap.ps1
```

The bootstrap creates a persistent device ID under `%ProgramData%\TallyRemoteConnector`, registers it with the development API, and saves the returned connector credential to the current Windows user's environment. Re-running registration rotates the credential, so restart the connector after doing so.

## 4. Start the connector

Open a **new** PowerShell terminal so the saved environment variables are loaded:

```powershell
$env:TALLY_URL="http://127.0.0.1:9000/"
dotnet run --project apps/connector/TallyRemoteConnector.csproj
```

The connector makes an outbound WebSocket connection to the API, authenticates with its per-device credential, probes Tally locally, reports the active company, and waits for read requests from the dashboard.

## 5. Use the dashboard

Open `http://127.0.0.1:3000`. Select an online connector and use **Read current company**. **Read trial balance** is present as the next read path, but its Tally XML/TDL response must be verified against a real TallyPrime installation before being considered production-ready.

## Important security boundary

The current development identity uses `x-dev-user` and `x-dev-organization` headers and is deliberately disabled when `NODE_ENV=production`. It is only for local development. Before Internet deployment, replace it with real user authentication, TLS (`wss://`), short-lived/revocable connector credentials, rate limits, audit controls, and production authorization.

The connector architecture intentionally keeps Tally's local HTTP interface behind the Windows machine. Remote clients communicate with the API; they do not connect directly to Tally port 9000.
