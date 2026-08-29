import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine/engine.ts";
import { replay } from "../src/engine/state.ts";
import { MemoryStore } from "../src/store/store.ts";
import { TestClock, DAY, HOUR } from "../src/core/clock.ts";
import { acct } from "../src/core/ledger.ts";
import { reputation, stakeRequired } from "../src/domain/reputation.ts";
import { bps, credits } from "../src/core/money.ts";

function arena(policy = {}) {
  const clock = new TestClock();
  const store = new MemoryStore();
  const engine = new Engine({ store, clock, policy });
  return { engine, clock, store };
}

function cast(engine: Engine, handle: string, funding = 100_000) {
  const { agent } = engine.registerAgent({ handle, skills: ["typescript"] });
  if (funding > 0) engine.issueCredits(agent.id, funding, "test funding");
  return agent;
}

const REVIEWED = [
  { kind: "artifact" as const, key: "pr" },
  { kind: "review" as const, quorum: 2, approvals: 2 },
];

test("a new agent gets working capital and an unproven reputation", () => {
  const { engine } = arena();
  const { agent, apiKey } = engine.registerAgent({ handle: "first-mover" });
  assert.equal(engine.balanceOf(agent.id), engine.policy.welcomeGrant);
  assert.ok(apiKey.startsWith("ark_"));
  assert.equal(engine.authenticate(apiKey)?.id, agent.id);
  assert.equal(engine.authenticate("ark_nope_nope"), undefined);
  assert.ok(reputation(agent.stats) < 200, "a fresh agent is not trusted yet");
  engine.ledger.assertConserved();
});

test("handles are unique and validated", () => {
  const { engine } = arena();
  engine.registerAgent({ handle: "taken" });
  assert.throws(() => engine.registerAgent({ handle: "taken" }), /taken/);
  assert.throws(() => engine.registerAgent({ handle: "no" }), /handle must be/);
});

test("posting a bounty escrows the reward immediately", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const before = engine.balanceOf(sponsor.id);
  const bounty = engine.createBounty(sponsor.id, {
    title: "Ship the thing",
    brief: "Implement the thing described in the linked issue and open a pull request.",
    reward: 50_000,
    acceptance: REVIEWED,
  });
  assert.equal(bounty.status, "open");
  assert.equal(engine.balanceOf(sponsor.id), before - 50_000);
  assert.equal(engine.ledger.balance(acct.escrow(bounty.id)), 50_000);
  engine.ledger.assertConserved();
});

test("a sponsor cannot post a bounty it cannot pay for", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "broke", 0);
  assert.throws(
    () =>
      engine.createBounty(sponsor.id, {
        title: "Too rich for me",
        brief: "This bounty is worth more than the sponsor has in the bank.",
        reward: 10_000_000,
      }),
    /cannot cover/,
  );
});

test("the happy path: claim, submit, two approvals, paid", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const r1 = cast(engine, "reviewer-one");
  const r2 = cast(engine, "reviewer-two");

  const bounty = engine.createBounty(sponsor.id, {
    title: "Add retries to the fetch helper",
    brief: "Add exponential backoff to the fetch helper and cover it with tests.",
    reward: 50_000,
    acceptance: REVIEWED,
  });

  const workerStart = engine.balanceOf(worker.id);
  const expectedStake = stakeRequired(credits(50_000), reputation(worker.stats), engine.policy);
  const claim = engine.claimBounty(bounty.id, worker.id);
  assert.equal(claim.stake, expectedStake);
  assert.ok(claim.stake > 4_000 && claim.stake <= 5_000, "an unproven agent posts close to the full 10%");
  assert.equal(engine.balanceOf(worker.id), workerStart - claim.stake);
  assert.equal(engine.stakedBy(worker.id), claim.stake);

  const { submission, outcome } = engine.submitWork(bounty.id, worker.id, {
    summary: "Backoff added with unit tests covering the retry ladder.",
    artifacts: { pr: "https://github.com/example/repo/pull/1" },
  });
  assert.equal(outcome, "in_review");
  assert.equal(engine.bounty(bounty.id)!.status, "in_review");

  const first = engine.reviewSubmission(submission.id, r1.id, "approve", "Tests cover the ladder. Looks right.");
  assert.equal(first.settled, undefined, "one approval is not a quorum");
  const second = engine.reviewSubmission(submission.id, r2.id, "approve", "Reproduced locally, backoff is correct.");
  assert.equal(second.settled, "accepted");

  const paid = engine.bounty(bounty.id)!;
  assert.equal(paid.status, "paid");
  assert.equal(paid.paidTo, worker.id);
  assert.equal(paid.paidAmount, 47_500, "reward minus the 5% protocol fee");
  assert.equal(engine.balanceOf(worker.id), workerStart + 47_500, "stake returned, reward paid");
  assert.equal(engine.stakedBy(worker.id), 0);
  assert.equal(engine.ledger.balance(acct.escrow(bounty.id)), 0);

  // Fee 2500; reviewers split 60% of it evenly, treasury keeps the rest.
  assert.equal(engine.balanceOf(r1.id), 100_000 + engine.policy.welcomeGrant + 750);
  assert.equal(engine.balanceOf(r2.id), 100_000 + engine.policy.welcomeGrant + 750);
  assert.equal(engine.ledger.balance(acct.treasury()), 1_000);

  const profile = engine.profile(worker.id);
  assert.equal(profile.agent.stats.bountiesCompleted, 1);
  assert.equal(profile.agent.stats.firstPassAccepts, 1);
  assert.equal(engine.agent(r1.id)!.stats.reviewsAgreed, 1);
  engine.ledger.assertConserved();
});

test("failing an automated check rejects without spending reviewer time", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const bounty = engine.createBounty(sponsor.id, {
    title: "Green CI",
    brief: "Get the pipeline back to green and link the passing run.",
    reward: 20_000,
    acceptance: [
      { kind: "url", key: "run" },
      { kind: "checks", names: ["ci"] },
    ],
  });
  const { stake } = engine.claimBounty(bounty.id, worker.id);
  const { outcome, submission } = engine.submitWork(bounty.id, worker.id, {
    summary: "I think it works now, honestly.",
    artifacts: { run: "not-a-url" },
    checks: { ci: "failed" },
  });
  assert.equal(outcome, "rejected_by_checks");
  assert.equal(engine.submission(submission.id)!.autoResults.filter((r) => !r.passed).length, 2);
  assert.equal(engine.bounty(bounty.id)!.status, "open", "the bounty goes back on the board");
  // The reject slash is taken from the stake; the remainder comes straight back.
  const slash = bps(stake, engine.policy.rejectSlashBps);
  assert.equal(engine.stakedBy(worker.id), 0);
  assert.equal(engine.ledger.balance(acct.treasury()), slash, "with no reviewers, the whole slash sits in the treasury");
  assert.equal(engine.agent(worker.id)!.stats.creditsSlashed, slash);
  engine.ledger.assertConserved();
});

test("automated-only criteria pay out with no review round at all", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const bounty = engine.createBounty(sponsor.id, {
    title: "Publish the dataset",
    brief: "Upload the cleaned dataset and report the checksum in the summary.",
    reward: 10_000,
    acceptance: [
      { kind: "url", key: "dataset" },
      { kind: "regex", key: "sha256", pattern: "^[a-f0-9]{64}$" },
    ],
  });
  engine.claimBounty(bounty.id, worker.id);
  const { outcome } = engine.submitWork(bounty.id, worker.id, {
    summary: "Dataset uploaded and hashed.",
    artifacts: { dataset: "https://example.com/data.csv", sha256: "a".repeat(64) },
  });
  assert.equal(outcome, "accepted");
  assert.equal(engine.bounty(bounty.id)!.status, "paid");
  engine.ledger.assertConserved();
});

test("a rejected submission slashes lightly and pays the reviewers who were right", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const r1 = cast(engine, "reviewer-one");
  const r2 = cast(engine, "reviewer-two");
  const bounty = engine.createBounty(sponsor.id, {
    title: "Fix the flaky test",
    brief: "Track down why the scheduler test flakes and fix the root cause.",
    reward: 40_000,
    maxAttempts: 3,
    acceptance: [
      { kind: "artifact" as const, key: "pr" },
      { kind: "review" as const, quorum: 3, approvals: 2 },
    ],
  });
  const { stake } = engine.claimBounty(bounty.id, worker.id);
  const { submission } = engine.submitWork(bounty.id, worker.id, {
    summary: "Added a sleep to the test so it passes now.",
    artifacts: { pr: "https://example.com/pr/9" },
  });
  const first = engine.reviewSubmission(submission.id, r1.id, "reject", "A sleep hides the race, it does not fix it.");
  assert.equal(first.settled, undefined, "two of three could still approve");
  const second = engine.reviewSubmission(submission.id, r2.id, "reject", "Agreed, the root cause is untouched.");
  assert.equal(second.settled, "rejected", "two rejections put two approvals out of reach");

  const after = engine.bounty(bounty.id)!;
  assert.equal(after.status, "open", "attempts remain, so the work is back on the board");
  assert.equal(after.attempts, 1);
  assert.equal(engine.ledger.balance(acct.escrow(bounty.id)), 40_000, "escrow is untouched by a rejection");
  // The slash funds the review payout: rejection is paid work too.
  const slash = bps(stake, engine.policy.rejectSlashBps);
  const reviewPool = bps(slash, engine.policy.reviewShareBps);
  assert.equal(engine.agent(worker.id)!.stats.creditsSlashed, slash);
  assert.equal(
    engine.balanceOf(r1.id) + engine.balanceOf(r2.id),
    2 * (100_000 + engine.policy.welcomeGrant) + reviewPool,
    "the two reviewers who called it split the pool between them",
  );
  assert.equal(engine.agent(r1.id)!.stats.reviewsAgreed, 1);
  assert.equal(engine.agent(r2.id)!.stats.reviewsAgreed, 1);
  engine.ledger.assertConserved();
});

test("burning through the attempt budget refunds the sponsor in full", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const bounty = engine.createBounty(sponsor.id, {
    title: "One shot",
    brief: "A bounty that gives an agent exactly one attempt before it closes.",
    reward: 10_000,
    maxAttempts: 1,
    acceptance: [{ kind: "artifact", key: "pr" }],
  });
  const sponsorAfterFunding = engine.balanceOf(sponsor.id);
  engine.claimBounty(bounty.id, worker.id);
  engine.submitWork(bounty.id, worker.id, { summary: "Nothing to show for it, sorry." });
  const after = engine.bounty(bounty.id)!;
  assert.equal(after.status, "cancelled");
  assert.equal(engine.balanceOf(sponsor.id), sponsorAfterFunding + 10_000);
  assert.equal(engine.ledger.balance(acct.escrow(bounty.id)), 0);
  engine.ledger.assertConserved();
});

test("an expired claim is slashed harder than an honest failure", () => {
  const { engine, clock } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const bounty = engine.createBounty(sponsor.id, {
    title: "Time-boxed work",
    brief: "Work that must be finished inside the claim window or handed back.",
    reward: 30_000,
    claimTtlMs: HOUR * 6,
    acceptance: REVIEWED,
  });
  const { stake } = engine.claimBounty(bounty.id, worker.id);
  assert.deepEqual(engine.tick().expiredClaims, [], "nothing is due yet");
  clock.advance(HOUR * 7);
  assert.deepEqual(engine.tick().expiredClaims, [bounty.id]);
  assert.equal(engine.bounty(bounty.id)!.status, "open");
  assert.equal(engine.agent(worker.id)!.stats.bountiesAbandoned, 1);
  const abandonSlash = bps(stake, engine.policy.abandonSlashBps);
  assert.equal(engine.agent(worker.id)!.stats.creditsSlashed, abandonSlash);
  assert.ok(
    abandonSlash > bps(stake, engine.policy.rejectSlashBps),
    "walking away costs more than trying and missing",
  );
  assert.equal(engine.stakedBy(worker.id), 0);
  engine.ledger.assertConserved();
});

test("an unclaimed bounty past its deadline refunds the sponsor", () => {
  const { engine, clock } = arena();
  const sponsor = cast(engine, "sponsor");
  const start = engine.balanceOf(sponsor.id);
  const bounty = engine.createBounty(sponsor.id, {
    title: "Nobody wants this",
    brief: "A bounty with a deadline that nobody on the board ever claims.",
    reward: 5_000,
    expiresAt: Date.UTC(2026, 0, 3),
    acceptance: REVIEWED,
  });
  clock.advance(DAY * 3);
  assert.deepEqual(engine.tick().expiredBounties, [bounty.id]);
  assert.equal(engine.bounty(bounty.id)!.status, "expired");
  assert.equal(engine.balanceOf(sponsor.id), start);
  engine.ledger.assertConserved();
});

test("the board defends itself against obvious abuse", () => {
  const { engine } = arena({ maxConcurrentClaims: 2 });
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const outsider = cast(engine, "outsider");

  const make = (title: string, extra = {}) =>
    engine.createBounty(sponsor.id, {
      title,
      brief: "A perfectly ordinary bounty used to exercise the guard rails.",
      reward: 10_000,
      acceptance: REVIEWED,
      ...extra,
    });

  const own = make("Self dealing");
  assert.throws(() => engine.claimBounty(own.id, sponsor.id), /cannot claim its own/);

  const a = make("First");
  const b = make("Second");
  const c = make("Third");
  engine.claimBounty(a.id, worker.id);
  engine.claimBounty(b.id, worker.id);
  assert.throws(() => engine.claimBounty(c.id, worker.id), /too many live claims/);
  assert.throws(() => engine.claimBounty(a.id, outsider.id), /not open/);

  const gated = make("Elite only", { minReputation: 500 });
  assert.throws(() => engine.claimBounty(gated.id, outsider.id), /reputation below/);

  engine.claimBounty(c.id, outsider.id);
  const { submission } = engine.submitWork(c.id, outsider.id, {
    summary: "Work delivered as described in the brief.",
    artifacts: { pr: "https://example.com/pr/3" },
  });
  assert.throws(() => engine.reviewSubmission(submission.id, outsider.id, "approve", "I love my own work"), /own submission/);
  engine.reviewSubmission(submission.id, worker.id, "approve", "Looks fine to me, ship it.");
  assert.throws(() => engine.reviewSubmission(submission.id, worker.id, "approve", "Saying it twice"), /already reviewed/);
  engine.ledger.assertConserved();
});

test("reputation lowers the cost of working", () => {
  const { engine } = arena();
  const sponsor = cast(engine, "sponsor", 10_000_000);
  const worker = cast(engine, "grinder");
  const r1 = cast(engine, "rev-a");
  const r2 = cast(engine, "rev-b");

  const stakes: number[] = [];
  for (let i = 0; i < 12; i++) {
    const bounty = engine.createBounty(sponsor.id, {
      title: `Repeat work ${i}`,
      brief: "A standard unit of work used to build a track record over time.",
      reward: 50_000,
      acceptance: REVIEWED,
    });
    stakes.push(engine.claimBounty(bounty.id, worker.id).stake);
    const { submission } = engine.submitWork(bounty.id, worker.id, {
      summary: "Delivered as specified, with tests.",
      artifacts: { pr: `https://example.com/pr/${i}` },
    });
    engine.reviewSubmission(submission.id, r1.id, "approve", "Meets the criteria in the brief.");
    engine.reviewSubmission(submission.id, r2.id, "approve", "Checked it myself, it holds up.");
  }
  assert.ok(stakes.at(-1)! < stakes[0], `stake should fall with reputation: ${stakes[0]} -> ${stakes.at(-1)}`);
  assert.ok(engine.reputationOf(worker.id) > 500);
  assert.equal(engine.leaderboard()[0].agentId, worker.id);
  engine.ledger.assertConserved();
});

test("a season pays its curve and hands the remainder back to the treasury", () => {
  const { engine, clock } = arena();
  engine.issueToTreasury(1_000_000, "seed the first prize pool");
  const season = engine.openSeason({ name: "Season One", closesAt: clock.now() + DAY * 30, prizePool: 100_000 });
  assert.throws(() => engine.openSeason({ name: "Season Two", closesAt: clock.now() + DAY, prizePool: 1 }), /already open/);

  const sponsor = cast(engine, "sponsor", 1_000_000);
  const alpha = cast(engine, "alpha");
  const beta = cast(engine, "beta");
  const reviewer = cast(engine, "reviewer");

  const run = (worker: { id: string }, reward: number, i: number) => {
    const bounty = engine.createBounty(sponsor.id, {
      title: `Season work ${i}`,
      brief: "Work performed inside the season window, counting toward standings.",
      reward,
      acceptance: [{ kind: "review" as const, quorum: 1, approvals: 1 }],
    });
    assert.equal(bounty.seasonId, season.id, "open bounties join the running season automatically");
    engine.claimBounty(bounty.id, worker.id);
    const { submission } = engine.submitWork(bounty.id, worker.id, { summary: `Season delivery ${i}` });
    engine.reviewSubmission(submission.id, reviewer.id, "approve", "Good work, meets the brief.");
  };

  run(alpha, 100_000, 1);
  run(alpha, 60_000, 2);
  run(beta, 80_000, 3);

  const alphaBefore = engine.balanceOf(alpha.id);
  const betaBefore = engine.balanceOf(beta.id);
  clock.advance(DAY * 31);
  assert.deepEqual(engine.tick().closedSeasons, [season.id]);

  const closed = engine.season(season.id)!;
  assert.equal(closed.status, "closed");
  assert.equal(closed.standings![0].agentId, alpha.id);
  assert.equal(closed.standings![0].prize, 66_667, "50 of a 50/25 split over two ranked agents");
  assert.equal(closed.standings![1].prize, 33_333);
  assert.equal(engine.balanceOf(alpha.id), alphaBefore + 66_667);
  assert.equal(engine.balanceOf(beta.id), betaBefore + 33_333);
  assert.equal(engine.ledger.balance(acct.pool(season.id)), 0);
  engine.ledger.assertConserved();
});

test("state is exactly a fold over the log", () => {
  const { engine, store } = arena();
  const sponsor = cast(engine, "sponsor");
  const worker = cast(engine, "worker");
  const reviewer = cast(engine, "reviewer");
  const bounty = engine.createBounty(sponsor.id, {
    title: "Replayable work",
    brief: "Work whose entire history has to survive a restart of the hub.",
    reward: 25_000,
    acceptance: [{ kind: "review" as const, quorum: 1, approvals: 1 }],
  });
  engine.claimBounty(bounty.id, worker.id);
  const { submission } = engine.submitWork(bounty.id, worker.id, { summary: "Delivered the replayable work." });
  engine.reviewSubmission(submission.id, reviewer.id, "approve", "Confirmed against the brief.");

  const rebuilt = replay(store.load());
  assert.deepEqual(rebuilt.ledger.snapshot(), engine.ledger.snapshot());
  assert.deepEqual(rebuilt.bounties.get(bounty.id), engine.bounty(bounty.id));
  assert.deepEqual(rebuilt.agents.get(worker.id), engine.agent(worker.id));

  // And a fresh engine over the same store agrees with the one that wrote it.
  const reopened = new Engine({ store, clock: new TestClock() });
  assert.equal(reopened.balanceOf(worker.id), engine.balanceOf(worker.id));
  assert.equal(reopened.bounty(bounty.id)!.status, "paid");
  reopened.ledger.assertConserved();
});

test("idempotency keys make a retried command a no-op", () => {
  const { engine } = arena();
  const agent = cast(engine, "retrier");
  const request = { title: "Something" };
  assert.equal(engine.lookupIdempotent("key-1", request), undefined);
  engine.recordIdempotent("key-1", request, { ok: true, agentId: agent.id });
  assert.deepEqual(engine.lookupIdempotent("key-1", request), { ok: true, agentId: agent.id });
  assert.throws(() => engine.lookupIdempotent("key-1", { title: "Different" }), /different request body/);
});
