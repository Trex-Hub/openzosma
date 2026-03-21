import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface OpenZosmaWebSearchConfig {
  provider?: "auto" | "perplexity" | "gemini";
  searchModel?: string;
  curateWindow?: number;
  autoFilter?:
    | boolean
    | {
        enabled?: boolean;
        model?: string;
        prompt?: string;
      };
  shortcuts?: {
    curate?: string;
    activity?: string;
  };
  githubClone?: {
    enabled?: boolean;
    maxRepoSizeMB?: number;
    cloneTimeoutSeconds?: number;
    clonePath?: string;
  };
  youtube?: {
    enabled?: boolean;
    preferredModel?: string;
  };
  video?: {
    enabled?: boolean;
    preferredModel?: string;
    maxSizeMB?: number;
  };
  perplexityApiKey?: string;
  geminiApiKey?: string;
}

export function getWebSearchConfigPath(): string {
  return join(homedir(), ".pi", "web-search.json");
}

export function buildWebSearchConfig(): OpenZosmaWebSearchConfig {
  return {
    provider: (process.env.OPENZOSMA_PI_WEB_PROVIDER as OpenZosmaWebSearchConfig["provider"]) ?? "auto",
    searchModel: process.env.OPENZOSMA_PI_WEB_SEARCH_MODEL,
    curateWindow: process.env.OPENZOSMA_PI_WEB_CURATE_WINDOW
      ? Number(process.env.OPENZOSMA_PI_WEB_CURATE_WINDOW)
      : undefined,
    perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
  };
}

export function syncWebSearchConfig(config = buildWebSearchConfig()): string {
  const configPath = getWebSearchConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  return configPath;
}
