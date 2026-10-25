import { hasPhoton, startInbound, sendTelegram } from "./photon.js";
import { handleInbound } from "./brain.js";
import { runPoll, icalUrl } from "./poll.js";
import { warmBriefing } from "./voice.js";
import { openDeadlines } from "./schedule.js";
import { logAgent, logTelegram, loadSentReminders, markReminderSent } from "./store.js";
import { reminderTelegram } from "./telegram.js";
import { upcoming } from "./ical.js";
import { loadSnapshot } from "./store.js";

const POLL_MS = Number(process.env.POLL_MINUTES ?? 10) * 60_000;
const REMIND_AT = [24, 3, 1]; // hours before due

/** The long-running part: listen to the phone, poll Brightspace, send escalating reminders. */
export function startAgent(log: (s: string) => void = console.log): void {
  if (hasPhoton()) {
    startInbound(input => handleInbound(input), log).catch(e => log(`inbound stopped: ${e?.message ?? e}`));
  } else log("Photon not configured — inbound and telegrams disabled.");

  if (icalUrl()) {
    const poll = async () => { try { const r = await runPoll(); if (r.changes.length) log(`poll: ${r.changes.length} change(s)`); } catch (e: any) { log(`poll failed: ${e?.message ?? e}`); } warmBriefing(log); };
    setTimeout(poll, 5_000);
    setInterval(poll, POLL_MS);
  }

  setInterval(() => remindTick(log).catch(e => log(`remind failed: ${e?.message ?? e}`)), 60_000);
  setTimeout(() => warmBriefing(log), 8_000);
  setInterval(() => warmBriefing(log), 20 * 60_000); // picks up the change of part-of-day
}

/** Once a minute: for each open, not-done deadline, send the 24h / 3h / 1h telegram when its window arrives. */
async function remindTick(log: (s: string) => void): Promise<void> {
  const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
  const n = now.getTime(), sent = loadSentReminders();
  const items = loadSnapshot();
  for (const d of openDeadlines(now)) {
    if (d.done) continue;
    const due = Date.parse(d.due), hoursLeft = (due - n) / 3.6e6;
    for (const h of REMIND_AT) {
      // The key carries the due time: when a professor moves the deadline, the old markers stop matching and the
      // 24h / 3h / 1h reminders are scheduled again against the new time. The AMENDMENT telegram already said it moved.
      const key = `${d.uid}@${new Date(due).toISOString()}@${h}`;
      // fire inside the 10-minute window after the threshold passes (so a restart doesn't replay old ones)
      if (sent.includes(key) || hoursLeft > h || hoursLeft < h - 10 / 60) continue;
      const item = items.find(i => i.uid === d.uid) ?? { title: d.title, course: d.course, due: d.due } as any;
      const text = reminderTelegram(item, hoursLeft);
      const ok = hasPhoton();
      if (ok) { try { await sendTelegram(text); } catch (e: any) { log(`send failed: ${e?.message}`); continue; } }
      markReminderSent(key); logTelegram(text, ok);
      logAgent("telegram", `${ok ? "Sent" : "Drafted"} telegram: ${text}`, { uid: d.uid, hours: h, sent: ok });
      log(`⏰ ${text}`);
    }
  }
}
