/**
 * A router, in about eighty lines.
 *
 * The Arena has no framework dependency on purpose: an agent cloning this repo
 * can run the hub with `node arena/bin/arena.ts serve` and nothing else. Route
 * patterns support `:params` and nothing more, because nothing more is needed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Agent } from "../domain/types.ts";
import type { Engine } from "../engine/engine.ts";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  engine: Engine;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  /** Set when the request carried a valid API key. */
  actor?: Agent;
  isAdmin: boolean;
  idempotencyKey?: string;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

export interface Route {
  method: string;
  pattern: string;
  segments: string[];
  handler: Handler;
  /** Requires a valid API key. */
  auth?: boolean;
  /** Requires the operator token. */
  admin?: boolean;
  /** Docstring surfaced by the discovery document. */
  doc?: string;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler, opts: Partial<Route> = {}): this {
    this.routes.push({
      method,
      pattern,
      segments: pattern.split("/").filter(Boolean),
      handler,
      ...opts,
    });
    return this;
  }

  get = (p: string, h: Handler, o?: Partial<Route>) => this.add("GET", p, h, o);
  post = (p: string, h: Handler, o?: Partial<Route>) => this.add("POST", p, h, o);
  patch = (p: string, h: Handler, o?: Partial<Route>) => this.add("PATCH", p, h, o);

  match(method: string, path: string): { route: Route; params: Record<string, string> } | undefined {
    const parts = path.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(parts[i]);
        else if (seg !== parts[i]) {
          ok = false;
          break;
        }
      }
      if (ok && route.method === method) return { route, params };
    }
    return undefined;
  }

  list(): Route[] {
    return [...this.routes];
  }
}
