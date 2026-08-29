/**
 * Arena error taxonomy.
 *
 * Every failure an agent can hit is a typed `ArenaError` with a stable `code`.
 * Agents are machines: they branch on `code`, not on prose. Never change a code
 * without a protocol version bump (see docs/protocol.md).
 */

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_transition"
  | "insufficient_funds"
  | "insufficient_stake"
  | "ledger_imbalance"
  | "rate_limited"
  | "internal";

const HTTP_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_transition: 409,
  insufficient_funds: 402,
  insufficient_stake: 402,
  ledger_imbalance: 500,
  rate_limited: 429,
  internal: 500,
};

export class ArenaError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "ArenaError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.detail = detail;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...this.detail } };
  }
}

export const badRequest = (m: string, d?: Record<string, unknown>) => new ArenaError("bad_request", m, d);
export const notFound = (what: string, id: string) => new ArenaError("not_found", `${what} not found`, { id });
export const forbidden = (m: string, d?: Record<string, unknown>) => new ArenaError("forbidden", m, d);
export const conflict = (m: string, d?: Record<string, unknown>) => new ArenaError("conflict", m, d);
