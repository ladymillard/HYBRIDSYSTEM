/**
 * State = fold(events).
 *
 * This module is the only place that mutates the world, and it does so only in
 * response to an event that has already been decided. Validation lives in the
 * engine; the reducer is deliberately dumb, because a reducer that can reject
 * an event is a reducer that can refuse to replay history.
 */

import { Ledger } from "../core/ledger.ts";
import type {
  Agent,
  AgentId,
  ArenaEvent,
  Bounty,
  Review,
  Season,
  StoredEvent,
  Submission,
} from "../domain/types.ts";

export interface State {
  agents: Map<AgentId, Agent>;
  handles: Map<string, AgentId>;
  keys: Map<string, AgentId>;
  bounties: Map<string, Bounty>;
  submissions: Map<string, Submission>;
  reviews: Map<string, Review>;
  seasons: Map<string, Season>;
  ledger: Ledger;
  idempotency: Map<string, { fingerprint: string; response: unknown }>;
  /** Ring buffer of recent events, so `GET /v1/events` never re-reads the log. */
  recent: StoredEvent[];
  seq: number;
  lastTs: number;
}

/** How much history stays hot in memory. Older events are read from the log. */
export const RECENT_EVENTS = 2_000;

export function emptyState(): State {
  return {
    agents: new Map(),
    handles: new Map(),
    keys: new Map(),
    bounties: new Map(),
    submissions: new Map(),
    reviews: new Map(),
    seasons: new Map(),
    ledger: new Ledger(),
    idempotency: new Map(),
    recent: [],
    seq: 0,
    lastTs: 0,
  };
}

function agent(state: State, id: AgentId): Agent | undefined {
  return state.agents.get(id);
}

function putAgent(state: State, next: Agent): void {
  state.agents.set(next.id, next);
}

export function applyEvent(state: State, stored: StoredEvent): void {
  state.seq = Math.max(state.seq, stored.seq);
  state.lastTs = Math.max(state.lastTs, stored.ts);
  state.recent.push(stored);
  if (state.recent.length > RECENT_EVENTS) state.recent.splice(0, state.recent.length - RECENT_EVENTS);
  const e: ArenaEvent = stored.event;

  switch (e.type) {
    case "agent.registered": {
      putAgent(state, e.agent);
      state.handles.set(e.agent.handle.toLowerCase(), e.agent.id);
      state.keys.set(e.agent.keyHash, e.agent.id);
      break;
    }

    case "agent.updated": {
      const a = agent(state, e.agentId);
      if (!a) break;
      const next = { ...a, ...e.patch, stats: e.patch.stats ? { ...a.stats, ...e.patch.stats } : a.stats };
      if (e.patch.handle && e.patch.handle !== a.handle) {
        state.handles.delete(a.handle.toLowerCase());
        state.handles.set(e.patch.handle.toLowerCase(), a.id);
      }
      if (e.patch.keyHash && e.patch.keyHash !== a.keyHash) {
        state.keys.delete(a.keyHash);
        state.keys.set(e.patch.keyHash, a.id);
      }
      putAgent(state, next);
      break;
    }

    case "ledger.posted": {
      state.ledger.apply(e.entry);
      break;
    }

    case "bounty.created": {
      state.bounties.set(e.bounty.id, e.bounty);
      break;
    }

    case "bounty.opened": {
      const b = state.bounties.get(e.bountyId);
      if (b) state.bounties.set(b.id, { ...b, status: "open", openedAt: e.at });
      break;
    }

    case "bounty.claimed": {
      const b = state.bounties.get(e.bountyId);
      if (b) state.bounties.set(b.id, { ...b, status: "claimed", claim: e.claim });
      break;
    }

    case "bounty.claim_released": {
      const b = state.bounties.get(e.bountyId);
      if (b) state.bounties.set(b.id, { ...b, status: "open", claim: undefined });
      const a = agent(state, e.agentId);
      if (a) {
        const stats = { ...a.stats };
        if (e.reason !== "rejected") stats.bountiesAbandoned += 1;
        stats.creditsSlashed = (stats.creditsSlashed + e.slashed) as Agent["stats"]["creditsSlashed"];
        putAgent(state, { ...a, stats });
      }
      break;
    }

    case "submission.created": {
      state.submissions.set(e.submission.id, e.submission);
      const b = state.bounties.get(e.submission.bountyId);
      if (b) {
        state.bounties.set(b.id, {
          ...b,
          status: "in_review",
          submissions: [...b.submissions, e.submission.id],
          attempts: b.attempts + 1,
        });
      }
      break;
    }

    case "submission.checked": {
      const s = state.submissions.get(e.submissionId);
      if (s) state.submissions.set(s.id, { ...s, autoResults: e.results });
      break;
    }

    case "review.cast": {
      state.reviews.set(e.review.id, e.review);
      const s = state.submissions.get(e.review.submissionId);
      if (s) state.submissions.set(s.id, { ...s, reviews: [...s.reviews, e.review.id] });
      const a = agent(state, e.review.reviewerId);
      if (a) putAgent(state, { ...a, stats: { ...a.stats, reviewsGiven: a.stats.reviewsGiven + 1 } });
      break;
    }

    case "submission.settled": {
      const s = state.submissions.get(e.submissionId);
      if (!s) break;
      state.submissions.set(s.id, { ...s, status: e.status, decidedAt: e.at });
      const a = agent(state, s.agentId);
      if (a) {
        const stats = { ...a.stats };
        if (e.status === "accepted") {
          stats.submissionsAccepted += 1;
          stats.bountiesCompleted += 1;
          if (s.attempt === 1) stats.firstPassAccepts += 1;
        } else if (e.status === "rejected") {
          stats.submissionsRejected += 1;
        }
        putAgent(state, { ...a, stats });
      }
      break;
    }

    case "reviews.rewarded": {
      for (const award of e.awards) {
        const r = state.reviews.get(award.reviewId);
        if (r) state.reviews.set(r.id, { ...r, agreed: award.agreed, reward: award.reward });
        const a = agent(state, award.reviewerId);
        if (a && award.agreed) {
          putAgent(state, { ...a, stats: { ...a.stats, reviewsAgreed: a.stats.reviewsAgreed + 1 } });
        }
      }
      break;
    }

    case "bounty.settled": {
      const b = state.bounties.get(e.bountyId);
      if (!b) break;
      state.bounties.set(b.id, {
        ...b,
        status: e.status,
        settledAt: e.at,
        claim: undefined,
        paidTo: e.paidTo ?? b.paidTo,
        paidAmount: e.paidAmount ?? b.paidAmount,
      });
      if (e.status === "paid" && e.paidTo && e.paidAmount !== undefined) {
        const a = agent(state, e.paidTo);
        if (a) {
          putAgent(state, {
            ...a,
            stats: { ...a.stats, creditsEarned: (a.stats.creditsEarned + e.paidAmount) as Agent["stats"]["creditsEarned"] },
          });
        }
      }
      break;
    }

    case "season.opened": {
      state.seasons.set(e.season.id, e.season);
      break;
    }

    case "season.closed": {
      const s = state.seasons.get(e.seasonId);
      if (s) state.seasons.set(s.id, { ...s, status: "closed", standings: e.standings, closesAt: e.at });
      break;
    }

    case "idempotency.recorded": {
      state.idempotency.set(e.key, { fingerprint: e.fingerprint, response: e.response });
      break;
    }

    default: {
      // Unknown event types are tolerated so an older node can replay a log
      // written by a newer one without corrupting the parts it does understand.
      break;
    }
  }
}

export function replay(events: Iterable<StoredEvent>): State {
  const state = emptyState();
  for (const e of events) applyEvent(state, e);
  return state;
}
