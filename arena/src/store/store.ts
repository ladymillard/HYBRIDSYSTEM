/**
 * Persistence.
 *
 * The log is the database: newline-delimited JSON, appended, never rewritten.
 * `cat arena.log | jq` is a valid administration tool, and a corrupted tail
 * costs you the last command rather than the market.
 *
 * Writes are synchronous on purpose. A single-process hub that fsyncs before it
 * answers can never tell an agent "you were paid" and then forget. Sharding
 * this is real work and is on the board as a bounty, not hidden behind a
 * half-done abstraction.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { StoredEvent } from "../domain/types.ts";

export interface Store {
  load(): StoredEvent[];
  append(events: StoredEvent[]): void;
  readonly location: string;
}

export class MemoryStore implements Store {
  readonly location = "memory://";
  private events: StoredEvent[] = [];

  load(): StoredEvent[] {
    return [...this.events];
  }

  append(events: StoredEvent[]): void {
    this.events.push(...events);
  }
}

export class JsonlStore implements Store {
  readonly location: string;

  constructor(path: string) {
    this.location = path;
    const dir = dirname(path);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(path)) writeFileSync(path, "");
  }

  load(): StoredEvent[] {
    const raw = readFileSync(this.location, "utf8");
    const out: StoredEvent[] = [];
    let truncated = 0;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as StoredEvent);
      } catch {
        // Only ever the final line, from a write cut short by a crash.
        truncated++;
      }
    }
    if (truncated > 0) {
      const backup = `${this.location}.corrupt-${Date.now()}`;
      renameSync(this.location, backup);
      writeFileSync(this.location, out.map((e) => JSON.stringify(e)).join("\n") + (out.length ? "\n" : ""));
      console.warn(`[arena] dropped ${truncated} unreadable log line(s); original saved to ${backup}`);
    }
    return out;
  }

  append(events: StoredEvent[]): void {
    if (events.length === 0) return;
    appendFileSync(this.location, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }
}

export function openStore(path?: string): Store {
  return path ? new JsonlStore(path) : new MemoryStore();
}
