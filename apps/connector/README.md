# Windows Tally Connector

.NET 8 prototype that makes the outbound connection to the API and talks to TallyPrime only on the local machine.

## Environment

- `TALLY_API_WS` — API WebSocket, default `ws://127.0.0.1:4000/ws/connector`
- `TALLY_URL` — local TallyPrime HTTP endpoint, default `http://127.0.0.1:9000/`
- `CONNECTOR_TOKEN` — development token; replace before any shared deployment
- `CONNECTOR_NAME` — optional connector display name

The connector persists a device ID under `%ProgramData%\TallyRemoteConnector\device-id.txt`.

The Tally probe follows TallyPrime's documented XML-over-HTTP integration model and uses an embedded TDL report to read `SVCurrentCompany`. TallyPrime must have its HTTP server enabled and a company loaded. Never expose port 9000 directly to the Internet.
