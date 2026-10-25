import "./tz.js";
import "dotenv/config";
import { runPoll } from "./poll.js";
import { upcoming } from "./ical.js";
import { changeTelegram, fmtTime } from "./telegram.js";

/**
 *   npm run poll                          → uses BRIGHTSPACE_ICAL_URL (.env) or data/config.json
 *   npm run poll -- fixtures/sample.ics   → offline test file
 */
async function main() {
  const { items, changes, firstRun } = await runPoll({ file: process.argv[2] });
  const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
  console.log(`📠 ${items.length} events parsed. Next 14 days:`);
  for (const i of upcoming(items, now)) {
    console.log(`  • ${fmtTime(i.due).padEnd(24)} [${i.kind}] ${i.course.split(" - ")[0]} — ${i.title}`);
  }
  if (firstRun) console.log("\n(First run: snapshot saved. Run again to detect changes.)");
  else if (!changes.length) console.log("\nNo changes since last poll.");
  else {
    console.log(`\n🔔 ${changes.length} change(s):`);
    for (const c of changes) console.log("  " + changeTelegram(c));
  }
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
