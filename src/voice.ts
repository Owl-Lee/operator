import { geminiJson, hasGemini } from "./gemini.js";
import { openDeadlines, scheduleContext } from "./schedule.js";
import { loadDone } from "./store.js";

/** ElevenLabs: the "morning telegram" read aloud. Needs ELEVENLABS_API_KEY in .env. */
export const hasElevenLabs = () => !!process.env.ELEVENLABS_API_KEY;
const VOICE_ID = () => process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel", a stock voice; swap for an old-timey one later

/** Short spoken briefing for today, written by Gemini in the user's language. */
export async function briefingText(lang: "zh" | "en", now = new Date()): Promise<string> {
  const today = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });
  const clock = now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  if (!hasGemini()) {
    const next = openDeadlines(now).filter(d => !d.done).slice(0, 3);
    return lang === "zh" ? `早上好。今天是${today}。最近的截止：${next.map(d => `${d.course} ${d.title}`).join("，") || "没有"}。` : `Good morning. It's ${today}. Coming up: ${next.map(d => `${d.course} ${d.title}`).join(", ") || "nothing"}.`;
  }
  const r = await geminiJson([{ text: `Write a short spoken briefing for a Stony Brook student, to be read aloud by a text-to-speech voice. It is ${clock} on ${today} (America/New_York) — greet for THIS time of day (morning / afternoon / evening / late night), never say "good morning" at night.
Style: a cheerful old telegraph operator — but natural spoken ${lang === "zh" ? "Simplified Chinese" : "English"}, 3–5 short sentences, under 70 words / 120 Chinese characters. Lead with anything due within 24–48 hours, then today's classes/meetings, end with one line of encouragement. Do not read ids, URLs or "STOP.". Skip items marked DONE.
SCHEDULE:
${scheduleContext(now)}
Return ONLY JSON: {"text":"..."}` }]);
  return String(r.text ?? "").trim();
}

export interface TimedSpeech { audio: Buffer; chars: string[]; starts: number[]; ends: number[] }
/** Text → MP3 + per-character timestamps (for live subtitles). */
export async function speakTimed(text: string): Promise<TimedSpeech> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID()}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  const al = j.alignment || j.normalized_alignment || {};
  return { audio: Buffer.from(j.audio_base64, "base64"), chars: al.characters ?? [], starts: al.character_start_times_seconds ?? [], ends: al.character_end_times_seconds ?? [] };
}
export const timedJson = (t: TimedSpeech) => ({ audio: t.audio.toString("base64"), chars: t.chars, starts: t.starts, ends: t.ends });

/**
 * The briefing is pre-generated and cached so a click plays instantly. It is rebuilt when the schedule,
 * the done-list or the part of the day changes, or after an hour — and warmed in the background on
 * startup, after every Brightspace poll and after edits, so the slow path almost never runs on a click.
 */
const briefCache: Record<string, { key: string; at: number; text: string; timed: TimedSpeech }> = {};
let warming: Promise<void> | null = null;
function briefKey(now: Date) {
  const h = Number(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return part + "|" + scheduleContext(now) + "|" + loadDone().map(d => d.uid).join(",");
}
export async function getBriefing(lang: "zh" | "en", now = new Date(), fromWarm = false): Promise<{ text: string; timed: TimedSpeech; cached: boolean }> {
  // A click during warm-up waits for it rather than generating twice. The warm-up itself must not wait on itself.
  if (warming && !fromWarm) { try { await warming; } catch {} }
  const key = briefKey(now), c = briefCache[lang];
  if (c && c.key === key && Date.now() - c.at < 60 * 60_000) return { text: c.text, timed: c.timed, cached: true };
  // Stale-while-revalidate: a click right after an edit gets the previous briefing at once while a fresh one is made.
  if (c && !fromWarm && Date.now() - c.at < 3 * 60 * 60_000) { setTimeout(() => warmBriefing(), 0); return { text: c.text, timed: c.timed, cached: true }; }
  const text = await briefingText(lang, now);
  const timed = await speakTimed(text);
  briefCache[lang] = { key, at: Date.now(), text, timed };
  return { text, timed, cached: false };
}
export function warmBriefing(log: (s: string) => void = () => {}): void {
  if (!hasElevenLabs() || !hasGemini() || warming) return;
  warming = (async () => {
    for (const lang of ["zh", "en"] as const) {
      try { const r = await getBriefing(lang, new Date(), true); if (!r.cached) log(`briefing ready (${lang}): ${r.text.slice(0, 50)}…`); }
      catch (e: any) { log(`briefing warm-up failed (${lang}): ${e?.message ?? e}`); }
    }
  })().finally(() => { warming = null; });
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
