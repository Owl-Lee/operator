import { geminiJson, geminiAsk, geminiExtract, hasGemini } from "./gemini.js";
import { openDeadlines, scheduleContext, loadSchedule, saveSchedule } from "./schedule.js";
import { logAgent, markDone, unmarkDone } from "./store.js";
import { fmtTime, telegram } from "./telegram.js";

/**
 * The phone-side brain. Every iMessage from the user goes through Gemini, which decides what it means
 * against the live schedule. It only acts when sure; otherwise it asks back. Never guesses.
 */
type Intent =
  | { intent: "done"; uid: string; confidence: number; reply: string }
  | { intent: "undo"; uid: string; confidence: number; reply: string }
  | { intent: "clarify"; candidates: string[]; reply: string }
  | { intent: "question"; reply?: string }
  | { intent: "add"; reply?: string }
  | { intent: "chat"; reply: string };

const nowET = (now: Date) => now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

export async function handleInbound(text: string, now = new Date()): Promise<string> {
  const lang = /[一-龥]/.test(text) ? "zh" : "en";
  if (!hasGemini()) return rulesFallback(text, now, lang);
  const open = openDeadlines(now);
  let r: Intent;
  try {
    r = await geminiJson([{ text: `You are Brass Telegraph, a student's schedule agent, replying over iMessage. Now: ${nowET(now)} (America/New_York).
The user just texted: "${text}"

Open deadlines (id, course, title, due, status):
${open.map(d => `- id=${d.uid} | ${d.course} | ${d.title} (${d.kind}) | due ${fmtTime(d.due)}${d.done ? " | DONE" : ""}`).join("\n") || "(none)"}

Decide what the user means and return ONLY JSON, one of:
{"intent":"done","uid":"<id>","confidence":0..1,"reply":"<one short line confirming what you marked done, telegram style, UPPERCASE with STOP.>"}
{"intent":"undo","uid":"<id>","confidence":0..1,"reply":"..."}
{"intent":"clarify","candidates":["<id>","<id>"],"reply":"<ask which one, naming the candidates with course + title, in the user's language>"}
{"intent":"question"}            ← they're asking about their schedule
{"intent":"add"}                 ← they're giving you a new event/meeting/deadline to record
{"intent":"chat","reply":"<short friendly reply>"}  ← greetings, thanks, anything else

Rules: "done/finished/submitted/交了/写完了/搞定" → done. Match by course code, assignment number, kind or nickname (HW3 = HW#3, "讨论帖" = discussion). If more than one open item fits or confidence < 0.75, use clarify — never guess. Reply in the user's language (Chinese text → Chinese reply) but keep "TELEGRAM:" / "STOP." as-is.` }]);
  } catch (e: any) {
    return lang === "zh" ? `TELEGRAM: 线路繁忙 (${e?.message?.slice(0, 40)})。STOP. 请稍后再发。STOP.` : `TELEGRAM: LINE BUSY (${e?.message?.slice(0, 40)}). STOP. TRY AGAIN SHORTLY. STOP.`;
  }

  if (r.intent === "done" || r.intent === "undo") {
    const d = open.find(x => x.uid === r.uid);
    if (!d || r.confidence < 0.75) return clarifyText(open.filter(x => !x.done).slice(0, 3), lang);
    if (r.intent === "done") { markDone(d.uid, d.title, "imessage"); logAgent("triage", `Marked done from your text: ${d.course} · ${d.title} (“${text.slice(0, 60)}”). Reminders for it are off.`, { uid: d.uid, via: "imessage" }); }
    else { unmarkDone(d.uid); logAgent("triage", `Re-opened from your text: ${d.course} · ${d.title}.`, { uid: d.uid, via: "imessage" }); }
    return r.reply || telegram([`${r.intent === "done" ? "MARKED DONE" : "REOPENED"}: ${d.course} ${d.title}`]);
  }
  if (r.intent === "clarify") {
    const cands = r.candidates.map(id => open.find(x => x.uid === id)).filter(Boolean) as typeof open;
    logAgent("triage", `Asked which item you meant by “${text.slice(0, 60)}” (${cands.length} candidates).`, { via: "imessage" });
    return r.reply || clarifyText(cands, lang);
  }
  if (r.intent === "question") {
    const a = await geminiAsk(text, scheduleContext(now), lang, now);
    logAgent("triage", `Answered over iMessage: “${text.slice(0, 60)}” (${a.model}).`, { via: "imessage" });
    return a.answer;
  }
  if (r.intent === "add") {
    const g = await geminiExtract({ text }, now);
    if (!g.items.length) return lang === "zh" ? "没看出日期或时间，再说具体一点？" : "I couldn't find a date or time in that — could you be more specific?";
    const s = loadSchedule(), names: string[] = [];
    for (const it of g.items) {
      const id = `p-${Date.now().toString(36)}${names.length}`;
      const date = it.date || now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const base = { id, title: it.title, location: it.location, note: it.note, source: "agent", raw: text.slice(0, 300) } as any;
      if (it.kind === "class") s.classes.push({ ...base, course: it.course || it.title, days: it.days?.length ? it.days : ["Mon"], start: it.start || "09:00", end: it.end || "10:00" });
      else { const rec = { ...base, course: it.course, start: `${date}T${it.start || (it.kind === "deadline" ? "23:59" : "09:00")}`, end: it.end ? `${date}T${it.end}` : undefined }; (it.kind === "deadline" ? s.deadlines : it.kind === "meeting" ? s.meetings : s.events).push(rec); }
      names.push(`${it.title}${it.date ? " " + it.date : ""}${it.start ? " " + it.start : ""}`);
    }
    saveSchedule(s);
    logAgent("triage", `Understood your text as ${names.length} item${names.length > 1 ? "s" : ""} — ${g.items.map(i => `${i.kind}: “${i.title}”`).join("; ")} (gemini).`, { via: "imessage" });
    return (lang === "zh" ? "已记下：" : "Noted: ") + names.join("; ");
  }
  return r.reply || (lang === "zh" ? "收到。" : "Noted.");
}

function clarifyText(cands: ReturnType<typeof openDeadlines>, lang: "zh" | "en") {
  const list = cands.map((c, i) => `${i + 1}. ${c.course} ${c.title}`).join("  ");
  return lang === "zh" ? `你指的是哪一个？${list}` : `Which one do you mean? ${list}`;
}

/** No Gemini key: only the exact word "done" works, and only when there's a single urgent item. */
function rulesFallback(text: string, now: Date, lang: "zh" | "en"): string {
  if (/^\s*(done|完成|交了)\s*$/i.test(text)) {
    const open = openDeadlines(now).filter(d => !d.done);
    if (open.length === 1) { markDone(open[0].uid, open[0].title, "imessage"); return telegram([`MARKED DONE: ${open[0].course} ${open[0].title}`]); }
    return clarifyText(open.slice(0, 3), lang);
  }
  return lang === "zh" ? "接上 Gemini 后我才能听懂整句话。现在只认「done」。" : "I only understand “done” until Gemini is connected.";
}
