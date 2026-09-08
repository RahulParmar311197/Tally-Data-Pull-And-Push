# Security baseline

1. TallyPrime's local integration port must never be published directly to the Internet.
2. The Windows connector makes outbound connections to the API.
3. Production connector authentication must use short-lived credentials or a revocable device credential; the shared development token is not production authentication.
4. Every API request must resolve an authenticated user and organization before accessing connector/company records.
5. Financial writes are out of scope for Milestone 1 and must later follow prepare -> validate -> preview -> explicit confirmation -> execute -> audit.
6. Never put Tally credentials, API secrets, or production tokens in Git.
7. Treat connector-reported company data as untrusted input and validate it before persistence.
8. Unknown outcomes for financial operations must not be blindly retried.
