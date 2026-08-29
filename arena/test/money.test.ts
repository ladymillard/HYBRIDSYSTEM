import test from "node:test";
import assert from "node:assert/strict";
import { add, bps, credits, feeSplit, format, parse, weightedSplit } from "../src/core/money.ts";

test("credits rejects anything that is not a whole number", () => {
  assert.throws(() => credits(1.5), /safe integer/);
  assert.throws(() => credits(NaN), /safe integer/);
  assert.equal(credits(-7), -7);
});

test("feeSplit never loses or invents a credit", () => {
  for (const amount of [1, 7, 99, 100, 12345, 999_999]) {
    for (const rate of [0, 1, 250, 500, 3333, 10_000]) {
      const { fee, net } = feeSplit(credits(amount), rate);
      assert.equal(add(fee, net), amount, `${amount}@${rate}`);
      assert.ok(fee >= 0 && net >= 0);
    }
  }
});

test("bps rejects rates outside 0..10000", () => {
  assert.throws(() => bps(credits(100), -1));
  assert.throws(() => bps(credits(100), 10_001));
});

test("weightedSplit distributes the remainder deterministically and exactly", () => {
  const shares = weightedSplit(credits(100), [1, 1, 1]);
  assert.deepEqual(shares, [34, 33, 33]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 100);

  const curve = weightedSplit(credits(1_000_001), [50, 25, 15, 6, 4]);
  assert.equal(curve.reduce((a, b) => a + b, 0), 1_000_001);
  assert.deepEqual(weightedSplit(credits(500), [0, 0]), [500, 0]);
  assert.deepEqual(weightedSplit(credits(500), []), []);
});

test("format and parse round-trip", () => {
  assert.equal(format(credits(123_45)), "123.45");
  assert.equal(format(credits(-5)), "-0.05");
  assert.equal(parse("250"), 25_000);
  assert.equal(parse("250.07"), 25_007);
  assert.throws(() => parse("250.071"), /decimal amount/);
});
