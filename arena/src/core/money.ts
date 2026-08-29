/**
 * Money.
 *
 * The unit of account is the **credit**: an integer. 1 credit = USD 0.01 by
 * convention, but the engine never needs to know that — it only ever adds and
 * subtracts whole credits.
 *
 * Floating point is banned in this file and everywhere downstream of it. A
 * float in a ledger is a slow leak, and a leaking ledger is an unusable market.
 * Every function here either returns an exact integer or throws.
 */

import { ArenaError } from "./errors.ts";

export type Credits = number & { readonly __brand: "Credits" };

export const ZERO = 0 as Credits;

/** Assert-and-brand. Rejects floats, NaN, Infinity and values past 2^53. */
export function credits(n: number): Credits {
  if (!Number.isSafeInteger(n)) {
    throw new ArenaError("bad_request", "amount must be a safe integer number of credits", { got: n });
  }
  return n as Credits;
}

/** Like `credits()` but also rejects negatives — for user-supplied amounts. */
export function positiveCredits(n: number, field = "amount"): Credits {
  const c = credits(n);
  if (c <= 0) throw new ArenaError("bad_request", `${field} must be greater than zero`, { got: n });
  return c;
}

export function nonNegativeCredits(n: number, field = "amount"): Credits {
  const c = credits(n);
  if (c < 0) throw new ArenaError("bad_request", `${field} must not be negative`, { got: n });
  return c;
}

export const add = (a: Credits, b: Credits): Credits => credits(a + b);
export const sub = (a: Credits, b: Credits): Credits => credits(a - b);
export const sum = (xs: Credits[]): Credits => xs.reduce((a, b) => add(a, b), ZERO);
export const max = (a: Credits, b: Credits): Credits => (a > b ? a : b);
export const min = (a: Credits, b: Credits): Credits => (a < b ? a : b);

/**
 * Basis-point share, rounded *down*.
 *
 * Rounding down is deliberate and always in the payer's favour at the point of
 * fee extraction, which means the remainder stays with the worker rather than
 * evaporating. `feeSplit` below is the only sanctioned way to take a cut,
 * because it guarantees the two halves add back to the whole.
 */
export function bps(amount: Credits, rate: number): Credits {
  if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
    throw new ArenaError("bad_request", "rate must be an integer 0..10000 basis points", { got: rate });
  }
  return credits(Math.floor((amount * rate) / 10_000));
}

/** Split `amount` into `{ fee, net }` such that fee + net === amount, exactly. */
export function feeSplit(amount: Credits, rate: number): { fee: Credits; net: Credits } {
  const fee = bps(amount, rate);
  return { fee, net: sub(amount, fee) };
}

/**
 * Split `amount` across `weights` with no credit lost. Any rounding remainder
 * is distributed one credit at a time, highest weight first, then by index —
 * deterministic, so two nodes replaying the same log agree to the credit.
 */
export function weightedSplit(amount: Credits, weights: number[]): Credits[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new ArenaError("bad_request", "weights must be finite and non-negative");
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Degenerate: nobody has a claim on the pot. Give it all to the first slot.
    return weights.map((_, i) => (i === 0 ? amount : ZERO));
  }
  const shares = weights.map((w) => Math.floor((amount * w) / total));
  let remainder = amount - shares.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length) {
    shares[order[k].i] += 1;
    remainder -= 1;
  }
  return shares.map((s) => credits(s));
}

/** Render credits for humans: 12345 -> "123.45". Display only, never math. */
export function format(c: Credits): string {
  const neg = c < 0;
  const abs = Math.abs(c);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Parse "123.45" or "123" into credits. Rejects sub-credit precision. */
export function parse(input: string): Credits {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new ArenaError("bad_request", "expected a decimal amount like 250 or 250.00", { got: input });
  const whole = Number(m[2]);
  const frac = Number((m[3] ?? "0").padEnd(2, "0"));
  const value = whole * 100 + frac;
  return credits(m[1] === "-" ? -value : value);
}
