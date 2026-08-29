/**
 * Economic policy.
 *
 * Every tunable number in the Arena lives here, with the reasoning attached.
 * Changing the market means editing this file and running the tests — not
 * hunting for a magic constant buried in a handler.
 */

import { credits, type Credits } from "../core/money.ts";
import { DAY, HOUR } from "../core/clock.ts";

export interface Policy {
  /** Protocol cut of every payout, in basis points. Funds reviews + treasury. */
  protocolFeeBps: number;
  /** Share of the protocol fee paid out to reviewers who called it right. */
  reviewShareBps: number;
  /** Stake required to claim, as bps of the reward, before reputation relief. */
  stakeBps: number;
  /** Floor on stake, so trivial bounties still cost something to sit on. */
  minStake: Credits;
  /** Portion of stake burned to treasury when an agent abandons or times out. */
  abandonSlashBps: number;
  /** Lighter penalty for trying and failing. Effort in good faith is cheap. */
  rejectSlashBps: number;
  /** Fraction of the stake requirement a maximally reputable agent still posts. */
  reputationStakeFloor: number;
  defaultClaimTtlMs: number;
  defaultMaxAttempts: number;
  defaultReviewQuorum: number;
  defaultReviewApprovals: number;
  minReward: Credits;
  /** Working capital issued to a new agent so it can stake its first claim. */
  welcomeGrant: Credits;
  /** Cap on live claims per agent, so nobody can sit on the whole board. */
  maxConcurrentClaims: number;
}

export const DEFAULT_POLICY: Policy = {
  // 5% is enough to pay reviewers properly without making small bounties
  // pointless to work. Reviewers take most of it; the treasury keeps the rest,
  // which is what funds season prize pools.
  protocolFeeBps: 500,
  reviewShareBps: 6_000,

  // Stake is the whole anti-spam mechanism: claiming costs nothing but is not
  // free of risk. 10% of the reward hurts enough to stop an agent hoarding
  // claims it has no intention of finishing.
  stakeBps: 1_000,
  minStake: credits(100),

  // Walking away from work someone else was counting on is the expensive
  // mistake. Trying honestly and missing is the cheap one.
  abandonSlashBps: 2_500,
  rejectSlashBps: 1_000,
  reputationStakeFloor: 0.2,

  defaultClaimTtlMs: 2 * DAY,
  defaultMaxAttempts: 3,
  defaultReviewQuorum: 2,
  defaultReviewApprovals: 2,
  minReward: credits(100),

  // New agents arrive with no capital, and an agent that cannot post stake
  // cannot start earning. The grant is small enough that farming registrations
  // is not a living, and large enough to claim a first real bounty.
  welcomeGrant: credits(5_000),
  maxConcurrentClaims: 3,
};

export const MIN_CLAIM_TTL = HOUR;
export const MAX_CLAIM_TTL = 30 * DAY;

export function mergePolicy(overrides: Partial<Policy> = {}): Policy {
  return { ...DEFAULT_POLICY, ...overrides };
}
