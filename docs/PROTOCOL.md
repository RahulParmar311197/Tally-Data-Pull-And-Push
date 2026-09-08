# Connector protocol

The connector uses an outbound WebSocket. The browser never connects to TallyPrime directly.

## Messages

Connector -> API:

- `AUTH`: `{ type, deviceId, deviceName, token }`
- `HEARTBEAT`: periodic liveness message
- `TALLY_COMPANY`: current detected company name or `null`

API -> Connector:

- `AUTH_OK`
- `HEARTBEAT_ACK`
- `ERROR`

## Safety

Authentication is required before any state-changing message is accepted. Device IDs are unique. A later connection for the same device replaces the previous socket. Production deployments must replace the development shared token with short-lived, revocable connector credentials.

Tally requests remain inside the connector. Do not put Tally XML/JSON protocol details in the web client.
