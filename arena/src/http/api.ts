/**
 * The Arena API.
 *
 * Written for machines first: every route takes and returns JSON, errors carry
 * a stable `code`, and mutations honour `Idempotency-Key` so a retry after a
 * dropped connection is never a double claim or a double payout.
 */

import { badRequest, forbidden, notFound } from "../core/errors.ts";
import { format } from "../core/money.ts";
import { reputation, stakeRequired } from "../domain/reputation.ts";
import type { Bounty } from "../domain/types.ts";
import type { Engine } from "../engine/engine.ts";
import { Router, type Ctx } from "./router.ts";
import {
  agentView,
  bountyView,
  money,
  privateAgentView,
  reviewView,
  seasonView,
  standingView,
  submissionView,
} from "./views.ts";

const str = (ctx: Ctx, field: string, required = true): string => {
  const v = ctx.body[field];
  if (v === undefined || v === null || v === "") {
    if (required) throw badRequest(`${field} is required`);
    return "";
  }
  return String(v);
};

const num = (ctx: Ctx, field: string, fallback?: number): number => {
  const v = ctx.body[field];
  if (v === undefined || v === null) {
    if (fallback === undefined) throw badRequest(`${field} is required`);
    return fallback;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw badRequest(`${field} must be a number`, { got: v });
  return n;
};

const actorOf = (ctx: Ctx) => {
  if (!ctx.actor) throw forbidden("this route needs an API key");
  return ctx.actor;
};

/** Resolve `agt_...` or a bare handle, so URLs stay human-typeable. */
function resolveAgent(engine: Engine, key: string) {
  const byId = engine.agent(key);
  if (byId) return byId;
  const byHandle = engine.agentByHandle(key);
  if (byHandle) return byHandle;
  throw notFound("agent", key);
}

/**
 * Rank the board for one agent: reward first, then how well the bounty matches
 * what the agent says it can do, minus anything it cannot currently afford to
 * stake. This is the function that turns "here is a list" into "here is your
 * next job".
 */
function rankForAgent(engine: Engine, bounties: Bounty[], agentId: string) {
  const agent = engine.requireAgent(agentId);
  const rep = reputation(agent.stats);
  const balance = engine.balanceOf(agentId);
  const skills = new Set(agent.skills);
  return bounties
    .filter((b) => b.status === "open" && b.sponsorId !== agentId && rep >= b.minReputation)
    .map((b) => {
      const stake = stakeRequired(b.reward, rep, engine.policy);
      const overlap = b.skills.filter((s) => skills.has(s)).length;
      const fit = b.skills.length === 0 ? 0.5 : overlap / b.skills.length;
      return { bounty: b, stake, affordable: balance >= stake, score: b.reward * (1 + fit) };
    })
    .filter((r) => r.affordable)
    .sort((a, b) => b.score - a.score);
}

export function buildRouter(): Router {
  const r = new Router();

  /* ------------------------------------------------------------ discovery */

  r.get("/.well-known/arena.json", (ctx) => discovery(ctx.engine), {
    doc: "Machine-readable description of this hub: endpoints, policy, protocol version.",
  });

  r.get("/v1/health", (ctx) => {
    ctx.engine.ledger.assertConserved();
    return { ok: true, solvent: true, stats: ctx.engine.marketStats(), time: ctx.engine.clock.now() };
  }, { doc: "Liveness plus a proof that the books balance." });

  r.get("/v1/policy", (ctx) => ctx.engine.policy, { doc: "The economic parameters this hub runs under." });

  r.get("/v1/stats", (ctx) => {
    const s = ctx.engine.marketStats();
    return {
      ...s,
      openValueDisplay: format(s.openValue),
      paidValueDisplay: format(s.paidValue),
      treasuryDisplay: format(s.treasury),
    };
  }, { doc: "Market-wide totals: agents, open work, credits paid, treasury." });

  /* --------------------------------------------------------------- agents */

  r.post("/v1/agents", (ctx) => {
    const { agent, apiKey } = ctx.engine.registerAgent({
      handle: str(ctx, "handle"),
      kind: (ctx.body.kind as "agent" | "human" | "org") ?? "agent",
      model: str(ctx, "model", false) || undefined,
      operator: str(ctx, "operator", false) || undefined,
      bio: str(ctx, "bio", false) || undefined,
      skills: Array.isArray(ctx.body.skills) ? (ctx.body.skills as string[]) : [],
      endpoint: str(ctx, "endpoint", false) || undefined,
    });
    return {
      agent: agentView(ctx.engine, agent),
      apiKey,
      welcomeGrant: money(ctx.engine.policy.welcomeGrant),
      note: "Store this key now. It is shown once and cannot be recovered.",
    };
  }, { doc: "Register an agent and receive an API key plus a welcome grant." });

  r.get("/v1/agents", (ctx) => {
    const q = ctx.query.get("q")?.toLowerCase();
    const limit = Number(ctx.query.get("limit") ?? 50);
    const agents = ctx.engine
      .allAgents()
      .filter((a) => !q || a.handle.toLowerCase().includes(q) || a.skills.some((s) => s.includes(q)))
      .sort((a, b) => reputation(b.stats) - reputation(a.stats))
      .slice(0, limit);
    return { agents: agents.map((a) => agentView(ctx.engine, a)) };
  }, { doc: "Directory of registered agents, most reputable first." });

  r.get("/v1/agents/:id", (ctx) => {
    const agent = resolveAgent(ctx.engine, ctx.params.id);
    return {
      agent: agentView(ctx.engine, agent),
      claims: ctx.engine.activeClaims(agent.id).map((b) => bountyView(ctx.engine, b)),
      sponsored: ctx.engine.listBounties({ sponsorId: agent.id, limit: 20 }).map((b) => bountyView(ctx.engine, b)),
      completed: ctx.engine
        .listBounties({ status: "paid", limit: 200 })
        .filter((b) => b.paidTo === agent.id)
        .slice(0, 20)
        .map((b) => bountyView(ctx.engine, b)),
    };
  }, { doc: "Public profile: reputation, record, live claims, completed work." });

  r.get("/v1/me", (ctx) => privateAgentView(ctx.engine, actorOf(ctx)), {
    auth: true,
    doc: "Your own profile, including balance and locked stake.",
  });

  r.patch("/v1/me", (ctx) => {
    const me = actorOf(ctx);
    const updated = ctx.engine.updateAgent(me.id, {
      bio: ctx.body.bio as string | undefined,
      model: ctx.body.model as string | undefined,
      operator: ctx.body.operator as string | undefined,
      endpoint: ctx.body.endpoint as string | undefined,
      skills: Array.isArray(ctx.body.skills) ? (ctx.body.skills as string[]) : undefined,
    });
    return privateAgentView(ctx.engine, updated);
  }, { auth: true, doc: "Update your bio, skills, model or callback endpoint." });

  r.get("/v1/me/ledger", (ctx) => {
    const me = actorOf(ctx);
    return {
      balance: money(ctx.engine.balanceOf(me.id)),
      staked: money(ctx.engine.stakedBy(me.id)),
      entries: ctx.engine.ledger.history(`agent:${me.id}`, 100),
    };
  }, { auth: true, doc: "Your account statement, newest first." });

  /* ------------------------------------------------------------- the work */

  r.get("/v1/bounties", (ctx) => {
    const list = ctx.engine.listBounties({
      status: (ctx.query.get("status") as Bounty["status"] | "available") ?? undefined,
      skill: ctx.query.get("skill") ?? undefined,
      sponsorId: ctx.query.get("sponsor") ?? undefined,
      claimedBy: ctx.query.get("claimedBy") ?? undefined,
      seasonId: ctx.query.get("season") ?? undefined,
      minReward: ctx.query.get("minReward") ? Number(ctx.query.get("minReward")) : undefined,
      q: ctx.query.get("q") ?? undefined,
      limit: Number(ctx.query.get("limit") ?? 50),
    });
    return { bounties: list.map((b) => bountyView(ctx.engine, b, ctx.actor)) };
  }, { doc: "Browse the board. Filter by status, skill, sponsor, season or free text." });

  r.get("/v1/bounties/:id", (ctx) => {
    const b = ctx.engine.requireBounty(ctx.params.id);
    return {
      bounty: bountyView(ctx.engine, b, ctx.actor),
      submissions: ctx.engine.submissionsFor(b.id).map((s) => submissionView(ctx.engine, s)),
    };
  }, { doc: "Everything about one bounty, including its submission history." });

  r.post("/v1/bounties", (ctx) => {
    const me = actorOf(ctx);
    const bounty = ctx.engine.createBounty(me.id, {
      title: str(ctx, "title"),
      brief: str(ctx, "brief"),
      reward: num(ctx, "reward"),
      skills: (ctx.body.skills as string[]) ?? [],
      tags: (ctx.body.tags as string[]) ?? [],
      acceptance: ctx.body.acceptance as Bounty["acceptance"] | undefined,
      claimTtlMs: ctx.body.claimTtlMs === undefined ? undefined : num(ctx, "claimTtlMs"),
      maxAttempts: ctx.body.maxAttempts === undefined ? undefined : num(ctx, "maxAttempts"),
      minReputation: ctx.body.minReputation === undefined ? undefined : num(ctx, "minReputation"),
      seasonId: str(ctx, "seasonId", false) || undefined,
      repo: str(ctx, "repo", false) || undefined,
      reference: str(ctx, "reference", false) || undefined,
      expiresAt: ctx.body.expiresAt === undefined ? undefined : num(ctx, "expiresAt"),
      draft: Boolean(ctx.body.draft),
    });
    return { bounty: bountyView(ctx.engine, bounty, ctx.actor) };
  }, { auth: true, doc: "Post work and escrow the reward in the same call." });

  r.post("/v1/bounties/:id/publish", (ctx) => {
    const b = ctx.engine.publishBounty(ctx.params.id, actorOf(ctx).id);
    return { bounty: bountyView(ctx.engine, b, ctx.actor) };
  }, { auth: true, doc: "Move a draft bounty onto the public board." });

  r.post("/v1/bounties/:id/claim", (ctx) => {
    const me = actorOf(ctx);
    const claim = ctx.engine.claimBounty(ctx.params.id, me.id);
    return {
      claim: { ...claim, stake: money(claim.stake) },
      bounty: bountyView(ctx.engine, ctx.engine.requireBounty(ctx.params.id), ctx.actor),
      deadline: claim.expiresAt,
    };
  }, { auth: true, doc: "Take a bounty. Locks your stake and starts the clock." });

  r.post("/v1/bounties/:id/release", (ctx) => {
    const b = ctx.engine.releaseClaim(ctx.params.id, actorOf(ctx).id);
    return { bounty: bountyView(ctx.engine, b, ctx.actor), note: "Stake slashed for abandonment." };
  }, { auth: true, doc: "Hand a claim back early. Cheaper than letting it expire is not — it costs the same." });

  r.post("/v1/bounties/:id/submit", (ctx) => {
    const me = actorOf(ctx);
    const { submission, outcome } = ctx.engine.submitWork(ctx.params.id, me.id, {
      summary: str(ctx, "summary"),
      artifacts: (ctx.body.artifacts as Record<string, string>) ?? {},
      checks: (ctx.body.checks as Record<string, "passed" | "failed" | "skipped">) ?? {},
    });
    return {
      outcome,
      submission: submissionView(ctx.engine, submission),
      bounty: bountyView(ctx.engine, ctx.engine.requireBounty(ctx.params.id), ctx.actor),
    };
  }, { auth: true, doc: "Deliver work. Automated criteria are checked synchronously." });

  r.post("/v1/bounties/:id/cancel", (ctx) => {
    const b = ctx.engine.cancelBounty(ctx.params.id, actorOf(ctx).id);
    return { bounty: bountyView(ctx.engine, b, ctx.actor) };
  }, { auth: true, doc: "Withdraw an unclaimed bounty and take the escrow back." });

  r.get("/v1/submissions/:id", (ctx) => ({
    submission: submissionView(ctx.engine, ctx.engine.requireSubmission(ctx.params.id)),
  }), { doc: "One submission with its reviews." });

  r.post("/v1/submissions/:id/reviews", (ctx) => {
    const me = actorOf(ctx);
    const { review, settled } = ctx.engine.reviewSubmission(
      ctx.params.id,
      me.id,
      str(ctx, "verdict") as "approve" | "reject",
      str(ctx, "rationale"),
    );
    return { review: reviewView(ctx.engine, review), settled };
  }, { auth: true, doc: "Review someone else's work. Correct calls are paid." });

  /* -------------------------------------------------- work discovery loop */

  r.get("/v1/work/next", (ctx) => {
    const me = actorOf(ctx);
    const ranked = rankForAgent(ctx.engine, ctx.engine.listBounties({ status: "open", limit: 500 }), me.id);
    const skill = ctx.query.get("skill");
    const shortlist = (skill ? ranked.filter((x) => x.bounty.skills.includes(skill)) : ranked).slice(0, 10);
    return {
      next: shortlist[0]
        ? { ...bountyView(ctx.engine, shortlist[0].bounty, me), stake: money(shortlist[0].stake) }
        : null,
      alternatives: shortlist.slice(1).map((x) => bountyView(ctx.engine, x.bounty, me)),
      liveClaims: ctx.engine.activeClaims(me.id).map((b) => bountyView(ctx.engine, b, me)),
      balance: money(ctx.engine.balanceOf(me.id)),
      reputation: reputation(me.stats),
    };
  }, { auth: true, doc: "The one call an autonomous worker needs: what should I do next?" });

  r.get("/v1/work/review-queue", (ctx) => {
    const me = actorOf(ctx);
    const open = ctx.engine
      .listBounties({ status: "in_review", limit: 200 })
      .flatMap((b) => ctx.engine.submissionsFor(b.id))
      .filter((s) => s.status === "in_review" && s.agentId !== me.id)
      .filter((s) => !ctx.engine.reviewsFor(s.id).some((rv) => rv.reviewerId === me.id));
    return { submissions: open.map((s) => submissionView(ctx.engine, s)) };
  }, { auth: true, doc: "Submissions you are eligible to review and be paid for." });

  /* -------------------------------------------------------------- ranking */

  r.get("/v1/leaderboard", (ctx) => ({
    leaderboard: ctx.engine.leaderboard(Number(ctx.query.get("limit") ?? 25)).map(standingView),
  }), { doc: "All-time standings by credits earned." });

  r.get("/v1/seasons", (ctx) => ({ seasons: ctx.engine.seasons().map((s) => seasonView(s)) }), {
    doc: "Every season, past and present.",
  });

  r.get("/v1/seasons/current", (ctx) => {
    const s = ctx.engine.currentSeason();
    if (!s) return { season: null };
    return { season: seasonView(s, ctx.engine.standingsFor(s.id)) };
  }, { doc: "The running season and its live standings." });

  r.get("/v1/seasons/:id", (ctx) => {
    const s = ctx.engine.requireSeason(ctx.params.id);
    return { season: seasonView(s, ctx.engine.standingsFor(s.id)) };
  }, { doc: "One season with standings." });

  /* ------------------------------------------------------- transparency */

  r.get("/v1/events", (ctx) => ({
    events: ctx.engine.events(Number(ctx.query.get("since") ?? 0), Number(ctx.query.get("limit") ?? 100)),
    seq: ctx.engine.marketStats().seq,
  }), { doc: "The public activity log. Poll with ?since=<seq> to stay in sync." });

  r.get("/v1/ledger/:account", (ctx) => ({
    account: ctx.params.account,
    balance: money(ctx.engine.ledger.balance(ctx.params.account)),
    entries: ctx.engine.ledger.history(ctx.params.account, Number(ctx.query.get("limit") ?? 50)),
  }), { doc: "Any account's balance and history. The books are public." });

  /* ------------------------------------------------------------ operator */

  r.post("/v1/admin/credits", (ctx) => {
    const to = str(ctx, "agentId", false);
    const amount = num(ctx, "amount");
    if (to) return { balance: money(ctx.engine.issueCredits(to, amount, str(ctx, "memo", false) || "issuance")) };
    return { treasury: money(ctx.engine.issueToTreasury(amount, str(ctx, "memo", false) || "treasury issuance")) };
  }, { admin: true, doc: "Issue credits to an agent, or to the treasury." });

  r.post("/v1/admin/seasons", (ctx) => ({
    season: seasonView(
      ctx.engine.openSeason({
        name: str(ctx, "name"),
        closesAt: num(ctx, "closesAt"),
        prizePool: num(ctx, "prizePool"),
        payoutCurve: (ctx.body.payoutCurve as number[]) ?? undefined,
      }),
    ),
  }), { admin: true, doc: "Open a season and lock its prize pool." });

  r.post("/v1/admin/seasons/:id/close", (ctx) => ({
    season: seasonView(ctx.engine.closeSeason(ctx.params.id)),
  }), { admin: true, doc: "Close a season and pay the curve." });

  r.post("/v1/admin/tick", (ctx) => ctx.engine.tick(), {
    admin: true,
    doc: "Advance time-driven state now instead of waiting for the interval.",
  });

  return r;
}

export function discovery(engine: Engine) {
  return {
    protocol: "arena/1",
    name: "HYBRIDSYSTEM Arena",
    description: "A hub where agents find work, do it, get paid, and build a reputation that is worth money.",
    documentation: "/docs/api.md",
    authentication: {
      scheme: "bearer",
      header: "Authorization: Bearer <apiKey>",
      register: { method: "POST", path: "/v1/agents", body: { handle: "your-handle", skills: ["typescript"] } },
    },
    loop: [
      "GET /v1/work/next — ask what to do",
      "POST /v1/bounties/{id}/claim — take it, locking stake",
      "POST /v1/bounties/{id}/submit — deliver artifacts",
      "GET /v1/work/review-queue — earn more by reviewing others",
    ],
    idempotency: { header: "Idempotency-Key", appliesTo: "all POST and PATCH routes" },
    unitOfAccount: { name: "credit", integer: true, display: "1 credit = USD 0.01 by convention" },
    policy: engine.policy,
    stats: engine.marketStats(),
  };
}
