import { geminiJson, hasGemini, type GItem } from "./gemini.js";
import { openDeadlines, scheduleContext, loadSchedule, saveSchedule } from "./schedule.js";
import { logAgent, markDone, unmarkDone } from "./store.js";
import { telegram } from "./telegram.js";

/**
 * The phone-side brain. Every iMessage goes through ONE Gemini call that decides what it means against
 * the live schedule and, in the same breath, answers / extracts / picks the item. It only acts when sure;
 * otherwise it asks back. Never guesses. One call per message keeps us inside the free-tier quota.
 */
interface Decision {
  intent: "done" | "undo" | "clarify" | "question" | "add" | "chat";
  uid?: string; confidence?: number; candidates?: string[];
  reply?: string; answer?: string; items?: GItem[]; summary?: string;
}

const nowET = (now: Date) => now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
const busy = (lang: "zh" | "en", why: string) => lang === "zh" ? `TELEGRAM: 线路繁忙（${why}）。STOP. 一分钟后再发一次。STOP.` : `TELEGRAM: LINE BUSY (${why}). STOP. TRY AGAIN IN A MINUTE. STOP.`;

export async function handleInbound(text: string, now = new Date()): Promise<string> {
  const lang: "zh" | "en" = /[一-龥]/.test(text) ? "zh" : "en";
  if (!hasGemini()) return rulesFallback(text, now, lang);
  try {
    return await decide(text, now, lang);
  } catch (e: any) {
    logAgent("triage", `Could not handle “${text.slice(0, 60)}”: ${e?.message ?? e}`, { via: "imessage" });
    return busy(lang, String(e?.message ?? e).replace(/^Gemini busy \(|\)\..*$/g, "").slice(0, 40));
  }
}

async function decide(text: string, now: Date, lang: "zh" | "en"): Promise<string> {
  const open = openDeadlines(now);
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const r: Decision = await geminiJson([{ text: `You are Brass Telegraph, a Stony Brook student's schedule agent, replying over iMessage. Now: ${nowET(now)} (America/New_York, today=${today}).
The user just texted: "${text}"

OPEN DEADLINES (id | course | title | due | status):
${open.map(d => `- id=${d.uid} | ${d.course} | ${d.title} (${d.kind}) | due ${new Date(d.due).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${d.done ? " | DONE" : ""}`).join("\n") || "(none)"}

FULL SCHEDULE (next two weeks):
${scheduleContext(now)}

Return ONLY one JSON object:
- Finished something ("done/submitted/交了/写完了/搞定"): {"intent":"done","uid":"<id>","confidence":0..1,"reply":"<one line, telegram style, UPPERCASE + STOP., naming course and title>"}
- Un-finish: {"intent":"undo","uid":"<id>","confidence":0..1,"reply":"..."}
- More than one open item could match, or confidence < 0.75: {"intent":"clarify","candidates":["<id>","<id>"],"reply":"<ask which one, listing course + title + due for each, numbered>"}
- Asking about the schedule: {"intent":"question","answer":"<1–3 concrete sentences: items, days, times; prioritise exams > due within 72h > quizzes > rest>"}
- Giving you something to record (meeting, event, class, deadline): {"intent":"add","items":[{"kind":"deadline|class|meeting|event","title":"...","course":"...","date":"YYYY-MM-DD","days":["Mon"],"start":"HH:MM","end":"HH:MM","location":"...","note":"..."}],"summary":"<one line confirming what you recorded, with date/time/place>"}
- Anything else: {"intent":"chat","reply":"<short friendly reply; if asked who you are, say what you can do>"}
Resolve relative dates from today ("这周日" = the coming Sunday). Reply in the user's language (Chinese → Chinese); keep "TELEGRAM:"/"STOP." as-is. Never invent schedule facts.` }]);

  if (r.intent === "done" || r.intent === "undo") {
    const d = open.find(x => x.uid === r.uid);
    if (!d || (r.confidence ?? 0) < 0.75) return clarifyText(open.filter(x => !x.done).slice(0, 3), lang);
    if (r.intent === "done") { markDone(d.uid, d.title, "imessage"); logAgent("triage", `Marked done from your text: ${d.course} · ${d.title} (“${text.slice(0, 60)}”). Reminders for it are off.`, { uid: d.uid, via: "imessage" }); }
    else { unmarkDone(d.uid); logAgent("triage", `Re-opened from your text: ${d.course} · ${d.title}.`, { uid: d.uid, via: "imessage" }); }
    return r.reply || telegram([`${r.intent === "done" ? "MARKED DONE" : "REOPENED"}: ${d.course} ${d.title}`]);
  }
  if (r.intent === "clarify") {
    const cands = (r.candidates ?? []).map(id => open.find(x => x.uid === id)).filter(Boolean) as typeof open;
    logAgent("triage", `Asked which item you meant by “${text.slice(0, 60)}” (${cands.length} candidates).`, { via: "imessage" });
    return r.reply || clarifyText(cands.length ? cands : open.filter(x => !x.done).slice(0, 3), lang);
  }
  if (r.intent === "question") {
    logAgent("triage", `Answered over iMessage: “${text.slice(0, 60)}” (gemini).`, { via: "imessage" });
    return r.answer || (lang === "zh" ? "我没看出你想问什么，换个说法？" : "I'm not sure what you're asking — could you rephrase?");
  }
  if (r.intent === "add") {
    const items = r.items ?? [];
    if (!items.length) return lang === "zh" ? "没看出日期或时间，再说具体一点？" : "I couldn't find a date or time in that — could you be more specific?";
    const s = loadSchedule(), names: string[] = [];
    for (const it of items) {
      const id = `p-${Date.now().toString(36)}${names.length}`;
      const date = it.date || today;
      const base = { id, title: it.title, location: it.location, note: it.note, source: "agent", raw: text.slice(0, 300) } as any;
      if (it.kind === "class") s.classes.push({ ...base, course: it.course || it.title, days: it.days?.length ? it.days : ["Mon"], start: it.start || "09:00", end: it.end || "10:00" });
      else { const rec = { ...base, course: it.course, start: `${date}T${it.start || (it.kind === "deadline" ? "23:59" : "09:00")}`, end: it.end ? `${date}T${it.end}` : undefined }; (it.kind === "deadline" ? s.deadlines : it.kind === "meeting" ? s.meetings : s.events).push(rec); }
      names.push(it.title);
    }
    saveSchedule(s);
    logAgent("triage", `Understood your text as ${items.length} item${items.length > 1 ? "s" : ""} — ${items.map(i => `${i.kind}: “${i.title}”`).join("; ")} (gemini).`, { via: "imessage" });
    return r.summary || (lang === "zh" ? "已记下：" : "Noted: ") + names.join("; ");
  }
  return r.reply || (lang === "zh" ? "收到。" : "Noted.");
}

function clarifyText(cands: ReturnType<typeof openDeadlines>, lang: "zh" | "en") {
  const list = cands.map((c, i) => `${i + 1}. ${c.course} ${c.title}`).join("  ");
  return lang === "zh" ? `你指的是哪一个？${list}` : `Which one do you mean? ${list}`;
}

/** No Gemini key: only the exact word "done" works, and only when there's a single open item. */
function rulesFallback(text: string, now: Date, lang: "zh" | "en"): string {
  if (/^\s*(done|完成|交了)\s*$/i.test(text)) {
    const open = openDeadlines(now).filter(d => !d.done);
    if (open.length === 1) { markDone(open[0].uid, open[0].title, "imessage"); return telegram([`MARKED DONE: ${open[0].course} ${open[0].title}`]); }
    return clarifyText(open.slice(0, 3), lang);
  }
  return lang === "zh" ? "接上 Gemini 后我才能听懂整句话。现在只认「done」。" : "I only understand “done” until Gemini is connected.";
}
