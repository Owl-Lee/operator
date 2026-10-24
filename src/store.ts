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

export function logAgent(type: AgentEntry["type"], text: string, meta?: Record<string, unknown>, opts?: { collapseKey?: string }): void {
  mkdirSync(DIR, { recursive: true });
  const log = loadAgentLog();
  // Flipping the same item back and forth should read as one line, not a wall of done/undone.
  if (opts?.collapseKey && log[0]?.meta?.collapseKey === opts.collapseKey) log.shift();
  if (opts?.collapseKey) meta = { ...(meta ?? {}), collapseKey: opts.collapseKey };
  log.unshift({ at: new Date().toISOString(), type, text, ...(meta ? { meta } : {}) });
  writeFileSync(AGENT, JSON.stringify(log.slice(0, 300), null, 2));
}

/** Deadlines the user has marked done (from the phone or the dashboard). Reminders skip these. */
export interface DoneEntry { uid: string; title: string; at: string; via: "imessage" | "web" }
const DONE = `${DIR}/done.json`;
export function loadDone(): DoneEntry[] {
  return existsSync(DONE) ? JSON.parse(readFileSync(DONE, "utf8")) : [];
}
export function markDone(uid: string, title: string, via: DoneEntry["via"]): void {
  mkdirSync(DIR, { recursive: true });
  const list = loadDone().filter(d => d.uid !== uid);
  list.unshift({ uid, title, at: new Date().toISOString(), via });
  writeFileSync(DONE, JSON.stringify(list, null, 2));
}
export function unmarkDone(uid: string): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(DONE, JSON.stringify(loadDone().filter(d => d.uid !== uid), null, 2));
}

/** Which escalating reminders (uid + hours-before) have already gone out. */
const SENT = `${DIR}/reminders-sent.json`;
export function loadSentReminders(): string[] {
  return existsSync(SENT) ? JSON.parse(readFileSync(SENT, "utf8")) : [];
}
export function markReminderSent(key: string): void {
  mkdirSync(DIR, { recursive: true });
  const list = loadSentReminders(); if (!list.includes(key)) list.push(key);
  writeFileSync(SENT, JSON.stringify(list.slice(-500), null, 2));
}
