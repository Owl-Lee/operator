import { geminiJson, hasGemini } from "./gemini.js";
import { openDeadlines, scheduleContext } from "./schedule.js";

/** ElevenLabs: the "morning telegram" read aloud. Needs ELEVENLABS_API_KEY in .env. */
export const hasElevenLabs = () => !!process.env.ELEVENLABS_API_KEY;
const VOICE_ID = () => process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel", a stock voice; swap for an old-timey one later

/** Short spoken briefing for today, written by Gemini in the user's language. */
export async function briefingText(lang: "zh" | "en", now = new Date()): Promise<string> {
  const today = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });
  if (!hasGemini()) {
    const next = openDeadlines(now).filter(d => !d.done).slice(0, 3);
    return lang === "zh" ? `早上好。今天是${today}。最近的截止：${next.map(d => `${d.course} ${d.title}`).join("，") || "没有"}。` : `Good morning. It's ${today}. Coming up: ${next.map(d => `${d.course} ${d.title}`).join(", ") || "nothing"}.`;
  }
  const r = await geminiJson([{ text: `Write a spoken morning briefing for a Stony Brook student, to be read aloud by a text-to-speech voice. Today is ${today} (America/New_York).
Style: a cheerful old telegraph operator — but natural spoken ${lang === "zh" ? "Simplified Chinese" : "English"}, 3–5 short sentences, under 70 words / 120 Chinese characters. Lead with anything due within 24–48 hours, then today's classes/meetings, end with one line of encouragement. Do not read ids, URLs or "STOP.". Skip items marked DONE.
SCHEDULE:
${scheduleContext(now)}
Return ONLY JSON: {"text":"..."}` }]);
  return String(r.text ?? "").trim();
}

/** Text → MP3 bytes via ElevenLabs. */
export async function speak(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID()}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
