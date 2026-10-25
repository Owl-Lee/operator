import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fetchIcs, parseIcs, upcoming, type CourseItem } from "./ical.js";
import { diffSnapshots, type Change } from "./diff.js";
import { loadSnapshot, saveSnapshot, logTelegram, logAgent, loadAgentLog } from "./store.js";
import { changeTelegram, fmtTime } from "./telegram.js";
import { sendTelegram } from "./send.js";
import { triage, summarize } from "./triage.js";

const CONFIG = "data/config.json";
export interface Config { icalUrl?: string }

export function loadConfig(): Config {
  return existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : {};
}
export function saveConfig(c: Config): void {
  mkdirSync("data", { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(c, null, 2));
}
/** .env wins (your own machine); data/config.json is what the setup page writes for other users. */
export function icalUrl(): string | undefined {
  return process.env.BRIGHTSPACE_ICAL_URL || loadConfig().icalUrl;
}

export interface PollResult { items: CourseItem[]; changes: Change[]; firstRun: boolean; summary: ReturnType<typeof summarize> }

/** One polling cycle: fetch → parse → diff against snapshot → triage → log → telegrams. */
export async function runPoll(opts: { file?: string; now?: Date } = {}): Promise<PollResult> {
  const url = icalUrl();
  if (!opts.file && !url) throw new Error("No Brightspace iCal URL yet. Set BRIGHTSPACE_ICAL_URL in .env or save it on the Setup page.");
  const raw = opts.file ? readFileSync(opts.file, "utf8") : await fetchIcs(url!);
  const items = parseIcs(raw);
  const prev = loadSnapshot();
  const changes = prev.length ? diffSnapshots(prev, items) : [];
  saveSnapshot(items);

  const now = opts.now ?? (process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date());
  const tri = triage(items, now), summary = summarize(tri);
  const ignored = new Set(tri.filter(t => t.level === "ignore").map(t => t.uid));
  logAgent("poll", `Checked Brightspace: ${items.length} items. ${summary.urgent} urgent, ${summary.need} need-to-know, ${summary.ignore} filtered out.`, { ...summary, total: items.length });

  for (const c of changes) {
    const what = c.type === "moved" ? `moved from ${fmtTime(c.oldDue)} to ${fmtTime(c.item.due)}` : c.type === "new" ? `added, due ${fmtTime(c.item.due)}` : c.type;
    logAgent("change", `Detected ${c.item.course.split(" - ")[0]} · ${c.item.title} ${what}.`, { uid: c.item.uid, change: c.type });
    if (ignored.has(c.item.uid)) continue; // campus notices, old semesters, past items: never worth a telegram
    const text = changeTelegram(c);
    const send = !!process.env.IMESSAGE_PROJECT_ID;
    if (send) await sendTelegram(text);
    logTelegram(text, send);
    logAgent("telegram", `${send ? "Sent" : "Drafted"} telegram: ${text}`, { sent: send });
  }
  const already = new Set(loadAgentLog().filter(e => e.type === "reminder").map(e => e.meta?.uid));
  for (const i of upcoming(items, now, 7)) {
    if (already.has(i.uid)) continue;
    logAgent("reminder", `Scheduled reminders for ${i.course.split(" - ")[0]} · ${i.title}: 24 h, 3 h and 1 h before ${fmtTime(i.due)}.`, { uid: i.uid });
  }
  return { items, changes, firstRun: !prev.length, summary };
}
