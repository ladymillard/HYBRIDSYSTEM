/**
 * The hub server.
 *
 * Node's own `http` module, a router, and the engine. No framework, no build
 * step: `node arena/bin/arena.ts serve` and the Arena is live.
 */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ArenaError } from "../core/errors.ts";
import { MINUTE } from "../core/clock.ts";
import type { Engine } from "../engine/engine.ts";
import { buildRouter } from "./api.ts";
import type { Ctx } from "./router.ts";

const WEB_ROOT = fileURLToPath(new URL("../../web/", import.meta.url));
const DOCS_ROOT = fileURLToPath(new URL("../../docs/", import.meta.url));
const MAX_BODY = 256 * 1024;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

export interface ServerOptions {
  engine: Engine;
  adminToken?: string;
  /** How often to run `engine.tick()`. Zero disables the timer (tests). */
  tickIntervalMs?: number;
  /** Requests per minute per key or address. Zero disables. */
  rateLimit?: number;
}

/**
 * A deliberately simple fixed-window limiter. It exists to stop one runaway
 * agent loop from starving the others, not to withstand a determined attack —
 * that is a bounty on the board.
 */
class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  check(key: string, now: number): boolean {
    if (this.limit <= 0) return true;
    const row = this.hits.get(key);
    if (!row || row.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + MINUTE });
      return true;
    }
    row.count += 1;
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    return row.count <= this.limit;
  }
}

export function createServer(options: ServerOptions): Server {
  const { engine } = options;
  const router = buildRouter();
  const limiter = new RateLimiter(options.rateLimit ?? 600);

  const server = createHttpServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[arena] unhandled", err);
      if (!res.headersSent) send(res, 500, { error: { code: "internal", message: "internal error" } });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const method = (req.method ?? "GET").toUpperCase();

    // The board is public data; agents run from anywhere.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    if (method === "OPTIONS") return void res.writeHead(204).end();

    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1]?.trim();
    const rateKey = bearer ?? req.socket.remoteAddress ?? "anon";
    if (!limiter.check(rateKey, Date.now())) {
      return send(res, 429, { error: { code: "rate_limited", message: "slow down" } });
    }

    const matched = router.match(method, url.pathname);
    if (!matched) return serveStatic(url.pathname, res);

    const { route, params } = matched;
    const actor = bearer && bearer !== options.adminToken ? engine.authenticate(bearer) : undefined;
    const isAdmin = Boolean(options.adminToken && bearer === options.adminToken);

    if (route.auth && !actor) {
      return send(res, 401, {
        error: {
          code: "unauthorized",
          message: "register at POST /v1/agents and send Authorization: Bearer <apiKey>",
        },
      });
    }
    if (route.admin && !isAdmin) {
      return send(res, 403, { error: { code: "forbidden", message: "operator token required" } });
    }
    if (actor?.suspended && method !== "GET") {
      return send(res, 403, { error: { code: "forbidden", message: "agent is suspended" } });
    }

    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      try {
        body = await readJson(req);
      } catch (err) {
        return fail(res, err);
      }
    }

    const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.slice(0, 200);
    const ctx: Ctx = { req, res, engine, params, query: url.searchParams, body, actor, isAdmin, idempotencyKey };

    try {
      // A retry that never reaches the engine twice is the difference between
      // a flaky network and a double payout.
      if (idempotencyKey && method !== "GET") {
        const replayed = engine.lookupIdempotent(idempotencyKey, { path: url.pathname, body });
        if (replayed !== undefined) {
          res.setHeader("Idempotent-Replay", "true");
          return send(res, 200, replayed);
        }
      }
      const result = await route.handler(ctx);
      if (idempotencyKey && method !== "GET") {
        engine.recordIdempotent(idempotencyKey, { path: url.pathname, body }, result);
      }
      send(res, method === "POST" && url.pathname === "/v1/agents" ? 201 : 200, result);
    } catch (err) {
      fail(res, err);
    }
  }

  async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    if (pathname.startsWith("/docs/")) {
      const file = join(DOCS_ROOT, normalize(pathname.slice("/docs/".length)).replace(/^(\.\.[/\\])+/, ""));
      if (existsSync(file)) return sendFile(file, res);
    }
    const rel = pathname === "/" ? "index.html" : normalize(pathname).replace(/^([/\\])+/, "").replace(/^(\.\.[/\\])+/, "");
    const file = join(WEB_ROOT, rel);
    if (existsSync(file) && !file.endsWith("/")) return sendFile(file, res);
    // Unknown path: JSON for API-shaped requests, the hub for everyone else.
    if (pathname.startsWith("/v1/") || pathname.startsWith("/.well-known/")) {
      return send(res, 404, { error: { code: "not_found", message: `no route for ${pathname}` } });
    }
    const index = join(WEB_ROOT, "index.html");
    if (existsSync(index)) return sendFile(index, res);
    send(res, 404, { error: { code: "not_found", message: "not found" } });
  }

  async function sendFile(file: string, res: ServerResponse): Promise<void> {
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  }

  if (options.tickIntervalMs !== 0) {
    const timer = setInterval(() => {
      try {
        engine.tick();
      } catch (err) {
        console.error("[arena] tick failed", err);
      }
    }, options.tickIntervalMs ?? MINUTE);
    timer.unref();
  }

  return server;
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function fail(res: ServerResponse, err: unknown): void {
  if (err instanceof ArenaError) return send(res, err.status, err.toJSON());
  console.error("[arena]", err);
  send(res, 500, { error: { code: "internal", message: (err as Error)?.message ?? "internal error" } });
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ArenaError("bad_request", "request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reject(new ArenaError("bad_request", "body must be a JSON object"));
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new ArenaError("bad_request", "body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}
