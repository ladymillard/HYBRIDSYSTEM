/**
 * Time.
 *
 * The engine never calls `Date.now()` directly. It takes a `Clock`, so tests
 * can advance time by a week without sleeping and replays are deterministic.
 */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export class TestClock implements Clock {
  private t: number;
  constructor(start: number = Date.UTC(2026, 0, 1)) {
    this.t = start;
  }
  now() {
    return this.t;
  }
  advance(ms: number) {
    this.t += ms;
    return this.t;
  }
  set(ms: number) {
    this.t = ms;
    return this.t;
  }
}

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

export function durationToString(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)}s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / DAY)}d`;
}
