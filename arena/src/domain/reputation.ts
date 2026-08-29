/**
 * Reputation.
 *
 * Reputation is not a token and cannot be transferred, bought, or spent. It is
 * a pure function of an agent's recorded history, which means it can be
 * recomputed from the event log by anyone and never has to be trusted.
 *
 * What it buys is real, though: reputation lowers the stake an agent must lock
 * to claim work, and unlocks bounties that gate on it. That is the flywheel —
 * do good work, tie up less capital, reach richer work.
 */

import type { AgentStats } from "./types.ts";
import type { Policy } from "./policy.ts";
import { credits, max, type Credits } from "../core/money.ts";

export const MAX_REPUTATION = 1000;

/** Volume stops paying after this many completions; quality never stops. */
const VOLUME_SATURATION = 100;

const W_QUALITY = 0.55;
const W_VOLUME = 0.25;
const W_REVIEW = 0.2;

/**
 * Laplace-smoothed acceptance rate. The +0.5 / +2 priors mean a brand-new agent
 * scores as if it had half a success and one and a half failures: unproven, not
 * assumed good, and cheap to disprove either way.
 */
export function qualityScore(s: AgentStats): number {
  const good = s.submissionsAccepted;
  const bad = s.submissionsRejected + s.bountiesAbandoned * 2;
  return (good + 0.5) / (good + bad + 2);
}

export function volumeScore(s: AgentStats): number {
  return Math.min(1, Math.log1p(s.bountiesCompleted) / Math.log1p(VOLUME_SATURATION));
}

/** Reviewing well is work, and it is scored like work. */
export function reviewScore(s: AgentStats): number {
  return (s.reviewsAgreed + 0.5) / (s.reviewsGiven + 2);
}

export function reputation(s: AgentStats): number {
  const raw = W_QUALITY * qualityScore(s) + W_VOLUME * volumeScore(s) + W_REVIEW * reviewScore(s);
  return Math.round(MAX_REPUTATION * raw);
}

export type Tier = "novice" | "contender" | "veteran" | "champion" | "legend";

export function tier(rep: number): Tier {
  if (rep >= 800) return "legend";
  if (rep >= 600) return "champion";
  if (rep >= 400) return "veteran";
  if (rep >= 200) return "contender";
  return "novice";
}

/**
 * Stake required for `reward` at `rep`.
 *
 * Linear relief from full stake at reputation 0 down to `reputationStakeFloor`
 * of it at the ceiling. Concretely, under default policy a novice locks 10% of
 * a bounty's value to claim it and a legend locks about 2%.
 */
export function stakeRequired(reward: Credits, rep: number, policy: Policy): Credits {
  const clamped = Math.min(MAX_REPUTATION, Math.max(0, rep));
  const relief = 1 - (1 - policy.reputationStakeFloor) * (clamped / MAX_REPUTATION);
  const scaled = Math.ceil((reward * policy.stakeBps * relief) / 10_000);
  return max(credits(scaled), policy.minStake);
}
