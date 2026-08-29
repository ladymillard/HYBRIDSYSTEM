/**
 * The Arena engine.
 *
 * Commands in, events out, money conserved. Every public method here is either
 * a query over folded state or a command that validates, plans its ledger
 * movements, and only then writes. There is no path that mutates a balance
 * without an event, and no event that reaches state without going through the
 * ledger's balanced/solvent checks first.
 */

import { type Clock, systemClock } from "../core/clock.ts";
import { ArenaError, badRequest, conflict, forbidden, notFound } from "../core/errors.ts";
import { fingerprint, hashKey, newApiKey, newId, PREFIXES } from "../core/ids.ts";
import { acct, type Account, type LedgerEntry, MINT, transfer } from "../core/ledger.ts";
import {
  add,
  bps,
  type Credits,
  credits,
  feeSplit,
  positiveCredits,
  sub,
  weightedSplit,
  ZERO,
} from "../core/money.ts";
import { DEFAULT_POLICY, MAX_CLAIM_TTL, MIN_CLAIM_TTL, mergePolicy, type Policy } from "../domain/policy.ts";
import { reputation, stakeRequired, tier, type Tier } from "../domain/reputation.ts";
import type {
  Agent,
  AgentId,
  AgentKind,
  ArenaEvent,
  Bounty,
  BountyId,
  Claim,
  Review,
  Season,
  Standing,
  StoredEvent,
  Submission,
  SubmissionId,
  Verdict,
} from "../domain/types.ts";
import { emptyStats } from "../domain/types.ts";
import { evaluate, validateAcceptance } from "../domain/verify.ts";
import { MemoryStore, type Store } from "../store/store.ts";
import { applyEvent, emptyState, type State } from "./state.ts";

const HANDLE_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/i;

export interface EngineOptions {
  store?: Store;
  clock?: Clock;
  policy?: Partial<Policy>;
}

export interface RegisterInput {
  handle: string;
  kind?: AgentKind;
  model?: string;
  operator?: string;
  bio?: string;
  skills?: string[];
  endpoint?: string;
}

export interface CreateBountyInput {
  title: string;
  brief: string;
  reward: number;
  skills?: string[];
  tags?: string[];
  acceptance?: Bounty["acceptance"];
  claimTtlMs?: number;
  maxAttempts?: number;
  minReputation?: number;
  seasonId?: string;
  repo?: string;
  reference?: string;
  expiresAt?: number;
  draft?: boolean;
}

export interface SubmitInput {
  summary: string;
  artifacts?: Record<string, string>;
  checks?: Record<string, "passed" | "failed" | "skipped">;
}

export interface Profile {
  agent: Omit<Agent, "keyHash">;
  reputation: number;
  tier: Tier;
  balance: Credits;
  staked: Credits;
  activeClaims: BountyId[];
}

export interface BountyFilter {
  status?: Bounty["status"] | "available";
  skill?: string;
  sponsorId?: AgentId;
  claimedBy?: AgentId;
  seasonId?: string;
  minReward?: number;
  q?: string;
  limit?: number;
}

export class Engine {
  readonly policy: Policy;
  readonly clock: Clock;
  private readonly store: Store;
  private state: State;

  constructor(options: EngineOptions = {}) {
    this.store = options.store ?? new MemoryStore();
    this.clock = options.clock ?? systemClock;
    this.policy = mergePolicy(options.policy);
    this.state = emptyState();
    for (const e of this.store.load()) applyEvent(this.state, e);
  }

  /* ------------------------------------------------------------- plumbing */

  private now(): number {
    return this.clock.now();
  }

  /**
   * Atomically commit a command's events.
   *
   * Ledger movements are simulated against current balances *before* anything
   * is written, so a command either lands whole or throws having changed
   * nothing. This is the only reason it is safe to let handlers build a list of
   * events and hand it over in one go.
   */
  private commit(actor: AgentId | undefined, events: ArenaEvent[]): StoredEvent[] {
    this.simulateLedger(events);
    const ts = this.now();
    const stored: StoredEvent[] = events.map((event, i) => ({
      id: newId(PREFIXES.event),
      seq: this.state.seq + i + 1,
      ts,
      actor,
      event,
    }));
    this.store.append(stored);
    for (const s of stored) applyEvent(this.state, s);
    this.state.ledger.assertConserved();
    return stored;
  }

  /** Dry-run every ledger leg in this batch against a shadow balance sheet. */
  private simulateLedger(events: ArenaEvent[]): void {
    const deltas = new Map<Account, number>();
    for (const event of events) {
      if (event.type !== "ledger.posted") continue;
      const entry = event.entry;
      const total = entry.legs.reduce((a, l) => a + l.delta, 0);
      if (total !== 0) {
        throw new ArenaError("ledger_imbalance", "entry legs must sum to zero", { kind: entry.kind, total });
      }
      for (const leg of entry.legs) {
        const running = (deltas.get(leg.account) ?? 0) + leg.delta;
        deltas.set(leg.account, running);
        if (leg.account === MINT) continue;
        if (this.state.ledger.balance(leg.account) + running < 0) {
          throw new ArenaError("insufficient_funds", `account ${leg.account} has insufficient funds`, {
            account: leg.account,
            balance: this.state.ledger.balance(leg.account),
            required: -(this.state.ledger.balance(leg.account) + running),
          });
        }
      }
    }
  }

  private post(
    kind: string,
    from: Account,
    to: Account,
    amount: Credits,
    refs?: Record<string, string>,
    memo?: string,
  ): ArenaEvent {
    const entry: LedgerEntry = transfer(newId(PREFIXES.entry), this.now(), kind, from, to, amount, refs, memo);
    return { type: "ledger.posted", entry };
  }

  /* -------------------------------------------------------------- queries */

  get ledger() {
    return this.state.ledger;
  }

  agent(id: AgentId): Agent | undefined {
    return this.state.agents.get(id);
  }

  requireAgent(id: AgentId): Agent {
    const a = this.agent(id);
    if (!a) throw notFound("agent", id);
    return a;
  }

  /** Every registered agent, newest first. */
  allAgents(): Agent[] {
    return [...this.state.agents.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  agentByHandle(handle: string): Agent | undefined {
    const id = this.state.handles.get(handle.toLowerCase());
    return id ? this.state.agents.get(id) : undefined;
  }

  /**
   * Resolve an API key to its agent.
   *
   * The lookup is by hash, so the plaintext key is never held anywhere and the
   * cost does not grow with the number of registered agents.
   */
  authenticate(key: string): Agent | undefined {
    const agentId = this.state.keys.get(hashKey(key));
    return agentId ? this.state.agents.get(agentId) : undefined;
  }

  reputationOf(id: AgentId): number {
    const a = this.agent(id);
    return a ? reputation(a.stats) : 0;
  }

  balanceOf(id: AgentId): Credits {
    return this.state.ledger.balance(acct.agent(id));
  }

  stakedBy(id: AgentId): Credits {
    return this.state.ledger.balance(acct.stake(id));
  }

  activeClaims(id: AgentId): Bounty[] {
    return [...this.state.bounties.values()].filter(
      (b) => b.claim?.agentId === id && (b.status === "claimed" || b.status === "in_review"),
    );
  }

  profile(id: AgentId): Profile {
    const a = this.requireAgent(id);
    const { keyHash: _omit, ...rest } = a;
    const rep = reputation(a.stats);
    return {
      agent: rest,
      reputation: rep,
      tier: tier(rep),
      balance: this.balanceOf(id),
      staked: this.stakedBy(id),
      activeClaims: this.activeClaims(id).map((b) => b.id),
    };
  }

  bounty(id: BountyId): Bounty | undefined {
    return this.state.bounties.get(id);
  }

  requireBounty(id: BountyId): Bounty {
    const b = this.bounty(id);
    if (!b) throw notFound("bounty", id);
    return b;
  }

  listBounties(filter: BountyFilter = {}): Bounty[] {
    const q = filter.q?.toLowerCase();
    let out = [...this.state.bounties.values()].filter((b) => {
      if (filter.status === "available") {
        if (b.status !== "open") return false;
      } else if (filter.status && b.status !== filter.status) return false;
      if (filter.skill && !b.skills.some((s) => s.toLowerCase() === filter.skill!.toLowerCase())) return false;
      if (filter.sponsorId && b.sponsorId !== filter.sponsorId) return false;
      if (filter.claimedBy && b.claim?.agentId !== filter.claimedBy) return false;
      if (filter.seasonId && b.seasonId !== filter.seasonId) return false;
      if (filter.minReward !== undefined && b.reward < filter.minReward) return false;
      if (q && !(`${b.title} ${b.brief} ${b.tags.join(" ")}`.toLowerCase().includes(q))) return false;
      return true;
    });
    out = out.sort((a, b) => b.reward - a.reward || b.createdAt - a.createdAt);
    return filter.limit ? out.slice(0, filter.limit) : out;
  }

  submission(id: SubmissionId): Submission | undefined {
    return this.state.submissions.get(id);
  }

  requireSubmission(id: SubmissionId): Submission {
    const s = this.submission(id);
    if (!s) throw notFound("submission", id);
    return s;
  }

  submissionsFor(bountyId: BountyId): Submission[] {
    return this.requireBounty(bountyId)
      .submissions.map((id) => this.state.submissions.get(id))
      .filter((s): s is Submission => Boolean(s));
  }

  reviewsFor(submissionId: SubmissionId): Review[] {
    const s = this.requireSubmission(submissionId);
    return s.reviews.map((id) => this.state.reviews.get(id)).filter((r): r is Review => Boolean(r));
  }

  seasons(): Season[] {
    return [...this.state.seasons.values()].sort((a, b) => b.opensAt - a.opensAt);
  }

  season(id: string): Season | undefined {
    return this.state.seasons.get(id);
  }

  currentSeason(): Season | undefined {
    return this.seasons().find((s) => s.status === "open");
  }

  leaderboard(limit = 25): Standing[] {
    const rows = [...this.state.agents.values()]
      .map((a) => ({
        rank: 0,
        agentId: a.id,
        handle: a.handle,
        earned: a.stats.creditsEarned,
        completed: a.stats.bountiesCompleted,
        reputation: reputation(a.stats),
        prize: ZERO,
      }))
      .filter((r) => r.completed > 0 || r.earned > 0)
      .sort((a, b) => b.earned - a.earned || b.completed - a.completed || a.agentId.localeCompare(b.agentId));
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows.slice(0, limit);
  }

  /**
   * The public activity feed, and the sync primitive for agents: poll with the
   * last `seq` you saw and you will not miss a state change. Served from the
   * hot buffer; anything older than that lives in the log file.
   */
  events(since = 0, limit = 100): StoredEvent[] {
    const hot = this.state.recent.filter((e) => e.seq > since);
    if (hot.length > 0 || since >= this.state.seq) return hot.slice(0, limit);
    return this.store
      .load()
      .filter((e) => e.seq > since)
      .slice(0, limit);
  }

  marketStats() {
    const bounties = [...this.state.bounties.values()];
    const open = bounties.filter((b) => b.status === "open");
    const paid = bounties.filter((b) => b.status === "paid");
    return {
      agents: this.state.agents.size,
      bounties: bounties.length,
      openBounties: open.length,
      openValue: open.reduce((a, b) => a + b.reward, 0) as Credits,
      paidBounties: paid.length,
      paidValue: paid.reduce((a, b) => a + (b.paidAmount ?? 0), 0) as Credits,
      escrowed: bounties
        .filter((b) => ["open", "claimed", "in_review"].includes(b.status))
        .reduce((a, b) => a + this.state.ledger.balance(acct.escrow(b.id)), 0) as Credits,
      treasury: this.state.ledger.balance(acct.treasury()),
      // Season prize pools are locked away from both agents and the treasury,
      // so they get their own line rather than hiding inside another number.
      pools: this.state.ledger
        .accounts("pool:")
        .reduce((a, account) => a + this.state.ledger.balance(account), 0) as Credits,
      supply: this.state.ledger.supply(),
      seq: this.state.seq,
      seasons: this.state.seasons.size,
    };
  }

  /** Idempotency bookkeeping, so a retrying agent never double-spends. */
  lookupIdempotent(key: string, request: unknown): unknown | undefined {
    const found = this.state.idempotency.get(key);
    if (!found) return undefined;
    if (found.fingerprint !== fingerprint(request)) {
      throw conflict("idempotency key reused with a different request body", { key });
    }
    return found.response;
  }

  recordIdempotent(key: string, request: unknown, response: unknown): void {
    this.commit(undefined, [
      { type: "idempotency.recorded", key, fingerprint: fingerprint(request), response },
    ]);
  }

  /* ------------------------------------------------------------- commands */

  registerAgent(input: RegisterInput): { agent: Agent; apiKey: string } {
    const handle = String(input.handle ?? "").trim();
    if (!HANDLE_RE.test(handle)) {
      throw badRequest("handle must be 3-32 chars of letters, digits, dot, dash or underscore", { handle });
    }
    if (this.state.handles.has(handle.toLowerCase())) {
      throw conflict("handle is taken", { handle });
    }
    const id = newId(PREFIXES.agent);
    const { key, hash } = newApiKey(id);
    const agent: Agent = {
      id,
      handle,
      kind: input.kind ?? "agent",
      model: input.model,
      operator: input.operator,
      bio: input.bio,
      skills: (input.skills ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 16),
      endpoint: input.endpoint,
      createdAt: this.now(),
      keyHash: hash,
      stats: emptyStats(),
    };

    const events: ArenaEvent[] = [{ type: "agent.registered", agent }];
    if (this.policy.welcomeGrant > 0) {
      events.push(
        this.post("grant.welcome", MINT, acct.agent(id), this.policy.welcomeGrant, { agentId: id }, "welcome grant"),
      );
    }
    this.commit(id, events);
    return { agent, apiKey: key };
  }

  updateAgent(agentId: AgentId, patch: Partial<Pick<Agent, "bio" | "skills" | "endpoint" | "model" | "operator">>): Agent {
    this.requireAgent(agentId);
    const clean: Partial<Agent> = {};
    if (patch.bio !== undefined) clean.bio = String(patch.bio).slice(0, 2000);
    if (patch.model !== undefined) clean.model = String(patch.model).slice(0, 120);
    if (patch.operator !== undefined) clean.operator = String(patch.operator).slice(0, 200);
    if (patch.endpoint !== undefined) clean.endpoint = String(patch.endpoint).slice(0, 500);
    if (patch.skills !== undefined) {
      clean.skills = patch.skills.map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 16);
    }
    this.commit(agentId, [{ type: "agent.updated", agentId, patch: clean }]);
    return this.requireAgent(agentId);
  }

  /**
   * Issue credits. This is the only way money enters the system, it is an
   * operator action, and it is fully visible: `system:mint` goes more negative
   * by exactly this amount and anyone can read that number.
   */
  issueCredits(toAgentId: AgentId, amount: number, memo = "issuance"): Credits {
    this.requireAgent(toAgentId);
    const value = positiveCredits(amount);
    this.commit(undefined, [this.post("mint", MINT, acct.agent(toAgentId), value, { agentId: toAgentId }, memo)]);
    return this.balanceOf(toAgentId);
  }

  /** Fund the treasury directly — used to seed season prize pools. */
  issueToTreasury(amount: number, memo = "treasury issuance"): Credits {
    const value = positiveCredits(amount);
    this.commit(undefined, [this.post("mint", MINT, acct.treasury(), value, {}, memo)]);
    return this.state.ledger.balance(acct.treasury());
  }

  createBounty(sponsorId: AgentId, input: CreateBountyInput): Bounty {
    this.requireAgent(sponsorId);
    const title = String(input.title ?? "").trim();
    const brief = String(input.brief ?? "").trim();
    if (title.length < 4) throw badRequest("title must be at least 4 characters");
    if (brief.length < 20) {
      throw badRequest("brief must be at least 20 characters — an agent has to be able to act on it alone");
    }
    const reward = positiveCredits(input.reward, "reward");
    if (reward < this.policy.minReward) {
      throw badRequest(`reward must be at least ${this.policy.minReward} credits`, { minReward: this.policy.minReward });
    }
    if (this.balanceOf(sponsorId) < reward) {
      throw new ArenaError("insufficient_funds", "sponsor cannot cover the reward", {
        balance: this.balanceOf(sponsorId),
        reward,
      });
    }

    const acceptance = input.acceptance ?? [
      {
        kind: "review" as const,
        quorum: this.policy.defaultReviewQuorum,
        approvals: this.policy.defaultReviewApprovals,
      },
    ];
    const problems = validateAcceptance(acceptance);
    if (problems.length) throw badRequest(`invalid acceptance criteria: ${problems.join("; ")}`, { problems });

    const claimTtlMs = input.claimTtlMs ?? this.policy.defaultClaimTtlMs;
    if (claimTtlMs < MIN_CLAIM_TTL || claimTtlMs > MAX_CLAIM_TTL) {
      throw badRequest("claimTtlMs must be between one hour and thirty days", { claimTtlMs });
    }
    if (input.seasonId) {
      const season = this.season(input.seasonId);
      if (!season) throw notFound("season", input.seasonId);
      if (season.status !== "open") throw conflict("season is closed", { seasonId: input.seasonId });
    }

    const now = this.now();
    const bounty: Bounty = {
      id: newId(PREFIXES.bounty),
      title,
      brief,
      sponsorId,
      reward,
      status: input.draft ? "draft" : "open",
      skills: (input.skills ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 12),
      tags: (input.tags ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 12),
      acceptance,
      claimTtlMs,
      maxAttempts: input.maxAttempts ?? this.policy.defaultMaxAttempts,
      attempts: 0,
      minReputation: input.minReputation ?? 0,
      submissions: [],
      seasonId: input.seasonId ?? this.currentSeason()?.id,
      repo: input.repo,
      reference: input.reference,
      createdAt: now,
      openedAt: input.draft ? undefined : now,
      expiresAt: input.expiresAt,
    };

    this.commit(sponsorId, [
      { type: "bounty.created", bounty },
      // Escrow up front. A bounty nobody has funded is an advertisement, and
      // agents should not have to tell the difference at claim time.
      this.post("bounty.fund", acct.agent(sponsorId), acct.escrow(bounty.id), reward, { bountyId: bounty.id }),
    ]);
    return this.requireBounty(bounty.id);
  }

  publishBounty(bountyId: BountyId, actorId: AgentId): Bounty {
    const b = this.requireBounty(bountyId);
    if (b.sponsorId !== actorId) throw forbidden("only the sponsor can publish this bounty");
    if (b.status !== "draft") throw new ArenaError("invalid_transition", "bounty is not a draft", { status: b.status });
    this.commit(actorId, [{ type: "bounty.opened", bountyId, at: this.now() }]);
    return this.requireBounty(bountyId);
  }

  claimBounty(bountyId: BountyId, agentId: AgentId): Claim {
    const b = this.requireBounty(bountyId);
    const agent = this.requireAgent(agentId);
    if (agent.suspended) throw forbidden("agent is suspended");
    if (b.status !== "open") {
      throw new ArenaError("invalid_transition", `bounty is ${b.status}, not open`, { status: b.status });
    }
    if (b.sponsorId === agentId) throw forbidden("a sponsor cannot claim its own bounty");

    const rep = reputation(agent.stats);
    if (rep < b.minReputation) {
      throw forbidden("reputation below this bounty's floor", { reputation: rep, required: b.minReputation });
    }
    const live = this.activeClaims(agentId);
    if (live.length >= this.policy.maxConcurrentClaims) {
      throw conflict("too many live claims — finish or release one first", {
        limit: this.policy.maxConcurrentClaims,
        claims: live.map((x) => x.id),
      });
    }

    const stake = stakeRequired(b.reward, rep, this.policy);
    if (this.balanceOf(agentId) < stake) {
      throw new ArenaError("insufficient_stake", "not enough credits to post the required stake", {
        required: stake,
        balance: this.balanceOf(agentId),
      });
    }

    const now = this.now();
    const claim: Claim = {
      agentId,
      claimedAt: now,
      expiresAt: now + b.claimTtlMs,
      stake,
      attempt: b.attempts + 1,
    };
    this.commit(agentId, [
      { type: "bounty.claimed", bountyId, claim },
      this.post("stake.lock", acct.agent(agentId), acct.stake(agentId), stake, { bountyId, agentId }),
    ]);
    return claim;
  }

  /** Voluntary walk-away. Costs the abandon slash — the same as timing out. */
  releaseClaim(bountyId: BountyId, agentId: AgentId): Bounty {
    const b = this.requireBounty(bountyId);
    if (!b.claim || b.claim.agentId !== agentId) throw forbidden("you do not hold this claim");
    if (b.status !== "claimed") {
      throw new ArenaError("invalid_transition", `cannot release a bounty that is ${b.status}`, { status: b.status });
    }
    this.commit(agentId, this.unwindClaim(b, "abandoned", this.policy.abandonSlashBps, []));
    return this.requireBounty(bountyId);
  }

  /**
   * Return a claim's stake, minus a slash, and hand the bounty back to the
   * board. `beneficiaries` are reviewers whose call was vindicated; they split
   * the review share of whatever was slashed, which is what keeps review paid
   * even when a submission fails.
   */
  private unwindClaim(
    b: Bounty,
    reason: "abandoned" | "expired" | "rejected",
    slashBps: number,
    beneficiaries: { reviewId: string; reviewerId: AgentId; agreed: boolean }[],
    submissionId?: SubmissionId,
  ): ArenaEvent[] {
    const claim = b.claim;
    if (!claim) return [];
    const slash = bps(claim.stake, slashBps);
    const refund = sub(claim.stake, slash);
    const events: ArenaEvent[] = [
      { type: "bounty.claim_released", bountyId: b.id, agentId: claim.agentId, reason, slashed: slash },
    ];
    if (refund > 0) {
      events.push(
        this.post("stake.release", acct.stake(claim.agentId), acct.agent(claim.agentId), refund, {
          bountyId: b.id,
          agentId: claim.agentId,
        }),
      );
    }
    if (slash > 0) {
      events.push(
        this.post("stake.slash", acct.stake(claim.agentId), acct.treasury(), slash, {
          bountyId: b.id,
          agentId: claim.agentId,
          reason,
        }),
      );
      events.push(...this.rewardReviewers(b, slash, beneficiaries, "review.reward.slash", submissionId));
    }
    return events;
  }

  /** Split a review pool among the reviewers who called the outcome correctly. */
  private rewardReviewers(
    b: Bounty,
    source: Credits,
    reviewers: { reviewId: string; reviewerId: AgentId; agreed: boolean }[],
    kind: string,
    submissionId?: SubmissionId,
  ): ArenaEvent[] {
    if (reviewers.length === 0) return [];
    const winners = reviewers.filter((r) => r.agreed);
    const pool = bps(source, this.policy.reviewShareBps);
    const shares = winners.length > 0 ? weightedSplit(pool, winners.map(() => 1)) : [];
    const events: ArenaEvent[] = [];
    const awards = reviewers.map((r) => {
      const i = winners.findIndex((w) => w.reviewId === r.reviewId);
      const reward = i >= 0 ? shares[i] : ZERO;
      return { reviewId: r.reviewId, reviewerId: r.reviewerId, agreed: r.agreed, reward };
    });
    for (const award of awards) {
      if (award.reward > 0) {
        events.push(
          this.post(kind, acct.treasury(), acct.agent(award.reviewerId), award.reward, {
            bountyId: b.id,
            reviewId: award.reviewId,
          }),
        );
      }
    }
    if (submissionId) events.push({ type: "reviews.rewarded", submissionId, awards });
    return events;
  }

  submitWork(bountyId: BountyId, agentId: AgentId, input: SubmitInput): { submission: Submission; outcome: string } {
    const b = this.requireBounty(bountyId);
    this.requireAgent(agentId);
    if (!b.claim || b.claim.agentId !== agentId) throw forbidden("you do not hold this claim");
    if (b.status !== "claimed") {
      throw new ArenaError("invalid_transition", `bounty is ${b.status}`, { status: b.status });
    }
    if (b.claim.expiresAt <= this.now()) {
      throw new ArenaError("invalid_transition", "claim has expired — run tick or reclaim the bounty");
    }
    const summary = String(input.summary ?? "").trim();
    if (summary.length < 10) throw badRequest("summary must describe the work in at least 10 characters");

    const submission: Submission = {
      id: newId(PREFIXES.submission),
      bountyId,
      agentId,
      attempt: b.claim.attempt,
      summary,
      artifacts: sanitizeRecord(input.artifacts ?? {}, 64, 4000),
      checks: sanitizeRecord(input.checks ?? {}, 64, 16) as Submission["checks"],
      autoResults: [],
      status: "in_review",
      reviews: [],
      createdAt: this.now(),
    };

    const evaluation = evaluate(b, submission);
    const events: ArenaEvent[] = [
      { type: "submission.created", submission },
      { type: "submission.checked", submissionId: submission.id, results: evaluation.results, passed: evaluation.autoPassed },
    ];

    if (!evaluation.autoPassed) {
      // Deterministic checks failed. No reviewer time is spent on work that
      // does not meet criteria the bounty stated in advance.
      events.push(...this.settleRejectEvents(b, submission, []));
      this.commit(agentId, events);
      return { submission: this.requireSubmission(submission.id), outcome: "rejected_by_checks" };
    }
    if (!evaluation.review) {
      events.push(...this.settleAcceptEvents(b, submission, []));
      this.commit(agentId, events);
      return { submission: this.requireSubmission(submission.id), outcome: "accepted" };
    }
    this.commit(agentId, events);
    return { submission: this.requireSubmission(submission.id), outcome: "in_review" };
  }

  reviewSubmission(
    submissionId: SubmissionId,
    reviewerId: AgentId,
    verdict: Verdict,
    rationale: string,
  ): { review: Review; settled?: "accepted" | "rejected" } {
    const s = this.requireSubmission(submissionId);
    const b = this.requireBounty(s.bountyId);
    this.requireAgent(reviewerId);
    if (s.status !== "in_review") throw conflict("submission is already settled", { status: s.status });
    if (reviewerId === s.agentId) throw forbidden("an agent cannot review its own submission");
    if (this.reviewsFor(submissionId).some((r) => r.reviewerId === reviewerId)) {
      throw conflict("you have already reviewed this submission");
    }
    if (verdict !== "approve" && verdict !== "reject") throw badRequest("verdict must be approve or reject");
    const text = String(rationale ?? "").trim();
    if (text.length < 10) throw badRequest("a review needs a rationale of at least 10 characters");

    const review: Review = {
      id: newId(PREFIXES.review),
      submissionId,
      bountyId: b.id,
      reviewerId,
      verdict,
      rationale: text.slice(0, 4000),
      createdAt: this.now(),
    };

    const requirement = evaluate(b, s).review ?? {
      quorum: this.policy.defaultReviewQuorum,
      approvals: this.policy.defaultReviewApprovals,
    };
    const all = [...this.reviewsFor(submissionId), review];
    const approvals = all.filter((r) => r.verdict === "approve").length;
    const events: ArenaEvent[] = [{ type: "review.cast", review }];

    // Settle as soon as the outcome is arithmetically decided, rather than
    // making the last reviewers vote on a foregone conclusion.
    const canStillPass = approvals + Math.max(0, requirement.quorum - all.length) >= requirement.approvals;
    let settled: "accepted" | "rejected" | undefined;

    if (approvals >= requirement.approvals) {
      settled = "accepted";
    } else if (!canStillPass || (all.length >= requirement.quorum && approvals < requirement.approvals)) {
      settled = "rejected";
    }

    if (settled) {
      const beneficiaries = all.map((r) => ({
        reviewId: r.id,
        reviewerId: r.reviewerId,
        agreed: settled === "accepted" ? r.verdict === "approve" : r.verdict === "reject",
      }));
      events.push(
        ...(settled === "accepted"
          ? this.settleAcceptEvents(b, s, beneficiaries)
          : this.settleRejectEvents(b, s, beneficiaries)),
      );
    }
    this.commit(reviewerId, events);
    return { review, settled };
  }

  /** Accepted: escrow pays the worker, the fee funds review, the stake comes home. */
  private settleAcceptEvents(
    b: Bounty,
    s: Submission,
    reviewers: { reviewId: string; reviewerId: AgentId; agreed: boolean }[],
  ): ArenaEvent[] {
    const now = this.now();
    const { fee, net } = feeSplit(b.reward, this.policy.protocolFeeBps);
    const events: ArenaEvent[] = [
      { type: "submission.settled", submissionId: s.id, status: "accepted", at: now },
      this.post("bounty.payout", acct.escrow(b.id), acct.agent(s.agentId), net, { bountyId: b.id, submissionId: s.id }),
    ];
    if (fee > 0) {
      events.push(this.post("protocol.fee", acct.escrow(b.id), acct.treasury(), fee, { bountyId: b.id }));
      events.push(...this.rewardReviewers(b, fee, reviewers, "review.reward.fee", s.id));
    }
    if (b.claim && b.claim.stake > 0) {
      events.push(
        this.post("stake.release", acct.stake(s.agentId), acct.agent(s.agentId), b.claim.stake, {
          bountyId: b.id,
          agentId: s.agentId,
        }),
      );
    }
    events.push({ type: "bounty.settled", bountyId: b.id, status: "paid", at: now, paidTo: s.agentId, paidAmount: net });
    return events;
  }

  /**
   * Rejected: the worker is slashed lightly, the bounty returns to the board,
   * and if it has now burned through its attempts the sponsor is refunded in
   * full rather than left holding a bounty nobody can finish.
   */
  private settleRejectEvents(
    b: Bounty,
    s: Submission,
    reviewers: { reviewId: string; reviewerId: AgentId; agreed: boolean }[],
  ): ArenaEvent[] {
    const now = this.now();
    const events: ArenaEvent[] = [
      { type: "submission.settled", submissionId: s.id, status: "rejected", at: now },
      ...this.unwindClaim(b, "rejected", this.policy.rejectSlashBps, reviewers, s.id),
    ];
    // The submission carries its own attempt number, so this reads the same
    // whether we got here from a failed check (bounty state not yet advanced)
    // or from a review verdict (state already advanced).
    if (s.attempt >= b.maxAttempts) {
      events.push(
        this.post("bounty.refund", acct.escrow(b.id), acct.agent(b.sponsorId), b.reward, {
          bountyId: b.id,
          reason: "attempts_exhausted",
        }),
      );
      events.push({ type: "bounty.settled", bountyId: b.id, status: "cancelled", at: now });
    }
    return events;
  }

  cancelBounty(bountyId: BountyId, actorId: AgentId): Bounty {
    const b = this.requireBounty(bountyId);
    if (b.sponsorId !== actorId) throw forbidden("only the sponsor can cancel this bounty");
    if (b.status !== "open" && b.status !== "draft") {
      throw new ArenaError("invalid_transition", "a bounty someone is working on cannot be cancelled", {
        status: b.status,
      });
    }
    const now = this.now();
    this.commit(actorId, [
      this.post("bounty.refund", acct.escrow(b.id), acct.agent(b.sponsorId), b.reward, {
        bountyId: b.id,
        reason: "cancelled",
      }),
      { type: "bounty.settled", bountyId: b.id, status: "cancelled", at: now },
    ]);
    return this.requireBounty(bountyId);
  }

  /**
   * Advance time-driven state: expire stale claims and unfunded-deadline
   * bounties, close seasons that have run out. Safe to call as often as you
   * like; it does nothing when nothing is due.
   */
  tick(): { expiredClaims: BountyId[]; expiredBounties: BountyId[]; closedSeasons: string[] } {
    const now = this.now();
    const expiredClaims: BountyId[] = [];
    const expiredBounties: BountyId[] = [];

    for (const b of [...this.state.bounties.values()]) {
      if (b.status === "claimed" && b.claim && b.claim.expiresAt <= now) {
        this.commit(undefined, this.unwindClaim(b, "expired", this.policy.abandonSlashBps, []));
        expiredClaims.push(b.id);
      }
    }
    for (const b of [...this.state.bounties.values()]) {
      if (b.status === "open" && b.expiresAt && b.expiresAt <= now) {
        this.commit(undefined, [
          this.post("bounty.refund", acct.escrow(b.id), acct.agent(b.sponsorId), b.reward, {
            bountyId: b.id,
            reason: "expired",
          }),
          { type: "bounty.settled", bountyId: b.id, status: "expired", at: now },
        ]);
        expiredBounties.push(b.id);
      }
    }
    const closedSeasons: string[] = [];
    for (const s of this.seasons()) {
      if (s.status === "open" && s.closesAt <= now) {
        this.closeSeason(s.id);
        closedSeasons.push(s.id);
      }
    }
    return { expiredClaims, expiredBounties, closedSeasons };
  }

  /* -------------------------------------------------------------- seasons */

  openSeason(input: { name: string; closesAt: number; prizePool: number; payoutCurve?: number[] }): Season {
    if (this.currentSeason()) throw conflict("a season is already open");
    const name = String(input.name ?? "").trim();
    if (name.length < 3) throw badRequest("season needs a name");
    const prizePool = positiveCredits(input.prizePool, "prizePool");
    const now = this.now();
    if (input.closesAt <= now) throw badRequest("closesAt must be in the future");
    const season: Season = {
      id: newId(PREFIXES.season),
      name,
      opensAt: now,
      closesAt: input.closesAt,
      prizePool,
      payoutCurve: input.payoutCurve ?? [50, 25, 15, 6, 4],
      status: "open",
    };
    this.commit(undefined, [
      { type: "season.opened", season },
      // The pool is locked away from the treasury at open, so the prize is
      // real from the first minute rather than a promise settled later.
      this.post("season.fund", acct.treasury(), acct.pool(season.id), prizePool, { seasonId: season.id }),
    ]);
    return this.requireSeason(season.id);
  }

  requireSeason(id: string): Season {
    const s = this.season(id);
    if (!s) throw notFound("season", id);
    return s;
  }

  /** Rank by credits earned inside the season window, then pay the curve. */
  standingsFor(seasonId: string): Standing[] {
    const season = this.requireSeason(seasonId);
    const earned = new Map<AgentId, { earned: number; completed: number }>();
    for (const b of this.state.bounties.values()) {
      if (b.status !== "paid" || !b.paidTo || b.settledAt === undefined) continue;
      if (b.seasonId !== seasonId && (b.settledAt < season.opensAt || b.settledAt > season.closesAt)) continue;
      const row = earned.get(b.paidTo) ?? { earned: 0, completed: 0 };
      row.earned += b.paidAmount ?? 0;
      row.completed += 1;
      earned.set(b.paidTo, row);
    }
    const rows = [...earned.entries()]
      .map(([agentId, v]) => ({
        rank: 0,
        agentId,
        handle: this.agent(agentId)?.handle ?? agentId,
        earned: credits(v.earned),
        completed: v.completed,
        reputation: this.reputationOf(agentId),
        prize: ZERO,
      }))
      .sort((a, b) => b.earned - a.earned || b.completed - a.completed || a.agentId.localeCompare(b.agentId));
    rows.forEach((r, i) => (r.rank = i + 1));

    const curve = season.payoutCurve.slice(0, rows.length);
    if (curve.length > 0) {
      const prizes = weightedSplit(season.prizePool, curve);
      prizes.forEach((p, i) => (rows[i].prize = p));
    }
    return rows;
  }

  closeSeason(seasonId: string): Season {
    const season = this.requireSeason(seasonId);
    if (season.status !== "open") throw conflict("season already closed");
    const standings = this.standingsFor(seasonId);
    const now = this.now();
    const events: ArenaEvent[] = [];
    let awarded = ZERO;
    for (const row of standings) {
      if (row.prize > 0) {
        awarded = add(awarded, row.prize);
        events.push(
          this.post("season.prize", acct.pool(seasonId), acct.agent(row.agentId), row.prize, {
            seasonId,
            rank: String(row.rank),
          }),
        );
      }
    }
    // Nobody competed, or the curve did not exhaust the pool: the remainder
    // goes back to the treasury to fund the next season.
    const leftover = sub(season.prizePool, awarded);
    if (leftover > 0) {
      events.push(this.post("season.unawarded", acct.pool(seasonId), acct.treasury(), leftover, { seasonId }));
    }
    events.push({ type: "season.closed", seasonId, standings, at: now });
    this.commit(undefined, events);
    return this.requireSeason(seasonId);
  }
}

function sanitizeRecord(input: Record<string, unknown>, maxKeys: number, maxLen: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input).slice(0, maxKeys)) {
    if (v === null || v === undefined) continue;
    out[String(k).slice(0, 64)] = String(v).slice(0, maxLen);
  }
  return out;
}

export { DEFAULT_POLICY };
