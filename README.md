# Tally Data Pull And Push

A secure TallyPrime remote-access platform: mobile/web client -> cloud API -> Windows Tally Connector -> TallyPrime.

## Current goal: Milestone 1

Build the foundation first:

- Windows Tally Connector
- Cloud API
- PostgreSQL
- Web dashboard
- Secure connector registration
- WebSocket connector channel
- Tally connectivity test
- Active company detection

## Principles

- TallyPrime remains the accounting source of truth.
- Never expose Tally's local HTTP port directly to the Internet.
- Financial writes require validation, explicit confirmation, idempotency and audit logging.
- AI is optional and provider-agnostic.
- Initial development should work without paid AI or cloud services where possible.

See `docs/` and `prompts/` for the build plan.
