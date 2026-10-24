/**
 * Gemini does the understanding when a key is present: free text and images (timetable
 * screenshots, posters, emails) → structured schedule items. Same contract as parse.ts.
 */
export interface GItem {
  kind: "deadline" | "class" | "meeting" | "event";
  title: string; course?: string; date?: string; days?: string[];
  start?: string; end?: string; location?: string; note?: string;
}
export interface GResult { items: GItem[]; summary: string }

export const hasGemini = () => !!process.env.GEMINI_API_KEY;
const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { response_mime_type: "application/json", temperature: 0.2 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
  const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
  return { items: Array.isArray(parsed.items) ? parsed.items : [], summary: String(parsed.summary ?? "") };
}
