import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "@mariozechner/pi-coding-agent";

export function createDefaultTools(workspaceDir: string) {
  return [
    createReadTool(workspaceDir),
    createBashTool(workspaceDir),
    createEditTool(workspaceDir),
    createWriteTool(workspaceDir),
    createGrepTool(workspaceDir),
    createFindTool(workspaceDir),
    createLsTool(workspaceDir),
  ];
}

const TOOL_MAP = {
  read:  createReadTool,
  bash:  createBashTool,
  edit:  createEditTool,
  write: createWriteTool,
  grep:  createGrepTool,
  find:  createFindTool,
  ls:    createLsTool,
} as const

export type ToolName = keyof typeof TOOL_MAP

export function buildToolList(workspaceDir: string, enabled?: string[]) {
  if (!enabled) return createDefaultTools(workspaceDir)
  return enabled
    .filter((n): n is ToolName => n in TOOL_MAP)
    .map((n) => TOOL_MAP[n](workspaceDir))
}
