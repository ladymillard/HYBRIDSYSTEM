/**
 * Wire shapes.
 *
 * Handlers never return domain objects straight from state. Everything the API
 * emits passes through here, which is what keeps `keyHash` off the wire and
 * gives agents the derived numbers they would otherwise have to recompute —
 * what a claim would cost *them*, how long is left, what "done" means.
 */

import { format, type Credits } from "../core/money.ts";
import { durationToString } from "../core/clock.ts";
import { reputation, stakeRequired, tier } from "../domain/reputation.ts";
import { describeCheck } from "../domain/verify.ts";
import type { Agent, Bounty, Review, Season, Standing, Submission } from "../domain/types.ts";
import type { Engine } from "../engine/engine.ts";

export const money = (c: Credits) => ({ credits: c, display: format(c) });

export function agentView(engine: Engine, agent: Agent) {
  const rep = reputation(agent.stats);
  return {
    id: agent.id,
    handle: agent.handle,
    kind: agent.kind,
    model: agent.model,
    operator: agent.operator,
    bio: agent.bio,
    skills: agent.skills,
    createdAt: agent.createdAt,
    reputation: rep,
    tier: tier(rep),
    stats: agent.stats,
    earned: money(agent.stats.creditsEarned),
    suspended: agent.suspended ?? false,
  };
}

export function privateAgentView(engine: Engine, agent: Agent) {
  return {
    ...agentView(engine, agent),
    balance: money(engine.balanceOf(agent.id)),
    staked: money(engine.stakedBy(agent.id)),
    activeClaims: engine.activeClaims(agent.id).map((b) => ({ id: b.id, title: b.title, expiresAt: b.claim?.expiresAt })),
  };
}

export function bountyView(engine: Engine, bounty: Bounty, viewer?: Agent) {
  const sponsor = engine.agent(bounty.sponsorId);
  const rep = viewer ? reputation(viewer.stats) : 0;
  const stake = stakeRequired(bounty.reward, rep, engine.policy);
  const now = engine.clock.now();
  return {
    id: bounty.id,
    title: bounty.title,
    brief: bounty.brief,
    status: bounty.status,
    reward: money(bounty.reward),
    sponsor: sponsor ? { id: sponsor.id, handle: sponsor.handle } : { id: bounty.sponsorId, handle: "unknown" },
    skills: bounty.skills,
    tags: bounty.tags,
    acceptance: bounty.acceptance.map((c) => ({ ...c, requirement: describeCheck(c) })),
    minReputation: bounty.minReputation,
    attempts: bounty.attempts,
    maxAttempts: bounty.maxAttempts,
    claimTtl: durationToString(bounty.claimTtlMs),
    claimTtlMs: bounty.claimTtlMs,
    repo: bounty.repo,
    reference: bounty.reference,
    seasonId: bounty.seasonId,
    createdAt: bounty.createdAt,
    openedAt: bounty.openedAt,
    expiresAt: bounty.expiresAt,
    settledAt: bounty.settledAt,
    paidTo: bounty.paidTo,
    paidAmount: bounty.paidAmount === undefined ? undefined : money(bounty.paidAmount),
    claim: bounty.claim
      ? {
          agentId: bounty.claim.agentId,
          handle: engine.agent(bounty.claim.agentId)?.handle,
          claimedAt: bounty.claim.claimedAt,
          expiresAt: bounty.claim.expiresAt,
          expiresIn: durationToString(Math.max(0, bounty.claim.expiresAt - now)),
          stake: money(bounty.claim.stake),
          attempt: bounty.claim.attempt,
        }
      : undefined,
    submissions: bounty.submissions,
    /** What this specific caller would have to lock up to claim it. */
    yourStake: viewer ? money(stake) : undefined,
    youCanClaim: viewer
      ? bounty.status === "open" &&
        bounty.sponsorId !== viewer.id &&
        rep >= bounty.minReputation &&
        engine.balanceOf(viewer.id) >= stake
      : undefined,
  };
}

export function submissionView(engine: Engine, s: Submission) {
  return {
    id: s.id,
    bountyId: s.bountyId,
    agent: (() => {
      const a = engine.agent(s.agentId);
      return a ? { id: a.id, handle: a.handle } : { id: s.agentId, handle: "unknown" };
    })(),
    attempt: s.attempt,
    summary: s.summary,
    artifacts: s.artifacts,
    checks: s.checks,
    autoResults: s.autoResults.map((r) => ({
      requirement: describeCheck(r.check),
      passed: r.passed,
      detail: r.detail,
    })),
    status: s.status,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt,
    reviews: engine.reviewsFor(s.id).map((r) => reviewView(engine, r)),
  };
}

export function reviewView(engine: Engine, r: Review) {
  const a = engine.agent(r.reviewerId);
  return {
    id: r.id,
    reviewer: a ? { id: a.id, handle: a.handle } : { id: r.reviewerId, handle: "unknown" },
    verdict: r.verdict,
    rationale: r.rationale,
    createdAt: r.createdAt,
    agreed: r.agreed,
    reward: r.reward === undefined ? undefined : money(r.reward),
  };
}

export function standingView(s: Standing) {
  return { ...s, earned: money(s.earned), prize: money(s.prize) };
}

export function seasonView(season: Season, standings?: Standing[]) {
  return {
    id: season.id,
    name: season.name,
    status: season.status,
    opensAt: season.opensAt,
    closesAt: season.closesAt,
    prizePool: money(season.prizePool),
    payoutCurve: season.payoutCurve,
    standings: (season.standings ?? standings ?? []).map(standingView),
  };
}
