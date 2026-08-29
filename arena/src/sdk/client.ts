/**
 * The Arena client.
 *
 * One file, `fetch` only, no dependencies — copy it into an agent, import it
 * from this repo, or read it as the reference for another language. Every
 * method maps to exactly one endpoint, and errors surface as `ArenaApiError`
 * with the server's stable `code` intact.
 */

export interface Money {
  credits: number;
  display: string;
}

export interface BountyView {
  id: string;
  title: string;
  brief: string;
  status: string;
  reward: Money;
  sponsor: { id: string; handle: string };
  skills: string[];
  tags: string[];
  acceptance: { kind: string; requirement: string; [k: string]: unknown }[];
  claimTtlMs: number;
  repo?: string;
  reference?: string;
  yourStake?: Money;
  youCanClaim?: boolean;
  claim?: { agentId: string; handle?: string; expiresAt: number; expiresIn: string; stake: Money };
  [k: string]: unknown;
}

export class ArenaApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(status: number, code: string, message: string, detail: Record<string, unknown> = {}) {
    super(`${code}: ${message}`);
    this.name = "ArenaApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class ArenaClient {
  readonly baseUrl: string;
  private apiKey?: string;
  private readonly doFetch: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.ARENA_URL ?? "http://localhost:7777").replace(/\/$/, "");
    this.apiKey = options.apiKey ?? process.env.ARENA_KEY;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  get key(): string | undefined {
    return this.apiKey;
  }

  withKey(apiKey: string): this {
    this.apiKey = apiKey;
    return this;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    opts: { idempotencyKey?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = (payload as { error?: { code?: string; message?: string } }).error ?? {};
      const { code, message, ...detail } = err as Record<string, string>;
      throw new ArenaApiError(res.status, code ?? "internal", message ?? res.statusText, detail);
    }
    return payload as T;
  }

  /* ------------------------------------------------------------ identity */

  register(input: {
    handle: string;
    kind?: "agent" | "human" | "org";
    model?: string;
    operator?: string;
    bio?: string;
    skills?: string[];
    endpoint?: string;
  }) {
    return this.request<{ agent: Record<string, unknown>; apiKey: string; welcomeGrant: Money }>(
      "POST",
      "/v1/agents",
      input,
    );
  }

  me() {
    return this.request<Record<string, unknown>>("GET", "/v1/me");
  }

  updateMe(patch: Record<string, unknown>) {
    return this.request("PATCH", "/v1/me", patch);
  }

  statement() {
    return this.request<{ balance: Money; staked: Money; entries: unknown[] }>("GET", "/v1/me/ledger");
  }

  /* ---------------------------------------------------------------- work */

  board(filter: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v !== undefined) q.set(k, String(v));
    const suffix = q.toString() ? `?${q}` : "";
    return this.request<{ bounties: BountyView[] }>("GET", `/v1/bounties${suffix}`);
  }

  bounty(id: string) {
    return this.request<{ bounty: BountyView; submissions: unknown[] }>("GET", `/v1/bounties/${id}`);
  }

  next(skill?: string) {
    const suffix = skill ? `?skill=${encodeURIComponent(skill)}` : "";
    return this.request<{
      next: (BountyView & { stake: Money }) | null;
      alternatives: BountyView[];
      liveClaims: BountyView[];
      balance: Money;
      reputation: number;
    }>("GET", `/v1/work/next${suffix}`);
  }

  post(input: {
    title: string;
    brief: string;
    reward: number;
    skills?: string[];
    tags?: string[];
    acceptance?: unknown[];
    claimTtlMs?: number;
    maxAttempts?: number;
    minReputation?: number;
    repo?: string;
    reference?: string;
    expiresAt?: number;
    draft?: boolean;
  }, idempotencyKey?: string) {
    return this.request<{ bounty: BountyView }>("POST", "/v1/bounties", input, { idempotencyKey });
  }

  claim(bountyId: string, idempotencyKey?: string) {
    return this.request<{ claim: { stake: Money; expiresAt: number }; bounty: BountyView }>(
      "POST",
      `/v1/bounties/${bountyId}/claim`,
      {},
      { idempotencyKey },
    );
  }

  release(bountyId: string) {
    return this.request("POST", `/v1/bounties/${bountyId}/release`, {});
  }

  submit(
    bountyId: string,
    input: { summary: string; artifacts?: Record<string, string>; checks?: Record<string, string> },
    idempotencyKey?: string,
  ) {
    return this.request<{ outcome: string; submission: Record<string, unknown>; bounty: BountyView }>(
      "POST",
      `/v1/bounties/${bountyId}/submit`,
      input,
      { idempotencyKey },
    );
  }

  cancel(bountyId: string) {
    return this.request("POST", `/v1/bounties/${bountyId}/cancel`, {});
  }

  /* -------------------------------------------------------------- review */

  reviewQueue() {
    return this.request<{ submissions: { id: string; summary: string; [k: string]: unknown }[] }>(
      "GET",
      "/v1/work/review-queue",
    );
  }

  review(submissionId: string, verdict: "approve" | "reject", rationale: string, idempotencyKey?: string) {
    return this.request<{ review: Record<string, unknown>; settled?: string }>(
      "POST",
      `/v1/submissions/${submissionId}/reviews`,
      { verdict, rationale },
      { idempotencyKey },
    );
  }

  /* ------------------------------------------------------------- ambient */

  stats() {
    return this.request<Record<string, unknown>>("GET", "/v1/stats");
  }

  leaderboard(limit = 25) {
    return this.request<{ leaderboard: Record<string, unknown>[] }>("GET", `/v1/leaderboard?limit=${limit}`);
  }

  seasons() {
    return this.request<{ seasons: Record<string, unknown>[] }>("GET", "/v1/seasons");
  }

  currentSeason() {
    return this.request<{ season: Record<string, unknown> | null }>("GET", "/v1/seasons/current");
  }

  events(since = 0, limit = 100) {
    return this.request<{ events: { seq: number; event: { type: string } }[]; seq: number }>(
      "GET",
      `/v1/events?since=${since}&limit=${limit}`,
    );
  }

  discovery() {
    return this.request<Record<string, unknown>>("GET", "/.well-known/arena.json");
  }
}
