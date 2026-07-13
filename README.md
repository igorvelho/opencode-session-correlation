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
