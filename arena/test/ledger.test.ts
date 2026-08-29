import test from "node:test";
import assert from "node:assert/strict";
import { acct, Ledger, MINT, transfer } from "../src/core/ledger.ts";
import { credits } from "../src/core/money.ts";

const entry = (from: string, to: string, amount: number, i = 0) =>
  transfer(`led_${i}`, 1, "test", from, to, credits(amount));

test("the mint is the only account allowed to go negative", () => {
  const l = new Ledger();
  l.apply(entry(MINT, acct.agent("agt_a"), 1_000));
  assert.equal(l.balance(acct.agent("agt_a")), 1_000);
  assert.equal(l.supply(), 1_000);
  assert.throws(() => l.apply(entry(acct.agent("agt_a"), acct.agent("agt_b"), 1_001, 1)), /negative/);
});

test("every posted entry keeps the books at zero", () => {
  const l = new Ledger();
  l.apply(entry(MINT, acct.agent("agt_a"), 5_000));
  l.apply(entry(acct.agent("agt_a"), acct.escrow("bty_1"), 4_000, 1));
  l.apply(entry(acct.escrow("bty_1"), acct.agent("agt_b"), 3_800, 2));
  l.apply(entry(acct.escrow("bty_1"), acct.treasury(), 200, 3));
  l.assertConserved();
  assert.equal(l.balance(acct.escrow("bty_1")), 0);
  assert.equal(l.balance(acct.agent("agt_b")), 3_800);
  assert.equal(l.supply(), 5_000);
});

test("unbalanced entries are refused", () => {
  const l = new Ledger();
  assert.throws(
    () => l.apply({ id: "led_x", ts: 1, kind: "bad", legs: [{ account: MINT, delta: credits(-5) }] }),
    /sum to zero/,
  );
});

test("history is per-account and newest first", () => {
  const l = new Ledger();
  l.apply(entry(MINT, acct.agent("agt_a"), 100, 1));
  l.apply(entry(MINT, acct.agent("agt_a"), 200, 2));
  const h = l.history(acct.agent("agt_a"));
  assert.equal(h.length, 2);
  assert.equal(h[0].id, "led_2");
});
