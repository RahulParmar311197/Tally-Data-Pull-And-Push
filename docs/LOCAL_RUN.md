# Local run — Milestone 1

## 1. API + web

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

API: `http://127.0.0.1:4000/health`
Web: `http://127.0.0.1:3000`

## 2. TallyPrime

Enable TallyPrime's HTTP server and use the configured local port (9000 by default). Keep that port local; do not port-forward it to the Internet.

## 3. Connector

On Windows with .NET 8 SDK:

```powershell
$env:TALLY_API_WS="ws://127.0.0.1:4000/ws/connector"
$env:TALLY_URL="http://127.0.0.1:9000/"
$env:CONNECTOR_TOKEN="dev-only-change-me"
dotnet run --project apps/connector/TallyRemoteConnector.csproj
```

The connector first authenticates over the outbound WebSocket, then probes Tally locally and reports the detected company back to the API.

## Important

This is a development foundation, not production authentication. The current connector token is intentionally simple. Before Internet deployment, replace it with short-lived, revocable credentials and TLS (`wss://`), persist connectors/organizations in PostgreSQL, and add authorization boundaries.
