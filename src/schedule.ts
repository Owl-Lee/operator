import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadSnapshot, loadDone } from "./store.js";
import { triage } from "./triage.js";

/** Classes / meetings / events / pasted deadlines that Brightspace doesn't know about (user-edited JSON). */
export interface Schedule { classes: any[]; meetings: any[]; events: any[]; deadlines: any[]; _readme?: string }
const schedulePath = new URL("../schedule.json", import.meta.url);

export function loadSchedule(): Schedule {
  const s = existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, "utf8")) : {};
  return { classes: [], meetings: [], events: [], deadlines: [], ...s };
}
export function saveSchedule(s: Schedule): void {
  writeFileSync(schedulePath, JSON.stringify(s, null, 2));
}

const fmt = (d: Date | string | number) => new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Every open deadline the agent is tracking (Brightspace + pasted), with ids the brain can refer to. */
export function openDeadlines(now: Date) {
  const n = now.getTime(), done = new Set(loadDone().map(d => d.uid));
  const items = loadSnapshot(), tri = triage(items, now);
  const out: { uid: string; title: string; course: string; kind: string; due: string; level: string; done: boolean }[] = [];
  for (const i of items) {
    const t = tri.find(x => x.uid === i.uid);
    if (!i.isDue || t?.level === "ignore" || Date.parse(i.due) < n) continue;
    out.push({ uid: i.uid, title: i.title, course: i.course.split(" - ")[0], kind: i.kind, due: i.due, level: t?.level ?? "need", done: done.has(i.uid) });
  }
  for (const d of loadSchedule().deadlines) if (Date.parse(d.start) >= n) out.push({ uid: d.id, title: d.title, course: d.course ?? "pasted", kind: "deadline", due: d.start, level: "need", done: done.has(d.id) });
  return out.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
}

/** Plain-text dump of the next two weeks for Gemini. */
export function scheduleContext(now: Date): string {
  const n = now.getTime(), end = n + 14 * 864e5, s = loadSchedule(), lines: string[] = [];
  for (const d of openDeadlines(now)) if (Date.parse(d.due) <= end) lines.push(`DEADLINE id=${d.uid} [${d.level}${d.done ? ", DONE" : ""}] ${d.course} · ${d.title} (${d.kind}) due ${fmt(d.due)}`);
  for (const c of s.classes) lines.push(`CLASS ${c.course.split(" - ")[0]} every ${c.days.join("/")} ${c.start}–${c.end}${c.location ? " at " + c.location : ""}`);
  for (const m of s.meetings) lines.push(`MEETING ${m.title} ${fmt(m.start)}${m.location ? " at " + m.location : ""}${m.note ? " — " + m.note : ""}`);
  for (const e of s.events) lines.push(`EVENT ${e.title} ${fmt(e.start)}${e.end ? " → " + fmt(e.end) : ""}${e.location ? " at " + e.location : ""}${e.milestone ? ` — milestone: ${e.milestone.title} at ${fmt(e.milestone.at)}` : ""}`);
  return lines.join("\n") || "(empty)";
}
