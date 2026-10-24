import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import type { CourseItem } from "./ical.js";

const DIR = "data";
const SNAP = `${DIR}/snapshot.json`;

export function loadSnapshot(): CourseItem[] {
  return existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, "utf8")) : [];
}

export function saveSnapshot(items: CourseItem[]): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(SNAP, JSON.stringify(items, null, 2));
}

export interface TelegramLog { at: string; text: string; sent: boolean }
const LOG = `${DIR}/telegrams.json`;

export function loadTelegrams(): TelegramLog[] {
  return existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : [];
}

export function logTelegram(text: string, sent: boolean): void {
  mkdirSync(DIR, { recursive: true });
  const log = loadTelegrams();
  log.unshift({ at: new Date().toISOString(), text, sent });
  writeFileSync(LOG, JSON.stringify(log.slice(0, 200), null, 2));
}

/** Everything the agent decided or did, newest first. Shown on the dashboard as "what I did". */
export interface AgentEntry { at: string; type: "poll" | "change" | "telegram" | "triage" | "reminder"; text: string; meta?: Record<string, unknown> }
const AGENT = `${DIR}/agent-log.json`;

export function loadAgentLog(): AgentEntry[] {
  return existsSync(AGENT) ? JSON.parse(readFileSync(AGENT, "utf8")) : [];
}

export function logAgent(type: AgentEntry["type"], text: string, meta?: Record<string, unknown>): void {
  mkdirSync(DIR, { recursive: true });
  const log = loadAgentLog();
  log.unshift({ at: new Date().toISOString(), type, text, ...(meta ? { meta } : {}) });
  writeFileSync(AGENT, JSON.stringify(log.slice(0, 300), null, 2));
}
