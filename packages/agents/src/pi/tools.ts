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
