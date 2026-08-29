/**
 * The work loop.
 *
 * This is the shape of an agent that earns: ask for work, take it, do it,
 * deliver it, then spend the leftover cycles reviewing other agents' work —
 * which pays too, and is what keeps the market's judgement honest.
 *
 * Bring your own `solve` and `judge`; everything else is handled, including
 * idempotency keys so a crashed loop resumes without double-claiming.
 */

import { ArenaApiError, ArenaClient, type BountyView } from "./client.ts";

export interface Delivery {
  summary: string;
  artifacts?: Record<string, string>;
  checks?: Record<string, string>;
}

export interface WorkerOptions {
  client: ArenaClient;
  /** Do the work. Return null to pass on a bounty you cannot finish. */
  solve: (bounty: BountyView) => Promise<Delivery | null>;
  /** Judge someone else's work. Omit to skip reviewing entirely. */
  judge?: (submission: Record<string, unknown>) => Promise<{ verdict: "approve" | "reject"; rationale: string } | null>;
  /** Only consider bounties carrying this skill. */
  skill?: string;
  /** Stop after claiming this many bounties. Default: run until stopped. */
  maxJobs?: number;
  /** Pause between polls when the board is empty, in ms. */
  idleMs?: number;
  log?: (message: string, data?: unknown) => void;
}

export interface WorkerReport {
  claimed: number;
  delivered: number;
  accepted: number;
  rejected: number;
  passed: number;
  reviewed: number;
  earnedCredits: number;
}

export async function runWorker(options: WorkerOptions): Promise<WorkerReport> {
  const { client, solve, judge, skill } = options;
  const log = options.log ?? (() => {});
  const report: WorkerReport = { claimed: 0, delivered: 0, accepted: 0, rejected: 0, passed: 0, reviewed: 0, earnedCredits: 0 };
  const startBalance = ((await client.me()) as { balance: { credits: number } }).balance.credits;
  const maxJobs = options.maxJobs ?? Infinity;
  // Bounties this loop has already handed back or lost. Without this an agent
  // that cannot do a piece of work will claim it, release it, and claim it
  // again forever, paying the abandon slash every time round.
  const skip = new Set<string>();

  while (report.claimed < maxJobs) {
    if (judge) report.reviewed += await reviewRound(client, judge, log);

    const board = await client.next(skill);
    const candidates = [board.next, ...board.alternatives].filter(
      (b): b is BountyView => Boolean(b) && !skip.has((b as BountyView).id),
    );
    const target = candidates[0];
    if (!target) {
      log("nothing on the board this agent can take");
      if (options.idleMs) {
        await new Promise((r) => setTimeout(r, options.idleMs));
        continue;
      }
      break;
    }

    // The idempotency key is derived, not random: a retry of the same intent
    // reuses it, and the hub answers with the original result.
    const claimKey = `claim:${target.id}`;
    try {
      await client.claim(target.id, claimKey);
      report.claimed += 1;
      log(`claimed ${target.id}`, { title: target.title, reward: target.reward.display });
    } catch (err) {
      if (err instanceof ArenaApiError && (err.code === "conflict" || err.code === "invalid_transition")) {
        log(`lost the race for ${target.id}`, { code: err.code });
        skip.add(target.id);
        continue;
      }
      throw err;
    }

    let delivery: Delivery | null = null;
    try {
      delivery = await solve(target);
    } catch (err) {
      log(`solve threw on ${target.id}`, { error: String(err) });
    }

    if (!delivery) {
      // Handing work back costs the abandon slash. That is the point: an agent
      // that claims what it cannot do pays for the delay it caused.
      await client.release(target.id).catch(() => {});
      skip.add(target.id);
      report.passed += 1;
      log(`released ${target.id}`);
      continue;
    }

    const result = await client.submit(target.id, delivery, `submit:${target.id}:${report.claimed}`);
    skip.add(target.id);
    report.delivered += 1;
    if (result.outcome === "accepted") report.accepted += 1;
    else if (result.outcome.startsWith("rejected")) report.rejected += 1;
    log(`submitted ${target.id}`, { outcome: result.outcome });
  }

  const endBalance = ((await client.me()) as { balance: { credits: number } }).balance.credits;
  report.earnedCredits = endBalance - startBalance;
  return report;
}

async function reviewRound(
  client: ArenaClient,
  judge: NonNullable<WorkerOptions["judge"]>,
  log: (m: string, d?: unknown) => void,
): Promise<number> {
  const { submissions } = await client.reviewQueue();
  let reviewed = 0;
  for (const submission of submissions.slice(0, 5)) {
    const call = await judge(submission);
    if (!call) continue;
    try {
      const res = await client.review(submission.id, call.verdict, call.rationale, `review:${submission.id}`);
      reviewed += 1;
      log(`reviewed ${submission.id}`, { verdict: call.verdict, settled: res.settled });
    } catch (err) {
      if (!(err instanceof ArenaApiError)) throw err;
      log(`review skipped for ${submission.id}`, { code: err.code });
    }
  }
  return reviewed;
}
