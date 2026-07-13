# opencode-session-correlation

Local OpenCode plugin that injects a stable UUID correlation header for configured providers, so a gateway can group multiple requests from the same OpenCode session.

## What it does

- Hooks into OpenCode's `chat.headers` event.
- For configured provider IDs only, adds a UUID header derived from the native OpenCode session ID.
- Persists the native-session-to-UUID mapping locally so the same OpenCode session always sends the same UUID.
- Does nothing for providers that are not in the configured list.

## What it does not do

- It does not change request bodies, models, endpoints, or authentication.
- It does not add client-identity headers such as `User-Agent` or `x-app`.
- It does not send end-user metadata or log prompts, secrets, or request bodies.
- It does not guarantee that a gateway displays or uses the header. Whether a gateway maps this header into a "Session ID" field depends entirely on that gateway's own request parsing.

## Configuration

Add to `opencode.json`:

```json
{
  "plugin": [
    [
      "/absolute/path/to/opencode-session-correlation",
      {
        "providers": ["ryanair-gateway"],
        "header": "x-claude-code-session-id"
      }
    ]
  ]
}
```

- `providers` (required): non-empty array of provider IDs from your OpenCode config. The header is only added for these providers.
- `header` (optional): header name to inject. Defaults to `x-claude-code-session-id`.
- `storagePath` (optional, advanced): override the local mapping file. Defaults to `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/session-correlation.json`.
- `collapseToRootSession` (optional, default `false`): when `true`, subagent/task sessions (which OpenCode creates as child sessions with a `parentID`) resolve up to their root session and share that root's UUID, instead of each getting its own UUID. When `false` (default), every OpenCode session — including subagent sessions — gets its own distinct UUID.

### Choosing `collapseToRootSession`

OpenCode's `task` tool creates a new session for every subagent dispatch, chained via `parentID` back to the session that spawned it. With `collapseToRootSession: false` (default), a single multi-agent run (for example `/full-loop-report` dispatching several subagents) shows up as many separate sessions to your gateway. With `collapseToRootSession: true`, the whole run shows up as one session.

Before enabling this, check whether your gateway enforces any per-session rate or budget limits (for example LiteLLM's `max_iterations` / `max_budget_per_session`, which are scoped to a session identifier). If such a limit exists, collapsing many subagent calls into one session ID could trip it sooner than the default per-session behavior would. This plugin does not affect Anthropic prompt caching either way — caching is based on request content (`cache_control` breakpoints), not on this header.

## Local storage format

```json
{
  "version": 1,
  "sessions": {
    "ses_0a5874314ffeZc2KAFu7EsMCOK": "887b16ff-ccb1-4723-80a0-f6d653e663b0"
  }
}
```

Native OpenCode session IDs are stored only in this local file. They are not sent to any provider; only the mapped UUID is sent in the configured header.

## Verifying against a gateway

1. Configure a target provider ID in `providers`.
2. Send two prompts in the same OpenCode session using a model routed through that provider.
3. Inspect both requests in your gateway's logs/dashboard.
4. Confirm both requests carry the same header value, and check whether your gateway surfaces that value as a session identifier. This plugin only controls what OpenCode sends; whether a gateway acts on it is gateway-specific.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```
