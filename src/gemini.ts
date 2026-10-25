/**
 * Gemini does the understanding when a key is present: free text and images (timetable
 * screenshots, posters, emails) → structured schedule items. Same contract as parse.ts.
 */
export interface GItem {
  kind: "deadline" | "class" | "meeting" | "event";
  title: string; course?: string; date?: string; days?: string[];
  start?: string; end?: string; location?: string; note?: string;
}
export interface GResult { items: GItem[]; summary: string; model?: string }

export const hasGemini = () => !!process.env.GEMINI_API_KEY;
/** Preferred model first; the rest are fallbacks for 429/503/timeouts (all available on the free tier). */
const MODELS = () => [...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-flash-latest"])];
const TIMEOUT_MS = 20_000;

function prompt(now: Date) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const wd = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long" });
  return `You are the intake brain of a student schedule agent at Stony Brook University. Today is ${wd} ${today} (America/New_York).
Read the user's text or image and extract every schedule item you can see. Return ONLY JSON:
{"items":[{"kind":"deadline|class|meeting|event","title":"short title","course":"e.g. EST 393 (if any)","date":"YYYY-MM-DD (for one-off items)","days":["Mon","Wed"] (for recurring classes),"start":"HH:MM 24h","end":"HH:MM 24h","location":"room/building","note":"anything worth remembering"}],"summary":"one sentence in the user's language describing what you understood"}
Rules: a weekly timetable screenshot → one "class" item per course with days + start/end; "due"/"submit"/"deadline" → deadline (default 23:59); office hours, advising, 1:1 → meeting; hackathons, fairs, talks → event. Resolve relative dates (next Tuesday, 明天, 周三) from today. Chinese input is common. If nothing is schedulable, return {"items":[],"summary":"..."}.`;
}

export async function geminiExtract(input: { text?: string; image?: { data: string; mime: string } }, now = new Date()): Promise<GResult> {
  const parts: any[] = [{ text: prompt(now) }];
  if (input.text) parts.push({ text: `USER TEXT:\n${input.text}` });
  if (input.image) parts.push({ inline_data: { mime_type: input.image.mime, data: input.image.data } });
  const parsed = await callJson(parts);
  return { items: Array.isArray(parsed.items) ? parsed.items : [], summary: String(parsed.summary ?? ""), model: parsed.__model };
}

/** Answer a question about the schedule. `context` is a plain-text dump of what the dashboard knows. */
export async function geminiAsk(question: string, context: string, lang: "en" | "zh", now = new Date()): Promise<{ answer: string; used: string[]; model?: string }> {
  const today = now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const parts = [{ text: `You are Operator, the telegraph operator who watches a Stony Brook student's schedule for them. Now: ${today} (America/New_York).
Answer the question using ONLY the schedule below. Be concrete: name items, days and times. Prioritise by urgency (exams > things due within 72 h > quizzes > the rest), then by date. Be brief: 1–3 sentences, no preamble. Answer in ${lang === "zh" ? "Simplified Chinese" : "English"}. Tone: warm and human, like a sharp friend who keeps your calendar — after the facts, add ONE short personal sentence that reacts to what they actually said (a trip, stress, good news): e.g. \"Clear HW#3 Monday and the beach is all yours.\" Never more than one such sentence, no emoji strings.
Return ONLY JSON: {"answer":"...","used":["short labels of what you looked at, e.g. '3 deadlines', 'Tuesday classes'"]}

SCHEDULE:
${context}

QUESTION: ${question}` }];
  const parsed = await callJson(parts);
  return { answer: String(parsed.answer ?? ""), used: Array.isArray(parsed.used) ? parsed.used.map(String) : [], model: parsed.__model };
}

/** Generic JSON call for other brains (inbound iMessage interpretation). */
export const geminiJson = (parts: any[]) => callJson(parts);

async function callJson(parts: any[]): Promise<any> {
  const body = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { response_mime_type: "application/json", temperature: 0.2 } });
  let lastErr = "", quotaHits = 0;
  for (const model of MODELS()) {
    if (quotaHits >= 2) break; // per-minute quota is per project: stop hammering, let the caller tell the user to wait
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 429) { lastErr = `${model} 429`; quotaHits++; break; } // free-tier quota: move to the next model once, then give up
        if (res.status === 503) { lastErr = `${model} 503`; await new Promise(r => setTimeout(r, 1500)); continue; }
        if (res.status === 403 || res.status === 404) { lastErr = `${model} ${res.status}`; break; } // model not available to this key → next model
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data: any = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
        const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
        return { ...parsed, __model: model };
      } catch (e: any) {
        if (e?.name === "TimeoutError" || e?.name === "AbortError") { lastErr = `${model} timeout`; break; }
        throw e;
      }
    }
  }
  throw new Error(`Gemini busy (${lastErr}). Try again in a moment.`);
}
