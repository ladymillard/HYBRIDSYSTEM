import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { Engine } from "../src/engine/engine.ts";
import { MemoryStore } from "../src/store/store.ts";
import { TestClock } from "../src/core/clock.ts";
import { createServer } from "../src/http/server.ts";
import { ArenaApiError, ArenaClient } from "../src/sdk/client.ts";
import { runWorker } from "../src/sdk/worker.ts";

const ADMIN = "operator-token-for-tests";

async function hub() {
  const engine = new Engine({ store: new MemoryStore(), clock: new TestClock() });
  const server = createServer({ engine, adminToken: ADMIN, tickIntervalMs: 0, rateLimit: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    engine,
    baseUrl,
    client: (apiKey?: string) => new ArenaClient({ baseUrl, apiKey }),
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function join(h: Awaited<ReturnType<typeof hub>>, handle: string, funding = 200_000) {
  const anon = h.client();
  const { agent, apiKey } = await anon.register({ handle, skills: ["typescript"] });
  if (funding > 0) h.engine.issueCredits(agent.id as string, funding, "test");
  return { id: agent.id as string, client: h.client(apiKey), apiKey };
}

test("the hub describes itself to a machine that has never seen it", async (t) => {
  const h = await hub();
  t.after(() => h.close());
  const doc = await h.client().discovery();
  assert.equal(doc.protocol, "arena/1");
  assert.ok(Array.isArray(doc.loop) && (doc.loop as string[]).length >= 3, "the work loop is spelled out");
  assert.equal((doc.authentication as { scheme: string }).scheme, "bearer");

  const health = await h.client().request<{ ok: boolean; solvent: boolean }>("GET", "/v1/health");
  assert.equal(health.ok, true);
  assert.equal(health.solvent, true);
});

test("an unauthenticated agent is told exactly how to fix it", async (t) => {
  const h = await hub();
  t.after(() => h.close());
  await assert.rejects(
    () => h.client().me(),
    (err: ArenaApiError) => {
      assert.equal(err.status, 401);
      assert.equal(err.code, "unauthorized");
      assert.match(err.message, /POST \/v1\/agents/);
      return true;
    },
  );
});

test("a full cycle over HTTP: post, claim, submit, review, paid", async (t) => {
  const h = await hub();
  t.after(() => h.close());

  const sponsor = await join(h, "acme-labs");
  const worker = await join(h, "worker-one");
  const r1 = await join(h, "judge-one");
  const r2 = await join(h, "judge-two");

  const { bounty } = await sponsor.client.post({
    title: "Write the changelog",
    brief: "Summarise everything merged since the last tag into a changelog entry.",
    reward: 40_000,
    skills: ["typescript"],
    acceptance: [
      { kind: "url", key: "pr" },
      { kind: "review", quorum: 2, approvals: 2 },
    ],
  });
  assert.equal(bounty.status, "open");

  const next = await worker.client.next();
  assert.equal(next.next?.id, bounty.id, "the work loop surfaces the only bounty on the board");
  assert.ok(next.next!.stake.credits > 0);

  await worker.client.claim(bounty.id);
  const submitted = await worker.client.submit(bounty.id, {
    summary: "Changelog written and linked below.",
    artifacts: { pr: "https://example.com/pr/12" },
  });
  assert.equal(submitted.outcome, "in_review");
  const submissionId = (submitted.submission as { id: string }).id;

  const queue = await r1.client.reviewQueue();
  assert.equal(queue.submissions.length, 1, "reviewers can find work to be paid for");

  await r1.client.review(submissionId, "approve", "Reads well and matches the merged commits.");
  const second = await r2.client.review(submissionId, "approve", "Cross-checked against the tag range.");
  assert.equal(second.settled, "accepted");

  const me = (await worker.client.me()) as { balance: { credits: number }; stats: { bountiesCompleted: number } };
  assert.equal(me.stats.bountiesCompleted, 1);
  assert.ok(me.balance.credits > 200_000, "the worker is up on the day");

  const board = await h.client().leaderboard();
  assert.equal((board.leaderboard[0] as { handle: string }).handle, "worker-one");
  h.engine.ledger.assertConserved();
});

test("a retried request with the same idempotency key does not claim twice", async (t) => {
  const h = await hub();
  t.after(() => h.close());
  const sponsor = await join(h, "sponsor");
  const worker = await join(h, "twitchy");
  const { bounty } = await sponsor.client.post({
    title: "Idempotent work",
    brief: "A bounty used to prove that a retried claim is not a second claim.",
    reward: 20_000,
  });

  const first = await worker.client.claim(bounty.id, "retry-key-1");
  const second = await worker.client.claim(bounty.id, "retry-key-1");
  assert.deepEqual(first, second, "the retry replays the original response");
  assert.equal(h.engine.activeClaims(worker.id).length, 1);

  // A different body under the same key is a bug on the caller's side, and the
  // hub says so rather than guessing which one was meant.
  await assert.rejects(
    () => worker.client.request("POST", "/v1/bounties", { title: "x" }, { idempotencyKey: "retry-key-1" }),
    /idempotency key reused/,
  );
});

test("operator routes are closed to agents and open to the operator", async (t) => {
  const h = await hub();
  t.after(() => h.close());
  const agent = await join(h, "curious");
  await assert.rejects(() => agent.client.request("POST", "/v1/admin/tick", {}), /operator token required/);

  const admin = new ArenaClient({ baseUrl: h.baseUrl, apiKey: ADMIN });
  const ticked = await admin.request<{ expiredClaims: string[] }>("POST", "/v1/admin/tick", {});
  assert.deepEqual(ticked.expiredClaims, []);
});

test("the ledger is public and the event feed is pollable", async (t) => {
  const h = await hub();
  t.after(() => h.close());
  const sponsor = await join(h, "public-books");
  const { bounty } = await sponsor.client.post({
    title: "Transparent work",
    brief: "A bounty posted so the escrow account can be inspected by anyone.",
    reward: 15_000,
  });

  const escrow = await h.client().request<{ balance: { credits: number } }>("GET", `/v1/ledger/escrow:${bounty.id}`);
  assert.equal(escrow.balance.credits, 15_000, "anyone can verify the money is really there");

  const feed = await h.client().events(0, 500);
  assert.ok(feed.events.some((e) => e.event.type === "bounty.created"));
  const tail = await h.client().events(feed.seq);
  assert.equal(tail.events.length, 0, "polling from the head returns nothing new");
});

test("the SDK work loop earns money end to end", async (t) => {
  const h = await hub();
  t.after(() => h.close());

  const sponsor = await join(h, "the-sponsor", 1_000_000);
  const hand = await join(h, "hired-hand");
  const judge = await join(h, "the-judge");

  for (let i = 0; i < 3; i++) {
    await sponsor.client.post({
      title: `Automatable task ${i}`,
      brief: "Produce the artifact named in the acceptance criteria and report the check as passed.",
      reward: 30_000,
      skills: ["typescript"],
      acceptance: [
        { kind: "artifact", key: "result" },
        { kind: "checks", names: ["self-test"] },
      ],
    });
  }

  const report = await runWorker({
    client: hand.client,
    maxJobs: 3,
    solve: async (b) => ({
      summary: `Completed ${b.title} as specified in the brief.`,
      artifacts: { result: `done:${b.id}` },
      checks: { "self-test": "passed" },
    }),
  });

  assert.equal(report.claimed, 3);
  assert.equal(report.accepted, 3, "all three cleared their automated criteria");
  assert.ok(report.earnedCredits > 0, `the loop finished up on the day, not down: ${report.earnedCredits}`);

  // And an agent that cannot do the work hands it back rather than sitting on it.
  await sponsor.client.post({
    title: "Work nobody takes",
    brief: "A bounty the worker will look at, decide it cannot finish, and release.",
    reward: 30_000,
    acceptance: [{ kind: "artifact", key: "result" }],
  });
  const quitter = await runWorker({ client: judge.client, maxJobs: 1, solve: async () => null });
  assert.equal(quitter.passed, 1);
  assert.equal(quitter.claimed, 1);
  assert.ok(quitter.earnedCredits < 0, "releasing a claim costs the abandon slash");
  h.engine.ledger.assertConserved();
});
