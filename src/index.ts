import "dotenv/config";
import { readFileSync } from "node:fs";
import { fetchIcs, parseIcs, upcoming } from "./ical.js";
import { diffSnapshots } from "./diff.js";
import { loadSnapshot, saveSnapshot, logTelegram, logAgent, loadAgentLog } from "./store.js";
import { changeTelegram, fmtTime } from "./telegram.js";
import { sendTelegram } from "./send.js";
import { triage, summarize } from "./triage.js";

/**
 * One polling cycle:
 *   npm run poll              → uses BRIGHTSPACE_ICAL_URL from .env
 *   npm run poll -- fixtures/sample.ics   → offline test file
 */
async function main() {
  const fileArg = process.argv[2];
  const raw = fileArg
    ? readFileSync(fileArg, "utf8")
    : await fetchIcs(process.env.BRIGHTSPACE_ICAL_URL ?? die("Set BRIGHTSPACE_ICAL_URL in .env"));

  const items = parseIcs(raw);
  const prev = loadSnapshot();
  const changes = prev.length ? diffSnapshots(prev, items) : [];
  saveSnapshot(items);

  const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
  const t = triage(items, now), sum = summarize(t);
  logAgent("poll", `Checked Brightspace: ${items.length} items. ${sum.urgent} urgent, ${sum.need} need-to-know, ${sum.ignore} filtered out.`, { ...sum, total: items.length });
  for (const c of changes) {
    const what = c.type === "moved" ? `moved from ${fmtTime(c.oldDue)} to ${fmtTime(c.item.due)}` : c.type === "new" ? `added, due ${fmtTime(c.item.due)}` : c.type;
    logAgent("change", `Detected ${c.item.course.split(" - ")[0]} · ${c.item.title} ${what}.`, { uid: c.item.uid, change: c.type });
  }
  const already = new Set(loadAgentLog().filter(e => e.type === "reminder").map(e => e.meta?.uid));
  for (const i of upcoming(items, now, 7)) {
    if (already.has(i.uid)) continue;
    logAgent("reminder", `Scheduled reminders for ${i.course.split(" - ")[0]} · ${i.title}: 24 h, 3 h and 1 h before ${fmtTime(i.due)}.`, { uid: i.uid });
  }
  console.log(`📠 ${items.length} events parsed. Next 14 days:`);
  for (const i of upcoming(items, now)) {
    console.log(`  • ${fmtTime(i.due).padEnd(24)} [${i.kind}] ${i.course.split(" - ")[0]} — ${i.title}`);
  }

  if (!prev.length) console.log("\n(First run: snapshot saved. Run again to detect changes.)");
  else if (!changes.length) console.log("\nNo changes since last poll.");
  else {
    console.log(`\n🔔 ${changes.length} change(s):`);
    for (const c of changes) {
      const text = changeTelegram(c);
      console.log("  " + text);
      const send = !!process.env.IMESSAGE_PROJECT_ID;
      if (send) await sendTelegram(text);
      logTelegram(text, send);
      logAgent("telegram", `${send ? "Sent" : "Drafted"} telegram: ${text}`, { sent: send });
    }
  }
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main();
