/**
 * Minimal type contracts for the Slack adapter.
 *
 * These are duplicated from @openzosma/gateway to avoid a circular
 * workspace dependency (adapter-slack <-> gateway). Keep in sync
 * with the canonical definitions in packages/gateway/src/.
 */

/** Common contract for all channel adapters. */
export interface ChannelAdapter {
	readonly name: string
	init(sessionManager: AdapterSessionManager): Promise<void>
	shutdown(): Promise<void>
}

/** Subset of SessionManager that adapters need. */
export interface AdapterSessionManager {
	createSession(
		id?: string,
		agentConfigId?: string,
		resolvedConfig?: {
			provider?: string
			model?: string
			systemPrompt?: string | null
			systemPromptPrefix?: string
			toolsEnabled?: string[]
		},
		userId?: string,
	): Promise<{ id: string }>
	sendMessage(
		sessionId: string,
		content: string,
		signal?: AbortSignal,
		userId?: string,
	): AsyncGenerator<AdapterGatewayEvent>
	resolveUserByEmail(email: string): Promise<string | null>
}

/** Subset of GatewayEvent that the Slack adapter inspects. */
export interface AdapterGatewayEvent {
	type: string
	text?: string
	error?: string
}

// ---------------------------------------------------------------------------
// Slack context types
// ---------------------------------------------------------------------------

/** Profile information for a Slack user, used for context injection. */
export interface SlackUserProfile {
	/** Slack user ID (e.g. "U12345"). */
	slackUserId: string
	/** Display name in Slack. */
	displayName: string
	/** Full real name. */
	realName: string
	/** Email address (may be undefined for bots or restricted profiles). */
	email?: string
	/** Job title. */
	title?: string
	/** IANA timezone (e.g. "America/New_York"). */
	timezone?: string
}

/** Metadata about the Slack channel where the conversation is happening. */
export interface SlackChannelInfo {
	/** Channel ID (e.g. "C12345"). */
	channelId: string
	/** Channel name (e.g. "general"). Does not include the # prefix. */
	name: string
	/** Channel topic text. */
	topic?: string
	/** Channel purpose text. */
	purpose?: string
	/** True if this is a DM (im) or group DM (mpim). */
	isDm: boolean
}

/** A single message in a Slack thread, used for context injection. */
export interface SlackThreadMessage {
	/** Display name of the sender. */
	senderName: string
	/** Whether the sender is a bot. */
	isBot: boolean
	/** Message text. */
	text: string
	/** Unix timestamp string from Slack. */
	ts: string
}

/** Full context about the Slack environment for a message. */
export interface SlackMessageContext {
	/** Profile of the user who sent the current message. */
	sender: SlackUserProfile
	/** Channel metadata. */
	channel: SlackChannelInfo
	/** Previous messages in the thread (chronological, excluding current message). */
	threadHistory: SlackThreadMessage[]
	/** Thread timestamp, used by the agent to reply in the correct thread via agent-slack. */
	threadTs?: string
}
