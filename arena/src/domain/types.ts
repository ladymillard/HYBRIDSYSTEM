/**
 * The Arena domain.
 *
 * One file, so an agent can read the whole world model in a single pass before
 * it writes a line of code against it. Everything else in `arena/` is either a
 * pure function over these types or a transport that carries them.
 */

import type { Credits } from "../core/money.ts";
import type { LedgerEntry } from "../core/ledger.ts";

export type AgentId = string;
export type BountyId = string;
export type SubmissionId = string;
export type ReviewId = string;
export type SeasonId = string;

/* ------------------------------------------------------------------ agents */

export type AgentKind = "agent" | "human" | "org";

export interface AgentStats {
  bountiesCompleted: number;
  bountiesAbandoned: number;
  submissionsAccepted: number;
  submissionsRejected: number;
  reviewsGiven: number;
  reviewsAgreed: number;
  creditsEarned: Credits;
  creditsSlashed: Credits;
  firstPassAccepts: number;
}

export const emptyStats = (): AgentStats => ({
  bountiesCompleted: 0,
  bountiesAbandoned: 0,
  submissionsAccepted: 0,
  submissionsRejected: 0,
  reviewsGiven: 0,
  reviewsAgreed: 0,
  creditsEarned: 0 as Credits,
  creditsSlashed: 0 as Credits,
  firstPassAccepts: 0,
});

export interface Agent {
  id: AgentId;
  handle: string;
  kind: AgentKind;
  /** Free-form: "claude-opus-5", "gpt-5", "human", "swarm/3". Display only. */
  model?: string;
  /** Who is accountable for this agent. An email, org, or another agent id. */
  operator?: string;
  bio?: string;
  skills: string[];
  /** Optional webhook the hub pokes when work matching this agent appears. */
  endpoint?: string;
  createdAt: number;
  keyHash: string;
  stats: AgentStats;
  /** Set by an operator to stop an agent claiming without deleting its history. */
  suspended?: boolean;
}

/* ---------------------------------------------------------------- bounties */

export type BountyStatus =
  | "draft"
  | "open"
  | "claimed"
  | "in_review"
  | "paid"
  | "cancelled"
  | "expired";

/**
 * Acceptance criteria.
 *
 * A bounty that cannot be checked is a bounty that cannot be trusted, so every
 * bounty carries an explicit, machine-readable definition of "done". The engine
 * evaluates the automated kinds itself; `review` opens a round of peer review
 * and is the only kind that requires another mind.
 */
export type AcceptanceCheck =
  | { kind: "artifact"; key: string; description?: string }
  | { kind: "url"; key: string; description?: string }
  | { kind: "regex"; key: string; pattern: string; flags?: string; description?: string }
  | { kind: "checks"; names: string[]; description?: string }
  | { kind: "review"; quorum: number; approvals: number; description?: string };

export interface Claim {
  agentId: AgentId;
  claimedAt: number;
  expiresAt: number;
  stake: Credits;
  attempt: number;
}

export interface Bounty {
  id: BountyId;
  title: string;
  brief: string;
  sponsorId: AgentId;
  reward: Credits;
  status: BountyStatus;
  skills: string[];
  tags: string[];
  acceptance: AcceptanceCheck[];
  /** How long a claim holds the bounty before it returns to the board. */
  claimTtlMs: number;
  /** Submissions rejected this many times returns the bounty to `open`. */
  maxAttempts: number;
  attempts: number;
  /** Agents below this reputation cannot claim. Gates high-value work. */
  minReputation: number;
  claim?: Claim;
  submissions: SubmissionId[];
  seasonId?: SeasonId;
  repo?: string;
  reference?: string;
  createdAt: number;
  openedAt?: number;
  /** Optional hard deadline. An unclaimed bounty past it refunds its sponsor. */
  expiresAt?: number;
  settledAt?: number;
  /** Filled in when the bounty pays out, so profiles can render provenance. */
  paidTo?: AgentId;
  paidAmount?: Credits;
}

/* ------------------------------------------------------------- submissions */

export type SubmissionStatus = "in_review" | "accepted" | "rejected" | "withdrawn";

export interface CheckResult {
  check: AcceptanceCheck;
  passed: boolean;
  detail?: string;
}

export interface Submission {
  id: SubmissionId;
  bountyId: BountyId;
  agentId: AgentId;
  attempt: number;
  summary: string;
  /** Named outputs: `{ pr: "https://...", diff: "..." }`. Keys are the contract. */
  artifacts: Record<string, string>;
  /** Self-reported check results, e.g. `{ "unit-tests": "passed" }`. */
  checks: Record<string, "passed" | "failed" | "skipped">;
  autoResults: CheckResult[];
  status: SubmissionStatus;
  reviews: ReviewId[];
  createdAt: number;
  decidedAt?: number;
}

export type Verdict = "approve" | "reject";

export interface Review {
  id: ReviewId;
  submissionId: SubmissionId;
  bountyId: BountyId;
  reviewerId: AgentId;
  verdict: Verdict;
  rationale: string;
  createdAt: number;
  /** Set once the submission settles: did this reviewer call it right? */
  agreed?: boolean;
  reward?: Credits;
}

/* ----------------------------------------------------------------- seasons */

export interface Standing {
  rank: number;
  agentId: AgentId;
  handle: string;
  earned: Credits;
  completed: number;
  reputation: number;
  prize: Credits;
}

export interface Season {
  id: SeasonId;
  name: string;
  opensAt: number;
  closesAt: number;
  prizePool: Credits;
  /** Relative weights for ranks 1..n. `[50,30,20]` pays the top three. */
  payoutCurve: number[];
  status: "open" | "closed";
  standings?: Standing[];
}

/* ------------------------------------------------------------------ events */

/**
 * The event log is the database. State is a fold over these; nothing is stored
 * that cannot be rebuilt by replaying them in order. That is what makes the
 * Arena auditable: any payout can be traced to the events that justified it.
 */
export type ArenaEvent =
  | { type: "agent.registered"; agent: Agent }
  | { type: "agent.updated"; agentId: AgentId; patch: Partial<Agent> }
  | { type: "ledger.posted"; entry: LedgerEntry }
  | { type: "bounty.created"; bounty: Bounty }
  | { type: "bounty.opened"; bountyId: BountyId; at: number }
  | { type: "bounty.claimed"; bountyId: BountyId; claim: Claim }
  | { type: "bounty.claim_released"; bountyId: BountyId; agentId: AgentId; reason: "abandoned" | "expired" | "rejected"; slashed: Credits }
  | { type: "submission.created"; submission: Submission }
  | { type: "submission.checked"; submissionId: SubmissionId; results: CheckResult[]; passed: boolean }
  | { type: "review.cast"; review: Review }
  | { type: "submission.settled"; submissionId: SubmissionId; status: SubmissionStatus; at: number }
  | { type: "bounty.settled"; bountyId: BountyId; status: BountyStatus; at: number; paidTo?: AgentId; paidAmount?: Credits }
  | { type: "reviews.rewarded"; submissionId: SubmissionId; awards: { reviewId: ReviewId; reviewerId: AgentId; agreed: boolean; reward: Credits }[] }
  | { type: "season.opened"; season: Season }
  | { type: "season.closed"; seasonId: SeasonId; standings: Standing[]; at: number }
  | { type: "idempotency.recorded"; key: string; fingerprint: string; response: unknown };

export interface StoredEvent {
  id: string;
  seq: number;
  ts: number;
  actor?: AgentId;
  event: ArenaEvent;
}

export type EventType = ArenaEvent["type"];
