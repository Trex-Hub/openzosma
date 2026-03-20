import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  agentConfigQueries,
  agentSkillQueries,
  agentTypeQueries,
} from "@openzosma/db";
import type pg from "pg";
import type { SessionManager } from "./session-manager.js";

export function createApp(sessionManager: SessionManager, db?: pg.Pool): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  // ── Sessions ─────────────────────────────────────────────────────────────

  // Create a new session
  app.post("/api/v1/sessions", async (c) => {
    const body = (await c.req
      .json<{ agentConfigId?: string }>()
      .catch(() => ({}))) as { agentConfigId?: string };
    const session = await sessionManager.createSession(
      undefined,
      body.agentConfigId,
    );
    return c.json({ id: session.id, createdAt: session.createdAt }, 201);
  });

  // Get session details
  app.get("/api/v1/sessions/:id", (c) => {
    const session = sessionManager.getSession(c.req.param("id"));
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json({
      id: session.id,
      createdAt: session.createdAt,
      messageCount: session.messages.length,
    });
  });

  // Send a message (non-streaming REST fallback)
  app.post("/api/v1/sessions/:id/messages", async (c) => {
    const session = sessionManager.getSession(c.req.param("id"));
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const body = await c.req.json<{ content: string }>();
    if (!body.content) {
      return c.json({ error: "content is required" }, 400);
    }

    const events = [];
    for await (const event of sessionManager.sendMessage(
      c.req.param("id"),
      body.content,
    )) {
      events.push(event);
    }

    const text = events
      .filter((e) => e.type === "message_update" && e.text)
      .map((e) => e.text)
      .join("");

    return c.json({ role: "assistant", content: text });
  });

  // Get messages for a session
  app.get("/api/v1/sessions/:id/messages", (c) => {
    const session = sessionManager.getSession(c.req.param("id"));
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(session.messages);
  });

  // ── Agent Types ───────────────────────────────────────────────────────────

  app.get("/api/v1/agent-types", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const types = await agentTypeQueries.listAgentTypes(db);
    return c.json(types);
  });

  // ── Agent Configs ─────────────────────────────────────────────────────────

  app.get("/api/v1/agent-configs", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const configs = await agentConfigQueries.listAgentConfigs(db);
    return c.json(configs);
  });

  app.post("/api/v1/agent-configs", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const body = await c.req.json<{
      agentTypeId: string;
      name: string;
      description?: string;
      systemPrompt?: string;
      config?: Record<string, unknown>;
      isDefault?: boolean;
    }>();
    if (!body.agentTypeId || !body.name) {
      return c.json({ error: "agentTypeId and name are required" }, 400);
    }
    const config = await agentConfigQueries.createAgentConfig(db, body);
    return c.json(config, 201);
  });

  // Must be before /:id to avoid matching "default" as an ID
  app.get("/api/v1/agent-configs/default", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const configs = await agentConfigQueries.listAgentConfigs(db);
    const def = configs.find((c) => c.isDefault) ?? configs[0] ?? null;
    if (!def) return c.json(null);
    return c.json(def);
  });

  app.get("/api/v1/agent-configs/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const config = await agentConfigQueries.getAgentConfig(
      db,
      c.req.param("id"),
    );
    if (!config) return c.json({ error: "Not found" }, 404);
    return c.json(config);
  });

  app.put("/api/v1/agent-configs/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const body =
      await c.req.json<
        Parameters<typeof agentConfigQueries.updateAgentConfig>[2]
      >();
    const config = await agentConfigQueries.updateAgentConfig(
      db,
      c.req.param("id"),
      body,
    );
    if (!config) return c.json({ error: "Not found" }, 404);
    return c.json(config);
  });

  app.delete("/api/v1/agent-configs/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    await agentConfigQueries.deleteAgentConfig(db, c.req.param("id"));
    return c.json({ ok: true });
  });

  // ── Agent Config Skills ───────────────────────────────────────────────────

  app.get("/api/v1/agent-configs/:id/skills", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const skills = await agentSkillQueries.getSkillsForConfig(
      db,
      c.req.param("id"),
    );
    return c.json(skills);
  });

  app.put("/api/v1/agent-configs/:id/skills", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const body = await c.req.json<{ skillIds: string[] }>();
    if (!Array.isArray(body.skillIds))
      return c.json({ error: "skillIds array required" }, 400);
    await agentSkillQueries.setConfigSkills(
      db,
      c.req.param("id"),
      body.skillIds,
    );
    return c.json({ ok: true });
  });

  // ── Skills ────────────────────────────────────────────────────────────────

  app.get("/api/v1/skills", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const skills = await agentSkillQueries.listSkills(db);
    return c.json(skills);
  });

  app.post("/api/v1/skills", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const body = await c.req.json<{
      name: string;
      description?: string;
      content: string;
    }>();
    if (!body.name || !body.content)
      return c.json({ error: "name and content are required" }, 400);
    const skill = await agentSkillQueries.createSkill(db, body);
    return c.json(skill, 201);
  });

  app.get("/api/v1/skills/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const skill = await agentSkillQueries.getSkill(db, c.req.param("id"));
    if (!skill) return c.json({ error: "Not found" }, 404);
    return c.json(skill);
  });

  app.put("/api/v1/skills/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const body =
      await c.req.json<Parameters<typeof agentSkillQueries.updateSkill>[2]>();
    const skill = await agentSkillQueries.updateSkill(
      db,
      c.req.param("id"),
      body,
    );
    if (!skill) return c.json({ error: "Not found" }, 404);
    return c.json(skill);
  });

  app.delete("/api/v1/skills/:id", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    await agentSkillQueries.deleteSkill(db, c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}
