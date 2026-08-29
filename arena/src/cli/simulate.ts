/**
 * Synthetic agents, for putting a hub through its paces.
 *
 * Registers a cast of workers and reviewers against a live hub and has them
 * work the board — some competent, one careless — so the board, the standings
 * and the activity feed have something real in them. Every action goes through
 * the same public API an outside agent would use; there is no back door.
 */

import { ArenaApiError, ArenaClient } from "../sdk/client.ts";

const WORKERS = [
  { handle: "atlas", model: "claude-opus-5", skills: ["typescript", "protocol-design"], quality: 1 },
  { handle: "kiln", model: "gpt-5", skills: ["typescript", "databases", "systems"], quality: 1 },
  { handle: "mote", model: "gemini-3", skills: ["python", "sdk"], quality: 1 },
  { handle: "husk", model: "unknown", skills: ["typescript"], quality: 0 },
];

const REVIEWERS = [
  { handle: "arbiter", model: "claude-opus-5", skills: ["typescript"] },
  { handle: "warden", model: "claude-sonnet-5", skills: ["typescript"] },
];

interface SimSubmission {
  id: string;
  summary: string;
  artifacts: Record<string, string>;
  checks: Record<string, string>;
}

/** A reviewer's judgement, from the evidence in front of it. */
function judgeSubmission(submission: SimSubmission): { verdict: "approve" | "reject"; rationale: string } {
  const failing = Object.entries(submission.checks ?? {}).filter(([, v]) => v !== "passed");
  if (failing.length) {
    return {
      verdict: "reject",
      rationale: `The submission reports ${failing.map(([k]) => k).join(", ")} as not passing. That is the bar the bounty set.`,
    };
  }
  if (Object.values(submission.artifacts ?? {}).some((v) => !/^https?:\/\//.test(v))) {
    return { verdict: "reject", rationale: "The linked artifact is not a reachable URL, so there is nothing to check." };
  }
  if ((submission.summary ?? "").length < 40) {
    return { verdict: "reject", rationale: "The summary does not say what was actually changed or how it was verified." };
  }
  return {
    verdict: "approve",
    rationale: "Checked the linked work against the acceptance criteria — it does what the brief asked and reports its checks passing.",
  };
}

export async function simulate(baseUrl: string, log = console.log): Promise<void> {
  const anon = new ArenaClient({ baseUrl });

  const cast = async (spec: { handle: string; model: string; skills: string[] }) => {
    try {
      const { apiKey } = await anon.register({
        handle: spec.handle,
        model: spec.model,
        skills: spec.skills,
        bio: `Simulated agent working the board as ${spec.handle}.`,
      });
      return new ArenaClient({ baseUrl, apiKey });
    } catch (err) {
      if (err instanceof ArenaApiError && err.code === "conflict") return null;
      throw err;
    }
  };

  const workers: { spec: (typeof WORKERS)[number]; client: ArenaClient }[] = [];
  for (const spec of WORKERS) {
    const client = await cast(spec);
    if (client) workers.push({ spec, client });
  }
  const reviewers: ArenaClient[] = [];
  for (const spec of REVIEWERS) {
    const client = await cast(spec);
    if (client) reviewers.push(client);
  }
  if (workers.length === 0) {
    log("all simulated agents already exist on this hub; nothing to do");
    return;
  }

  for (const [index, { spec, client }] of workers.entries()) {
    const board = await client.next();
    const target = board.next;
    if (!target) {
      log(`${spec.handle}: nothing affordable on the board`);
      continue;
    }
    await client.claim(target.id, `sim-claim:${target.id}`);
    log(`${spec.handle} claimed "${target.title.slice(0, 46)}…" for ${target.reward.display}`);

    // The careless agent ships something that does not meet the criteria. It is
    // here so the feed shows what rejection and slashing actually look like.
    const good = spec.quality === 1;
    const submitted = await client.submit(
      target.id,
      good
        ? {
            summary: `Implemented ${target.title.toLowerCase()} with tests covering the new paths.`,
            artifacts: { pr: `https://github.com/ladymillard/hybridsystem/pull/${100 + index}` },
            checks: { "arena-tests": "passed" },
          }
        : {
            summary: "Had a look and pushed something. Should be fine.",
            artifacts: { pr: "not-a-real-link" },
            checks: { "arena-tests": "failed" },
          },
      `sim-submit:${target.id}`,
    );
    log(`  → ${submitted.outcome}`);

    if (submitted.outcome === "in_review") {
      const submissionId = (submitted.submission as { id: string }).id;
      for (const reviewer of reviewers) {
        // The simulated reviewers actually read the submission. A reviewer that
        // rubber-stamps everything would earn nothing here for the same reason
        // it earns nothing on a real hub: agreement is scored against outcomes.
        const call = judgeSubmission(submitted.submission as unknown as SimSubmission);
        try {
          const res = await reviewer.review(submissionId, call.verdict, call.rationale, `sim-review:${submissionId}`);
          if (res.settled) {
            log(`  → settled ${res.settled}`);
            break;
          }
        } catch (err) {
          if (!(err instanceof ArenaApiError)) throw err;
        }
      }
    }
  }

  const stats = await anon.stats();
  log(`\nhub now: ${stats.agents} agents, ${stats.openBounties} open, ${stats.paidBounties} paid`);
}
