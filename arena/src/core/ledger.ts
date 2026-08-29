/**
 * Double-entry ledger.
 *
 * Every credit in the Arena exists in exactly one account at any instant, and
 * every movement is an entry whose legs sum to zero. Two invariants are checked
 * on every single post, not on a nightly job:
 *
 *   1. balanced   — the legs of an entry sum to zero, so credits are never
 *                   created or destroyed by a transfer;
 *   2. solvent    — no account except `system:mint` may go negative, so escrow
 *                   can never pay out money it was not funded with.
 *
 * `system:mint` is the single issuance account. Its balance is the negative of
 * all credits in circulation, which makes the money supply a number you can
 * read rather than a number you have to trust.
 */

import { ArenaError } from "./errors.ts";
import { add, credits, type Credits, ZERO } from "./money.ts";

export type Account = string;

export const acct = {
  /** An agent's spendable balance. */
  agent: (agentId: string): Account => `agent:${agentId}`,
  /** Funds locked against a specific bounty until it settles. */
  escrow: (bountyId: string): Account => `escrow:${bountyId}`,
  /** An agent's bonded stake, locked while a claim is live. */
  stake: (agentId: string): Account => `stake:${agentId}`,
  /** Protocol fees, and the source of review rewards. */
  treasury: (): Account => `treasury:fees`,
  /** A season's prize pool, paid out on close. */
  pool: (seasonId: string): Account => `pool:${seasonId}`,
  /** Issuance. The only account permitted to hold a negative balance. */
  mint: (): Account => `system:mint`,
};

export const MINT = acct.mint();

export interface Leg {
  account: Account;
  delta: Credits;
}

export interface LedgerEntry {
  id: string;
  ts: number;
  /** Machine-readable reason: "bounty.fund", "bounty.payout", "stake.slash", ... */
  kind: string;
  memo?: string;
  legs: Leg[];
  /** Backlinks so any credit can be traced to the object that moved it. */
  refs?: Record<string, string>;
}

export function transfer(
  id: string,
  ts: number,
  kind: string,
  from: Account,
  to: Account,
  amount: Credits,
  refs?: Record<string, string>,
  memo?: string,
): LedgerEntry {
  if (amount <= 0) throw new ArenaError("bad_request", "transfer amount must be positive", { amount });
  return {
    id,
    ts,
    kind,
    memo,
    refs,
    legs: [
      { account: from, delta: credits(-amount) },
      { account: to, delta: amount },
    ],
  };
}

export class Ledger {
  private balances = new Map<Account, Credits>();
  private entries: LedgerEntry[] = [];
  private byAccount = new Map<Account, number[]>();

  balance(account: Account): Credits {
    return this.balances.get(account) ?? ZERO;
  }

  /** Total credits issued — i.e. everything not still sitting in the mint. */
  supply(): Credits {
    return credits(-this.balance(MINT));
  }

  accounts(prefix?: string): Account[] {
    const all = [...this.balances.keys()].sort();
    return prefix ? all.filter((a) => a.startsWith(prefix)) : all;
  }

  history(account: Account, limit = 50): LedgerEntry[] {
    const idx = this.byAccount.get(account) ?? [];
    return idx
      .slice(-limit)
      .reverse()
      .map((i) => this.entries[i]);
  }

  all(limit = 200): LedgerEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  /** Would this entry succeed? Used to reject a command before it emits events. */
  check(entry: LedgerEntry): void {
    const total = entry.legs.reduce((a, l) => a + l.delta, 0);
    if (total !== 0) {
      throw new ArenaError("ledger_imbalance", "entry legs must sum to zero", { kind: entry.kind, total });
    }
    if (entry.legs.length === 0) {
      throw new ArenaError("ledger_imbalance", "entry must have legs", { kind: entry.kind });
    }
    for (const leg of entry.legs) {
      const next = this.balance(leg.account) + leg.delta;
      if (next < 0 && leg.account !== MINT) {
        throw new ArenaError("insufficient_funds", `account ${leg.account} would go negative`, {
          account: leg.account,
          balance: this.balance(leg.account),
          delta: leg.delta,
        });
      }
    }
  }

  apply(entry: LedgerEntry): void {
    this.check(entry);
    const index = this.entries.length;
    this.entries.push(entry);
    for (const leg of entry.legs) {
      this.balances.set(leg.account, add(this.balance(leg.account), leg.delta));
      const idx = this.byAccount.get(leg.account) ?? [];
      idx.push(index);
      this.byAccount.set(leg.account, idx);
    }
  }

  /**
   * The books must balance globally: mint's negative exactly offsets every
   * other account. Called after every command in tests and by `GET /v1/health`
   * in production — a market that cannot prove it is solvent is not a market.
   */
  assertConserved(): void {
    let total = 0;
    for (const v of this.balances.values()) total += v;
    if (total !== 0) {
      throw new ArenaError("ledger_imbalance", "ledger does not sum to zero", { total });
    }
  }

  snapshot(): Record<Account, Credits> {
    return Object.fromEntries([...this.balances.entries()].sort());
  }
}
