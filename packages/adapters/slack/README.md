# @openzosma/adapter-slack

Slack channel adapter for OpenZosma. Connects to Slack via [Bolt](https://slack.dev/bolt-js/) Socket Mode, maps Slack threads to agent sessions, and streams agent responses back as threaded replies.

## How it works

1. Gateway checks for `SLACK_BOT_TOKEN` at startup and dynamically imports this adapter
2. Adapter opens a Socket Mode WebSocket connection to Slack (no public URL required)
3. When a message arrives, the adapter maps the Slack thread (channel + thread_ts) to an orchestrator session
4. The message is forwarded to the agent via `SessionManager.sendMessage()`
5. The full agent response is posted back as a threaded reply

## Slack App Setup

### 1. Create the app

Go to [api.slack.com/apps](https://api.slack.com/apps) > **Create New App** > **From scratch**. Name it and select your workspace.

### 2. Enable Socket Mode

**Settings > Socket Mode** > toggle on. Create an App-Level Token with the `connections:write` scope. Copy the token (`xapp-...`).

### 3. Add bot token scopes

**OAuth & Permissions > Scopes > Bot Token Scopes**:

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Respond when @mentioned |
| `chat:write` | Send messages |
| `files:read` | Access uploaded files |
| `channels:history` | Read channel messages |
| `groups:history` | Read private channel messages |
| `users:read` | Resolve user profiles |
| `users:read.email` | Map users to OpenZosma accounts |

### 4. Subscribe to events

**Event Subscriptions** > enable. Under **Subscribe to bot events**, add:
- `message.channels`
- `message.groups`

### 5. Install to workspace

**Install App** > **Install to Workspace**. Copy the Bot User OAuth Token (`xoxb-...`).

### 6. Configure environment

Add to `.env.local` at the repo root:

```
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token
```

### 7. Start the gateway

```bash
pnpm --filter @openzosma/gateway dev
```

The adapter connects automatically when `SLACK_BOT_TOKEN` is set. You should see:

```
INFO  [gateway] Adapter started: slack
```

### 8. Invite the bot

In Slack, invite the bot to a channel (`/invite @YourBot`) and send a message.

## Current limitations

- **In-memory session mapping** -- thread-to-session mappings are lost on gateway restart (Valkey-backed persistence is planned)
- **No user resolution** -- Slack users are not yet mapped to OpenZosma users
- **No progressive updates** -- the bot posts the full response after the agent finishes (no streaming/typing indicator)
- **No file attachment handling** -- files uploaded in Slack are not forwarded to the agent

## Architecture

```
Slack (Socket Mode WS)
  -> SlackAdapter.handleMessage()
    -> SessionManager.sendMessage(sessionId, text)
      -> OrchestratorSessionManager (sandbox proxy)
        -> sandbox-server agent
    <- AsyncGenerator<GatewayEvent>
  <- say({ text, thread_ts })
Slack (threaded reply)
```

See [PHASE-5-ADAPTERS.md](../../../docs/PHASE-5-ADAPTERS.md) for the full design spec.
