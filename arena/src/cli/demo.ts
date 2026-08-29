/**
 * A market, in one process.
 *
 * `node arena/bin/arena.ts demo` runs a whole cycle — sponsors funding work,
 * agents claiming it, honest and dishonest deliveries, peer review, slashing,
 * a season closing — and prints the money trail. It is the fastest way to see
 * whether a change to the economics did what you intended, and it asserts the
 * books balance at the end.
 */

import { DAY, TestClock } from "../core/clock.ts";
import { format } from "../core/money.ts";
import { Engine } from "../engine/engine.ts";
import { MemoryStore } from "../store/store.ts";
import { seedArena } from "./seed.ts";

export interface DemoOptions {
  verbose?: boolean;
}

export async function runDemo(options: DemoOptions = {}): Promise<Engine> {
  const clock = new TestClock();
  const engine = new Engine({ store: new MemoryStore(), clock });
  const say = (line = "") => options.verbose !== false && console.log(line);

  say("\n  ARENA — a market in one process\n");
  const seeded = seedArena(engine, { seasonDays: 30 });
  say(`  seeded ${seeded.posted} roadmap bounties, ${format(seeded.totalEscrowed as never)} escrowed`);

  const worker = (handle: string, skills: string[]) => {
    const { agent } = engine.registerAgent({ handle, skills, model: "demo" });
    engine.issueCredits(agent.id, 50_000, "demo working capital");
    return agent;
  };

  const scribe = worker("scribe", ["typescript", "protocol-design"]);
  const tinker = worker("tinker", ["typescript", "databases"]);
  const grifter = worker("grifter", ["typescript"]);
  const judgeA = worker("judge-a", ["typescript"]);
  const judgeB = worker("judge-b", ["typescript"]);

  // Newcomers cannot touch the reputation-gated work, which is the point of
  // gating it — the demo picks from what an unproven agent could actually take.
  const board = engine.listBounties({ status: "open" }).filter((b) => b.minReputation === 0);
  const good = board[0];
  const other = board[1];
  const abandoned = board[2];

  say(`\n  ── honest work ─────────────────────────────────────────────`);
  const claim = engine.claimBounty(good.id, scribe.id);
  say(`  scribe claims "${good.title.slice(0, 48)}…"`);
  say(`    reward ${format(good.reward)}   stake locked ${format(claim.stake)}`);
  const delivered = engine.submitWork(good.id, scribe.id, {
    summary: "Implemented the appeal flow with new engine commands, events and tests.",
    artifacts: { pr: "https://github.com/ladymillard/hybridsystem/pull/1" },
    checks: { "arena-tests": "passed" },
  });
  say(`    submitted → ${delivered.outcome}`);
  engine.reviewSubmission(delivered.submission.id, judgeA.id, "approve", "Replays cleanly and the ledger stays conserved.");
  engine.reviewSubmission(delivered.submission.id, judgeB.id, "approve", "Checked the slash paths, they balance.");
  const paid = engine.bounty(good.id)!;
  say(`    accepted → paid ${format(paid.paidAmount!)} to scribe (fee ${format((good.reward - paid.paidAmount!) as never)})`);
  say(`    reviewers earned ${format(engine.balanceOf(judgeA.id) - 50_000 - engine.policy.welcomeGrant as never)} each`);

  say(`\n  ── work that does not meet the bar ─────────────────────────`);
  engine.claimBounty(other.id, grifter.id);
  const junk = engine.submitWork(other.id, grifter.id, {
    summary: "Renamed a few variables and called it done.",
    artifacts: { pr: "https://example.com/pr/0" },
    checks: { "arena-tests": "failed" },
  });
  say(`  grifter submits → ${junk.outcome}`);
  say(`    slashed ${format(engine.agent(grifter.id)!.stats.creditsSlashed)}, bounty is back on the board`);

  say(`\n  ── a claim that times out ──────────────────────────────────`);
  engine.claimBounty(abandoned.id, tinker.id);
  clock.advance(6 * DAY);
  const ticked = engine.tick();
  say(`  ${ticked.expiredClaims.length} claim expired; tinker slashed ${format(engine.agent(tinker.id)!.stats.creditsSlashed)}`);

  say(`\n  ── the season closes ───────────────────────────────────────`);
  clock.advance(31 * DAY);
  const closed = engine.tick().closedSeasons;
  const season = engine.season(closed[0] ?? seeded.seasonId!)!;
  for (const row of season.standings ?? []) {
    say(`  ${row.rank}. ${row.handle.padEnd(16)} earned ${format(row.earned).padStart(10)}   prize ${format(row.prize)}`);
  }

  say(`\n  ── the books ───────────────────────────────────────────────`);
  const stats = engine.marketStats();
  say(`  agents ${stats.agents}   open ${stats.openBounties}   paid ${stats.paidBounties}`);
  say(`  escrowed ${format(stats.escrowed)}   treasury ${format(stats.treasury)}   supply ${format(stats.supply)}`);
  engine.ledger.assertConserved();
  say(`  ledger conserved: every credit accounted for\n`);

  for (const id of [scribe.id, grifter.id, tinker.id, judgeA.id]) {
    const a = engine.agent(id)!;
    say(
      `  ${a.handle.padEnd(10)} balance ${format(engine.balanceOf(id)).padStart(10)}   rep ${String(engine.reputationOf(id)).padStart(4)}   ` +
        `done ${a.stats.bountiesCompleted}  slashed ${format(a.stats.creditsSlashed)}`,
    );
  }
  say("");
  return engine;
}
