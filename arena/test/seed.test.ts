import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine/engine.ts";
import { MemoryStore } from "../src/store/store.ts";
import { TestClock } from "../src/core/clock.ts";
import { assertBoardIsEnterable, seedArena } from "../src/cli/seed.ts";
import { ALL_SEED_BOUNTIES } from "../seed/roadmap.ts";
import { validateAcceptance } from "../src/domain/verify.ts";
import { stakeRequired } from "../src/domain/reputation.ts";
import { credits } from "../src/core/money.ts";

const fresh = () => new Engine({ store: new MemoryStore(), clock: new TestClock() });

test("seeding stands up a funded board, a season and a sponsor", () => {
  const engine = fresh();
  const result = seedArena(engine);
  assert.equal(result.posted, ALL_SEED_BOUNTIES.length);
  assert.ok(result.apiKey?.startsWith("ark_"));
  assert.equal(engine.listBounties({ status: "open" }).length, ALL_SEED_BOUNTIES.length);
  assert.ok(engine.currentSeason());
  assert.equal(engine.ledger.balance(`agent:${result.sponsorId}`), 0, "every seeded credit is escrowed, not idle");
  engine.ledger.assertConserved();
});

test("seeding twice does not double-post the roadmap", () => {
  const engine = fresh();
  seedArena(engine);
  const again = seedArena(engine);
  assert.equal(again.posted, 0);
  assert.equal(again.skipped, ALL_SEED_BOUNTIES.length);
  assert.equal(engine.listBounties({ status: "open" }).length, ALL_SEED_BOUNTIES.length);
});

test("a newcomer with nothing but the welcome grant can always start", () => {
  const engine = fresh();
  seedArena(engine);
  const { agent } = engine.registerAgent({ handle: "brand-new" });

  const affordable = engine
    .listBounties({ status: "open" })
    .filter(
      (b) =>
        b.minReputation <= engine.reputationOf(agent.id) &&
        stakeRequired(b.reward, engine.reputationOf(agent.id), engine.policy) <= engine.balanceOf(agent.id),
    );
  assert.ok(affordable.length > 0, "the board has an on-ramp");

  // And it works in practice, not just on paper.
  const claim = engine.claimBounty(affordable[0].id, agent.id);
  assert.ok(claim.stake <= engine.policy.welcomeGrant);
  engine.ledger.assertConserved();
});

test("the enterability guard actually fires when the on-ramp is missing", () => {
  const engine = new Engine({ store: new MemoryStore(), clock: new TestClock(), policy: { welcomeGrant: credits(1) } });
  const { agent } = engine.registerAgent({ handle: "whale" });
  engine.issueCredits(agent.id, 10_000_000, "test");
  engine.createBounty(agent.id, {
    title: "Only whales need apply",
    brief: "A bounty so large that no newcomer could ever post the stake to claim it.",
    reward: 5_000_000,
  });
  assert.throws(() => assertBoardIsEnterable(engine), /claimable on a welcome grant/);
});

test("every seeded bounty states criteria an agent could actually satisfy", () => {
  for (const seed of ALL_SEED_BOUNTIES) {
    assert.ok(seed.brief.length > 200, `${seed.title}: a brief has to be actionable on its own`);
    assert.ok(seed.skills.length > 0, `${seed.title}: needs skills so it can be matched`);
    assert.ok(seed.reward >= 100, `${seed.title}: reward below the floor`);
    if (seed.acceptance) {
      assert.deepEqual(validateAcceptance(seed.acceptance), [], `${seed.title}: acceptance criteria are invalid`);
    }
  }
});
