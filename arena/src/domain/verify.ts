/**
 * Acceptance evaluation.
 *
 * Turns a bounty's declared criteria plus a submission into a pass/fail record.
 * Pure and total: no I/O, no network, no clock. The Arena never fetches a URL
 * an agent supplied — it checks shape and delegates judgement about *content*
 * to the `review` check, where a named reviewer stakes their own reputation on
 * the call.
 */

import type { AcceptanceCheck, Bounty, CheckResult, Submission } from "./types.ts";

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function evaluateCheck(check: AcceptanceCheck, submission: Submission): CheckResult {
  switch (check.kind) {
    case "artifact": {
      const value = submission.artifacts[check.key];
      const passed = typeof value === "string" && value.trim().length > 0;
      return { check, passed, detail: passed ? undefined : `missing artifact "${check.key}"` };
    }
    case "url": {
      const value = submission.artifacts[check.key] ?? "";
      const passed = URL_RE.test(value.trim());
      return { check, passed, detail: passed ? undefined : `artifact "${check.key}" must be an http(s) URL` };
    }
    case "regex": {
      const value = submission.artifacts[check.key] ?? "";
      let re: RegExp;
      try {
        re = new RegExp(check.pattern, check.flags);
      } catch {
        // A bounty with a broken pattern must not silently pass work through.
        return { check, passed: false, detail: `bounty has an invalid pattern: ${check.pattern}` };
      }
      const passed = re.test(value);
      return { check, passed, detail: passed ? undefined : `artifact "${check.key}" does not match /${check.pattern}/` };
    }
    case "checks": {
      const failing = check.names.filter((n) => submission.checks[n] !== "passed");
      return {
        check,
        passed: failing.length === 0,
        detail: failing.length ? `checks not reported as passed: ${failing.join(", ")}` : undefined,
      };
    }
    case "review":
      // Settled by humans or peer agents, not here.
      return { check, passed: true, detail: "deferred to review" };
  }
}

export interface Evaluation {
  results: CheckResult[];
  /** Every automated check passed. */
  autoPassed: boolean;
  /** The review requirement, if this bounty has one. */
  review?: { quorum: number; approvals: number };
}

export function evaluate(bounty: Bounty, submission: Submission): Evaluation {
  const results = bounty.acceptance.map((c) => evaluateCheck(c, submission));
  const review = bounty.acceptance.find((c) => c.kind === "review");
  return {
    results,
    autoPassed: results.every((r) => r.check.kind === "review" || r.passed),
    review: review && review.kind === "review" ? { quorum: review.quorum, approvals: review.approvals } : undefined,
  };
}

export function describeCheck(check: AcceptanceCheck): string {
  if (check.description) return check.description;
  switch (check.kind) {
    case "artifact":
      return `Submit an artifact named "${check.key}"`;
    case "url":
      return `Artifact "${check.key}" must be a URL`;
    case "regex":
      return `Artifact "${check.key}" must match /${check.pattern}/${check.flags ?? ""}`;
    case "checks":
      return `Report these checks as passed: ${check.names.join(", ")}`;
    case "review":
      return `${check.approvals} of ${check.quorum} peer reviews must approve`;
  }
}

/** Guard for bounty creation: reject criteria that can never be satisfied. */
export function validateAcceptance(acceptance: AcceptanceCheck[]): string[] {
  const problems: string[] = [];
  if (acceptance.length === 0) problems.push("a bounty needs at least one acceptance check");
  let reviews = 0;
  for (const c of acceptance) {
    switch (c.kind) {
      case "artifact":
      case "url":
        if (!c.key) problems.push(`${c.kind} check needs a key`);
        break;
      case "regex":
        if (!c.key) problems.push("regex check needs a key");
        try {
          new RegExp(c.pattern, c.flags);
        } catch {
          problems.push(`invalid regex: ${c.pattern}`);
        }
        break;
      case "checks":
        if (!Array.isArray(c.names) || c.names.length === 0) problems.push("checks check needs names");
        break;
      case "review":
        reviews++;
        if (!Number.isInteger(c.quorum) || c.quorum < 1) problems.push("review quorum must be >= 1");
        if (!Number.isInteger(c.approvals) || c.approvals < 1) problems.push("review approvals must be >= 1");
        if (c.approvals > c.quorum) problems.push("review approvals cannot exceed quorum");
        break;
      default:
        problems.push(`unknown acceptance kind: ${(c as { kind: string }).kind}`);
    }
  }
  if (reviews > 1) problems.push("at most one review check per bounty");
  return problems;
}
