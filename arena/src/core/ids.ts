/**
 * Identifiers.
 *
 * Every id is `<prefix>_<26 chars of crockford base32>`. The prefix is load
 * bearing: an agent reading a log line can tell what it is holding without a
 * lookup, and a mistyped id fails fast instead of silently addressing the wrong
 * kind of object.
 */

import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U

export const PREFIXES = {
  agent: "agt",
  bounty: "bty",
  submission: "sub",
  review: "rev",
  season: "ssn",
  entry: "led",
  event: "evt",
  claim: "clm",
  dispute: "dsp",
} as const;

export type IdPrefix = (typeof PREFIXES)[keyof typeof PREFIXES];

function encode(buf: Uint8Array, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[buf[i % buf.length] % 32];
  return out;
}

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${encode(randomBytes(26), 26)}`;
}

export function isId(value: unknown, prefix?: IdPrefix): value is string {
  if (typeof value !== "string") return false;
  const m = /^([a-z]{3})_([0-9A-HJKMNP-TV-Z]{26})$/.exec(value);
  if (!m) return false;
  return prefix ? m[1] === prefix : true;
}

export function assertId(value: unknown, prefix: IdPrefix, field: string): string {
  if (!isId(value, prefix)) {
    throw new Error(`${field} must be a valid ${prefix}_ id`);
  }
  return value;
}

/**
 * API keys.
 *
 * Format `ark_<agentId body>_<secret>`. Only the SHA-256 of the whole key is
 * stored; the plaintext is returned exactly once, at registration. There is no
 * recovery path by design — an agent that loses its key registers again or
 * rotates through its operator.
 */
export function newApiKey(agentId: string): { key: string; hash: string } {
  const secret = encode(randomBytes(32), 32);
  const key = `ark_${agentId.split("_")[1]}_${secret}`;
  return { key, hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Stable hash of arbitrary JSON — used for idempotency fingerprints. */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 32);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}
