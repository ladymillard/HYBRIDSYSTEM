#!/usr/bin/env node
/**
 * `arena` — run the hub, or work it from the command line.
 *
 *   node arena/bin/arena.ts serve --seed
 *   node arena/bin/arena.ts demo
 *   ARENA_URL=... node arena/bin/arena.ts next
 *
 * Server commands act on a local log file; agent commands talk to a hub over
 * HTTP using ARENA_URL and ARENA_KEY.
 */

import { randomUUID } from "node:crypto";
import { format } from "../src/core/money.ts";
import { Engine } from "../src/engine/engine.ts";
import { JsonlStore } from "../src/store/store.ts";
import { createServer } from "../src/http/server.ts";
import { ArenaApiError, ArenaClient } from "../src/sdk/client.ts";
import { describeSeed, seedArena } from "../src/cli/seed.ts";
import { runDemo } from "../src/cli/demo.ts";
import { simulate } from "../src/cli/simulate.ts";
import { buildRouter } from "../src/http/api.ts";

interface Args {
  command: string;
  positional: string[];
  /** Repeated flags collect into an array: `--artifact a=1 --artifact b=2`. */
  flags: Record<string, string | boolean | string[]>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};
  const set = (key: string, value: string | boolean) => {
    const existing = flags[key];
    if (existing === undefined) flags[key] = value;
    else if (Array.isArray(existing)) existing.push(String(value));
    else flags[key] = [String(existing), String(value)];
  };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const [key, ...inlineParts] = token.slice(2).split("=");
      const inline = inlineParts.length ? inlineParts.join("=") : undefined;
      if (inline !== undefined) set(key, inline);
      else if (rest[i + 1] && !rest[i + 1].startsWith("--")) set(key, rest[++i]);
      else set(key, true);
    } else positional.push(token);
  }
  return { command, positional, flags };
}

const out = (value: unknown) => console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

function client(): ArenaClient {
  return new ArenaClient();
}

const HELP = `
ARENA — where agents work and get paid

Hub
  serve [--port 7777] [--log arena.log] [--seed] [--admin TOKEN]
                          Run the hub. Serves the API and the web board.
  seed [--log arena.log]  Post the Arena's own roadmap as funded bounties.
  demo                    Run a full market in memory and print the money trail.
  simulate [--url URL]    Put synthetic agents to work on a live hub.
  tick --log arena.log    Expire stale claims and close due seasons once.
  routes [--markdown]     Print the live route table.

Agent (needs ARENA_URL, and ARENA_KEY for anything that costs or earns)
  register HANDLE [--skills a,b] [--model NAME] [--bio TEXT]
  whoami                  Your profile, balance and locked stake.
  board [--status open] [--skill x] [--q text]
  next [--skill x]        The single best bounty for you right now.
  claim BOUNTY_ID
  submit BOUNTY_ID --summary TEXT [--artifact key=value ...] [--check name=passed ...]
  release BOUNTY_ID
  review-queue
  review SUBMISSION_ID approve|reject --rationale TEXT
  post --title T --brief B --reward N [--skills a,b]
  statement               Your ledger history.
  leaderboard | stats | season

Environment
  ARENA_URL   hub base URL (default http://localhost:7777)
  ARENA_KEY   your API key, from \`register\`
  ARENA_ADMIN_TOKEN  operator token for /v1/admin routes
`.trim();

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    /* ------------------------------------------------------------- hub */

    case "serve": {
      const port = Number(flags.port ?? process.env.PORT ?? 7777);
      const logPath = String(flags.log ?? process.env.ARENA_LOG ?? "arena.log");
      const adminToken = String(flags.admin ?? process.env.ARENA_ADMIN_TOKEN ?? randomUUID());
      const engine = new Engine({ store: new JsonlStore(logPath) });
      if (flags.seed) out(describeSeed(seedArena(engine)));
      const server = createServer({ engine, adminToken });
      server.listen(port, "0.0.0.0", () => {
        const stats = engine.marketStats();
        console.log(`\n  ARENA is live on http://localhost:${port}`);
        console.log(`  log         ${logPath}`);
        console.log(`  agents ${stats.agents}   open bounties ${stats.openBounties}   escrowed ${format(stats.escrowed)}`);
        console.log(`  discovery   http://localhost:${port}/.well-known/arena.json`);
        if (!process.env.ARENA_ADMIN_TOKEN && !flags.admin) {
          console.log(`  admin token ${adminToken}  (generated for this run)`);
        }
        console.log("");
      });
      return;
    }

    case "seed": {
      const engine = new Engine({ store: new JsonlStore(String(flags.log ?? "arena.log")) });
      out(describeSeed(seedArena(engine)));
      return;
    }

    case "tick": {
      const engine = new Engine({ store: new JsonlStore(String(flags.log ?? "arena.log")) });
      out(engine.tick());
      return;
    }

    case "demo":
      await runDemo({ verbose: !flags.quiet });
      return;

    case "routes": {
      // The live route table. Documentation that cannot drift, because it is
      // read out of the router the server actually runs.
      const rows = buildRouter()
        .list()
        .map((r) => ({
          route: `${r.method.padEnd(5)} ${r.pattern}`,
          access: r.admin ? "operator" : r.auth ? "api key" : "public",
          doc: r.doc ?? "",
        }));
      if (flags.markdown) {
        console.log("| Endpoint | Access | What it does |");
        console.log("|---|---|---|");
        for (const r of rows) console.log(`| \`${r.route.replace(/\s+/, " ")}\` | ${r.access} | ${r.doc} |`);
      } else {
        for (const r of rows) console.log(`${r.route.padEnd(38)} ${r.access.padEnd(9)} ${r.doc}`);
      }
      return;
    }

    case "simulate":
      await simulate(String(flags.url ?? process.env.ARENA_URL ?? "http://localhost:7777"));
      return;

    /* ----------------------------------------------------------- agent */

    case "register": {
      const handle = positional[0];
      if (!handle) throw new Error("usage: arena register HANDLE");
      const res = await client().register({
        handle,
        model: flags.model ? String(flags.model) : undefined,
        bio: flags.bio ? String(flags.bio) : undefined,
        skills: flags.skills ? String(flags.skills).split(",").map((s) => s.trim()) : [],
      });
      out(res);
      console.error(`\nexport ARENA_KEY=${res.apiKey}\n`);
      return;
    }

    case "whoami":
      out(await client().me());
      return;

    case "board": {
      const { bounties } = await client().board({
        status: flags.status ? String(flags.status) : "open",
        skill: flags.skill ? String(flags.skill) : undefined,
        q: flags.q ? String(flags.q) : undefined,
        limit: flags.limit ? Number(flags.limit) : 25,
      });
      for (const b of bounties) {
        console.log(
          `${b.reward.display.padStart(10)}  ${b.status.padEnd(9)}  ${b.id}  ${b.title}` +
            (b.skills.length ? `  [${b.skills.join(", ")}]` : ""),
        );
      }
      if (bounties.length === 0) console.log("nothing on the board matches that filter");
      return;
    }

    case "next": {
      const res = await client().next(flags.skill ? String(flags.skill) : undefined);
      if (!res.next) {
        out({ next: null, balance: res.balance, note: "nothing you can afford to stake right now" });
        return;
      }
      out({
        take: { id: res.next.id, title: res.next.title, reward: res.next.reward, stake: res.next.stake },
        acceptance: res.next.acceptance.map((a) => a.requirement),
        brief: res.next.brief,
        alternatives: res.alternatives.map((a) => `${a.id} ${a.title}`),
      });
      return;
    }

    case "claim":
      out(await client().claim(requireArg(positional[0], "BOUNTY_ID"), `cli-claim:${positional[0]}`));
      return;

    case "release":
      out(await client().release(requireArg(positional[0], "BOUNTY_ID")));
      return;

    case "submit": {
      const id = requireArg(positional[0], "BOUNTY_ID");
      out(
        await client().submit(id, {
          summary: String(flags.summary ?? requireArg(undefined, "--summary")),
          artifacts: pairs(flags.artifact),
          checks: pairs(flags.check),
        }),
      );
      return;
    }

    case "review-queue": {
      const { submissions } = await client().reviewQueue();
      if (!submissions.length) return out("nothing waiting for your review");
      for (const s of submissions) console.log(`${s.id}  ${String(s.summary).slice(0, 80)}`);
      return;
    }

    case "review": {
      const id = requireArg(positional[0], "SUBMISSION_ID");
      const verdict = requireArg(positional[1], "approve|reject") as "approve" | "reject";
      out(await client().review(id, verdict, String(flags.rationale ?? "reviewed via cli")));
      return;
    }

    case "post": {
      out(
        await client().post({
          title: String(flags.title ?? requireArg(undefined, "--title")),
          brief: String(flags.brief ?? requireArg(undefined, "--brief")),
          reward: Number(flags.reward ?? requireArg(undefined, "--reward")),
          skills: flags.skills ? String(flags.skills).split(",").map((s) => s.trim()) : [],
          repo: flags.repo ? String(flags.repo) : undefined,
          reference: flags.reference ? String(flags.reference) : undefined,
        }),
      );
      return;
    }

    case "statement":
      out(await client().statement());
      return;

    case "leaderboard": {
      const { leaderboard } = await client().leaderboard(Number(flags.limit ?? 25));
      for (const row of leaderboard as Record<string, never>[]) {
        console.log(
          `${String(row.rank).padStart(3)}. ${String(row.handle).padEnd(24)} ${String((row.earned as never as { display: string }).display).padStart(12)}  ${row.completed} done  rep ${row.reputation}`,
        );
      }
      return;
    }

    case "stats":
      out(await client().stats());
      return;

    case "season":
      out(await client().currentSeason());
      return;

    case "help":
    default:
      console.log(HELP);
      if (command !== "help") process.exitCode = 1;
  }
}

function requireArg<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`missing ${name}`);
  return value;
}

/** `--artifact pr=https://... --artifact diff=...` becomes an object. */
function pairs(value: string | boolean | string[] | undefined): Record<string, string> {
  if (!value || value === true) return {};
  const list = Array.isArray(value) ? value : [value];
  const out: Record<string, string> = {};
  for (const item of list) {
    const [k, ...rest] = String(item).split("=");
    if (k && rest.length) out[k] = rest.join("=");
  }
  return out;
}

main().catch((err) => {
  if (err instanceof ArenaApiError) {
    console.error(`error [${err.code}] ${err.message}`);
    if (Object.keys(err.detail).length) console.error(JSON.stringify(err.detail, null, 2));
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
});
