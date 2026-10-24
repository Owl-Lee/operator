import "dotenv/config";
import { readFileSync } from "node:fs";
import { fetchIcs, parseIcs, upcoming } from "./ical.js";
import { diffSnapshots } from "./diff.js";
import { loadSnapshot, saveSnapshot } from "./store.js";
import { changeTelegram, fmtTime } from "./telegram.js";
import { sendTelegram } from "./send.js";

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
      if (process.env.IMESSAGE_PROJECT_ID) await sendTelegram(text);
    }
  }
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main();
