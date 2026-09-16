# Error and recovery model

## Standard error shape

All user-facing failures become an `AppError` with a stable code, category, friendly message, recoverability flag and recovery action. Categories are `NETWORK`, `SESSION`, `ROUND`, `VALIDATION`, `SOCKET`, `ASSET` and `UNKNOWN`. Technical exception messages are added only in development.

The global `ErrorStore` keeps at most three visible, deduplicated notices and a metadata-only log of the latest 20 errors. It stores no payloads, stack traces or secrets.

## Recovery rules

- GET requests receive one bounded retry only when marked retryable.
- Mutations (`start`, `reveal`, `cashout`) are never automatically retried because the server may already have committed them.
- Round conflicts and mutation timeouts trigger an authoritative session-state fetch. Local payout or reveal state is never guessed.
- An expired session clears the old session and offers a new demo session.
- Offline initialization exposes a manual Recover action.
- Missing art reports a non-blocking notice and keeps the procedural Pixi fallback.
- Pixi initialization failure enters the themed recovery UI. Unexpected React render errors are isolated by `AppErrorBoundary`.
- Restart aborts pending requests, advances a request epoch, cancels presentation work and ignores stale responses.
- WebSocket reconnect rejoins the session room and performs one authoritative REST resynchronization.

Settings survive every recovery because they live separately in `GameSettingsStore`. Sessions remain scoped to `sessionStorage`; no account or cloud persistence is introduced.

## Race safety

`ApiClient` gives every request its own `AbortController` and timeout. `GameController` captures a request epoch before awaiting a response. Restart increments that epoch before aborting, so a late response cannot mutate the new run. Controller locks prevent reveal/cashout overlap, and socket envelopes remain ordered and deduplicated.

## Development verification

The DEV drawer can simulate REST, timeout, expired-session, asset and React render failures. It also shows a bounded error log, audio lifecycle diagnostics and existing socket reconnect controls.

## Interview answers

**Why not retry mutations?** A timeout describes the client observation, not the server outcome. Repeating a committed cashout or reveal can duplicate intent; an idempotent state fetch is safer.

**How is reconnect different from retry?** Reconnect restores transport and then replaces local state with the authoritative snapshot. It does not replay commands.

**How do you avoid stale state after Restart?** Pending fetches are aborted and epoch-guarded; effects and board input are cancelled before initialization resumes.

**What reaches production users?** Stable themed messages and recovery actions. Stack traces and raw backend details stay development-only.
