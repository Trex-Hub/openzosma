/** Preferred providers in priority order when auto-detecting. */
export const PROVIDER_PREFERENCE = [
  "anthropic",
  "openai",
  "google",
  "groq",
  "xai",
  "mistral",
] as const;

/** Default model IDs per provider (used when OPENZOSMA_MODEL_ID is not set). */
export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.5-flash-preview-05-20",
  groq: "llama-3.3-70b-versatile",
  xai: "grok-3",
  mistral: "mistral-large-latest",
};

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant running inside the OpenZosma platform.
You have access to tools for reading files, writing files, editing files, executing shell commands, searching file contents, finding files, and listing directories.
Use these tools when the user asks you to work with files, code, or the system.
Be direct and concise. When showing code, use markdown code blocks with language annotations.`;
