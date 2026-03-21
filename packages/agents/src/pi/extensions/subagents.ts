import { Dirent, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export interface OpenZosmaSubagentConfig {
  asyncByDefault?: boolean;
  defaultSessionDir?: string;
}

export function getSubagentsConfigPath(): string {
  return join(homedir(), ".pi", "agent", "extensions", "subagent", "config.json");
}

export function buildSubagentsConfig(): OpenZosmaSubagentConfig {
  return {
    asyncByDefault: process.env.OPENZOSMA_PI_SUBAGENT_ASYNC_BY_DEFAULT === "true",
    defaultSessionDir: process.env.OPENZOSMA_PI_SUBAGENT_SESSION_DIR,
  };
}

export function syncSubagentsConfig(config = buildSubagentsConfig()): string {
  const configPath = getSubagentsConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  return configPath;
}

export function applySubagentEnv(): void {
  if (process.env.OPENZOSMA_PI_SUBAGENT_MAX_DEPTH && !process.env.PI_SUBAGENT_MAX_DEPTH) {
    process.env.PI_SUBAGENT_MAX_DEPTH = process.env.OPENZOSMA_PI_SUBAGENT_MAX_DEPTH;
  }
}

export function isPiAvailable(): boolean {
  const result = spawnSync("pi", ["--version"], { encoding: "utf-8" });
  return result.status === 0 && /\d+\.\d+/.test(result.stdout ?? "");
}

const SUBAGENTS_SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../subagents");
const SUBAGENTS_TARGET_DIR = join(homedir(), ".pi", "agent", "agents");

export function syncSubagentDefinitions(): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(SUBAGENTS_SOURCE_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  mkdirSync(SUBAGENTS_TARGET_DIR, { recursive: true });

  const synced: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const src = join(SUBAGENTS_SOURCE_DIR, entry.name);
    const dest = join(SUBAGENTS_TARGET_DIR, entry.name);
    writeFileSync(dest, readFileSync(src, "utf-8"), "utf-8");
    synced.push(dest);
  }
  return synced;
}
