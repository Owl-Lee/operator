import { geminiJson, hasGemini, type GItem } from "./gemini.js";
import { openDeadlines, scheduleContext, loadSchedule, saveSchedule } from "./schedule.js";
import { logAgent, logTelegram, markDone, unmarkDone } from "./store.js";
import { hasElevenLabs, briefingText, speak } from "./voice.js";
import { sendVoice } from "./photon.js";

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
const busy = (lang: "zh" | "en", why: string) => lang === "zh" ? `我这边暂时忙不过来（${why}），一分钟后再发一次。` : `I'm a bit tied up right now (${why}) — try again in a minute.`;

export interface InboundInput { text?: string; audio?: { data: string; mime: string }; image?: { data: string; mime: string } }

export async function handleInbound(input: string | InboundInput, now = new Date()): Promise<string> {
  const inp: InboundInput = typeof input === "string" ? { text: input } : input;
  const text = inp.text ?? "";
  const lang: "zh" | "en" = /[一-龥]/.test(text) || (!text && true) ? "zh" : "en"; // voice/photo without text: default to Chinese for this user
  // "早报" / "briefing": read today's telegram aloud as a voice note (ElevenLabs)
  if (/^(早报|今日早报|念一下|briefing|morning telegram|read it to me)[!！。.]?$/i.test(text)) {
    if (!hasElevenLabs()) return lang === "zh" ? "语音早报需要先接上 ElevenLabs。" : "Voice briefings need ElevenLabs connected.";
    try {
      const t = await briefingText(lang, now); const audio = await speak(t);
      await sendVoice(audio); logTelegram(`[voice] ${t}`, true); logAgent("telegram", `Sent the morning briefing as a voice note: “${t.slice(0, 80)}…”`, { voice: true });
      return null as any; // the voice note is the reply
    } catch (e: any) { return busy(lang, String(e?.message ?? e).slice(0, 40)); }
  }
  if (!hasGemini()) return text ? rulesFallback(text, now, lang) : (lang === "zh" ? "接上 Gemini 后才能听语音、看图片。" : "Voice and photos need Gemini connected.");
  try {
    return await decide(inp, now, lang);
  } catch (e: any) {
    logAgent("triage", `Could not handle “${(text || (inp.audio ? "voice note" : "photo")).slice(0, 60)}”: ${e?.message ?? e}`, { via: "imessage" });
    return busy(lang, String(e?.message ?? e).replace(/^Gemini busy \(|\)\..*$/g, "").slice(0, 40));
  }
}

async function decide(inp: InboundInput, now: Date, lang: "zh" | "en"): Promise<string> {
  const open = openDeadlines(now);
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const text = inp.text ?? "";
  const spoken = inp.audio ? " This is a spoken conversation: keep \"answer\" and \"reply\" to at most two short sentences." : "";
  const what = inp.audio ? "The user just sent a VOICE NOTE (attached audio). First transcribe it faithfully into \"transcript\", then treat the transcript as their message. If the audio is silent, garbled or you cannot actually hear words, you MUST return {\"intent\":\"chat\",\"transcript\":\"\",\"reply\":\"<say you couldn't hear it and ask them to type>\"} — never guess a transcript and never mark anything done from audio you didn't clearly hear." : inp.image ? "The user just sent a PHOTO (attached image) — a timetable, a poster, an email screenshot. Describe what matters in \"transcript\" and treat it as their message (usually intent add)." : `The user just texted: "${text}"`;
  const parts: any[] = [{ text: `You are Operator — the telegraph operator who watches a Stony Brook student's Brightspace, classes and meetings so they never have to log in — replying over iMessage. If asked who you are, say so in one line. Now: ${nowET(now)} (America/New_York, today=${today}).
${what}

OPEN DEADLINES (id | course | title | due | status):
${open.map(d => `- id=${d.uid} | ${d.course} | ${d.title} (${d.kind}) | due ${new Date(d.due).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${d.done ? " | DONE" : ""}`).join("\n") || "(none)"}

FULL SCHEDULE (next two weeks):
${scheduleContext(now)}

Return ONLY one JSON object:
- Finished something ("done/submitted/交了/写完了/搞定"): {"intent":"done","uid":"<id>","confidence":0..1,"reply":"<one short, natural sentence naming the course and title>"}
- Un-finish: {"intent":"undo","uid":"<id>","confidence":0..1,"reply":"..."}
- More than one open item could match, or confidence < 0.75: {"intent":"clarify","candidates":["<id>","<id>"],"reply":"<ask which one, listing course + title + due for each, numbered>"}
- Asking about the schedule: {"intent":"question","answer":"<1–3 concrete sentences: items, days, times; prioritise exams > due within 72h > quizzes > rest>"}
- Giving you something to record (meeting, event, class, deadline): {"intent":"add","items":[{"kind":"deadline|class|meeting|event","title":"...","course":"...","date":"YYYY-MM-DD","days":["Mon"],"start":"HH:MM","end":"HH:MM","location":"...","note":"..."}],"summary":"<one line confirming what you recorded, with date/time/place>"} — Also give "title_en" and "title_zh" (the title in English and in Simplified Chinese; translate names of people/places sensibly, e.g. 老师 → Prof.) and, if there is a note, "note_en" and "note_zh".
- Anything else: {"intent":"chat","reply":"<short friendly reply; if asked who you are, say what you can do>"}
Resolve relative dates from today ("这周日" = the coming Sunday). Reply in the user's language (Chinese → Chinese), in plain conversational sentences — no telegram caps, no "STOP.". Never invent schedule facts.${spoken} Tone: warm and human, like a sharp friend who keeps your calendar — after the facts, add ONE short personal sentence that reacts to what they actually said (a trip, stress, good news): e.g. \"Clear HW#3 Monday and the beach is all yours.\" Never more than one such sentence, no emoji strings.${inp.audio || inp.image ? ' Always include "transcript": "<what you heard/saw, in its original language>" in the JSON.' : ""}` }];
  if (inp.audio) parts.push({ inline_data: { mime_type: inp.audio.mime, data: inp.audio.data } });
  if (inp.image) parts.push({ inline_data: { mime_type: inp.image.mime, data: inp.image.data } });
  const r: Decision & { transcript?: string } = await geminiJson(parts);
  const heard = r.transcript && (inp.audio || inp.image) ? (lang === "zh" ? `（${inp.audio ? "听到" : "看到"}：${r.transcript.slice(0, 120)}）\n` : `(${inp.audio ? "Heard" : "Saw"}: ${r.transcript.slice(0, 120)})\n`) : "";
  const out = await act(r, text || r.transcript || "", open, now, lang, today);
  return heard + out;
}

async function act(r: Decision, text: string, open: ReturnType<typeof openDeadlines>, now: Date, lang: "zh" | "en", today: string): Promise<string> {

  if (r.intent === "done" || r.intent === "undo") {
    const d = open.find(x => x.uid === r.uid);
    if (!d || (r.confidence ?? 0) < 0.75) return clarifyText(open.filter(x => !x.done).slice(0, 3), lang);
    if (r.intent === "done") { markDone(d.uid, d.title, "imessage"); logAgent("triage", `Marked done from your text: ${d.course} · ${d.title} (“${text.slice(0, 60)}”). Reminders for it are off.`, { uid: d.uid, via: "imessage" }); }
    else { unmarkDone(d.uid); logAgent("triage", `Re-opened from your text: ${d.course} · ${d.title}.`, { uid: d.uid, via: "imessage" }); }
    return r.reply || (lang === "zh" ? `${r.intent === "done" ? "已标记完成" : "已重新打开"}：${d.course} · ${d.title}` : `${r.intent === "done" ? "Marked done" : "Reopened"}: ${d.course} · ${d.title}`);
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
      const base = { id, title: it.title, title_en: it.title_en, title_zh: it.title_zh, location: it.location, note: it.note, note_en: it.note_en, note_zh: it.note_zh, source: "agent", raw: text.slice(0, 300) } as any;
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
    if (open.length === 1) { markDone(open[0].uid, open[0].title, "imessage"); return lang === "zh" ? `已标记完成：${open[0].course} · ${open[0].title}` : `Marked done: ${open[0].course} · ${open[0].title}`; }
    return clarifyText(open.slice(0, 3), lang);
  }
  return lang === "zh" ? "接上 Gemini 后我才能听懂整句话。现在只认「done」。" : "I only understand “done” until Gemini is connected.";
}
