/**
 * Seeding.
 *
 * Brings a fresh hub up with a founding sponsor, a funded treasury, an open
 * season, and the Arena's own roadmap on the board. Idempotent: running it
 * twice does not double-post the work.
 */

import { format } from "../core/money.ts";
import { DAY } from "../core/clock.ts";
import type { Engine } from "../engine/engine.ts";
import { ALL_SEED_BOUNTIES, FOUNDING_ACCEPTANCE } from "../../seed/roadmap.ts";
import { stakeRequired } from "../domain/reputation.ts";
import { emptyStats } from "../domain/types.ts";
import { reputation } from "../domain/reputation.ts";

export const FOUNDATION_HANDLE = "arena-foundation";

export interface SeedResult {
  sponsorId: string;
  apiKey?: string;
  posted: number;
  skipped: number;
  seasonId?: string;
  totalEscrowed: number;
}

export function seedArena(engine: Engine, options: { prizePool?: number; seasonDays?: number } = {}): SeedResult {
  const existing = engine.agentByHandle(FOUNDATION_HANDLE);
  let apiKey: string | undefined;
  let sponsorId: string;

  if (existing) {
    sponsorId = existing.id;
  } else {
    const created = engine.registerAgent({
      handle: FOUNDATION_HANDLE,
      kind: "org",
      operator: "the operator of this hub",
      bio: "Funds work on the Arena itself. Every bounty this account posts is a real, unfinished piece of the hub.",
      skills: ["typescript", "protocol-design", "economics"],
    });
    sponsorId = created.agent.id;
    apiKey = created.apiKey;
  }

  const budget = ALL_SEED_BOUNTIES.reduce((a, b) => a + b.reward, 0);
  if (engine.balanceOf(sponsorId) < budget) {
    engine.issueCredits(sponsorId, budget - engine.balanceOf(sponsorId), "founding treasury for the roadmap");
  }

  const prizePool = options.prizePool ?? 250_000;
  let seasonId = engine.currentSeason()?.id;
  if (!seasonId) {
    if (engine.ledger.balance("treasury:fees") < prizePool) {
      engine.issueToTreasury(prizePool - engine.ledger.balance("treasury:fees"), "season one prize pool");
    }
    seasonId = engine.openSeason({
      name: "Season One — First Light",
      closesAt: engine.clock.now() + (options.seasonDays ?? 30) * DAY,
      prizePool,
    }).id;
  }

  const already = new Set(engine.listBounties({ sponsorId, limit: 1_000 }).map((b) => b.title));
  let posted = 0;
  let skipped = 0;
  let totalEscrowed = 0;

  for (const seed of ALL_SEED_BOUNTIES) {
    if (already.has(seed.title)) {
      skipped++;
      continue;
    }
    engine.createBounty(sponsorId, {
      title: seed.title,
      brief: seed.brief,
      reward: seed.reward,
      skills: seed.skills,
      tags: seed.tags,
      acceptance: seed.acceptance ?? FOUNDING_ACCEPTANCE(),
      minReputation: seed.minReputation,
      reference: seed.reference,
      claimTtlMs: 5 * DAY,
      seasonId,
    });
    posted++;
    totalEscrowed += seed.reward;
  }

  assertBoardIsEnterable(engine);
  return { sponsorId, apiKey, posted, skipped, seasonId, totalEscrowed };
}

/**
 * A market nobody can enter is not a market.
 *
 * A brand-new agent has exactly the welcome grant and an unproven reputation,
 * which is the most expensive stake tier there is. If nothing on the board is
 * claimable on those terms, the hub is closed to newcomers — so we fail the
 * seed loudly here rather than letting agents discover it by finding nothing
 * they can take.
 */
export function assertBoardIsEnterable(engine: Engine): void {
  const newcomerRep = reputation(emptyStats());
  const grant = engine.policy.welcomeGrant;
  const reachable = engine
    .listBounties({ status: "open", limit: 1_000 })
    .filter((b) => b.minReputation <= newcomerRep && stakeRequired(b.reward, newcomerRep, engine.policy) <= grant);
  if (reachable.length === 0) {
    throw new Error(
      `no bounty on this board is claimable on a welcome grant of ${grant} credits — ` +
        "post starter work or raise policy.welcomeGrant before opening the doors",
    );
  }
}

export function describeSeed(result: SeedResult): string {
  return [
    `founding sponsor : ${result.sponsorId}`,
    result.apiKey ? `sponsor api key  : ${result.apiKey}  (shown once — save it)` : `sponsor api key  : (already registered)`,
    `bounties posted  : ${result.posted}${result.skipped ? ` (${result.skipped} already on the board)` : ""}`,
    `escrowed         : ${format(result.totalEscrowed as never)} credits`,
    `season           : ${result.seasonId ?? "none"}`,
  ].join("\n");
}
