import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

/** One Spectrum connection shared by outbound telegrams and the inbound listener. */
let appPromise: Promise<any> | null = null;
let dmPromise: Promise<{ send(content: any): Promise<unknown> }> | null = null;

export const hasPhoton = () => !!(process.env.IMESSAGE_PROJECT_ID && process.env.IMESSAGE_PROJECT_SECRET && process.env.MY_PHONE && process.env.MY_PHONE !== "+1");
export const myPhone = () => process.env.MY_PHONE!;

export function getApp(): Promise<any> {
  if (!hasPhoton()) return Promise.reject(new Error("Set IMESSAGE_PROJECT_ID, IMESSAGE_PROJECT_SECRET and MY_PHONE in .env"));
  appPromise ??= Spectrum({ projectId: process.env.IMESSAGE_PROJECT_ID!, projectSecret: process.env.IMESSAGE_PROJECT_SECRET!, providers: [imessage.config()] });
  return appPromise;
}

/** The DM with the user. Free/shared-pool plan: the user texts the line once, then we reuse that chat
 *  (creating a fresh DM is refused with "Target not allowed"). */
function getDm() {
  dmPromise ??= (async () => {
    const im = imessage(await getApp());
    try { return await im.space.get(`any;-;${myPhone()}`); }
    catch { const me = await im.user(myPhone()); return im.space.create(me); }
  })();
  return dmPromise;
}

export async function sendTelegram(text: string): Promise<void> {
  const dm = await getDm();
  await dm.send(text);
}

/**
 * Send an audio buffer as an iMessage voice-note bubble. iMessage only plays its own voice-note format
 * inline — an MP3 shows a dead 00:00 player — so transcode to AAC (m4a) first when ffmpeg is around.
 */
export async function sendVoice(audio: Buffer, mimeType = "audio/mpeg", name = "briefing.mp3"): Promise<void> {
  const { voice } = await import("spectrum-ts");
  const dm = await getDm();
  if (/mpeg|mp3/.test(mimeType)) {
    const base = name.replace(/\.mp3$/, "");
    const m4a = await transcode(audio, "mp3", ["-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart"], "m4a");
    if (m4a) { await dm.send(voice(m4a, { mimeType: "audio/x-m4a", name: base + ".m4a" })); return; }
  }
  await dm.send(voice(audio, { mimeType, name }));
}

/** Run ffmpeg on a buffer; null when ffmpeg is missing or fails (callers fall back). */
export async function transcode(buf: Buffer, inExt: string, args: string[], outExt: string): Promise<Buffer | null> {
  const { execFile } = await import("node:child_process");
  const { writeFileSync, readFileSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "bt-voice-"));
  const src = join(dir, "in." + inExt), out = join(dir, "out." + outExt);
  writeFileSync(src, buf);
  try {
    await new Promise<void>((res, rej) => execFile(process.env.FFMPEG || "ffmpeg", ["-y", "-loglevel", "error", "-i", src, ...args, out], { timeout: 30_000 }, e => e ? rej(e) : res()));
    return readFileSync(out);
  } catch (e: any) {
    console.log(`[agent] ffmpeg unavailable or failed: ${e?.message ?? e}`);
    return null;
  } finally { try { rmSync(dir, { recursive: true, force: true }); } catch {} }
}

/**
 * iMessage voice notes arrive as Apple CAF (Opus), which Gemini cannot decode — and when it can't decode
 * audio it may invent a transcript. So: convert to MP3 with ffmpeg, or refuse. Never hand Gemini raw CAF.
 */
export async function toGeminiAudio(buf: Buffer, mime: string): Promise<{ data: string; mime: string } | null> {
  const ok = /^audio\/(mpeg|mp3|wav|x-wav|aac|ogg|flac|aiff)$/i.test(mime);
  if (ok) return { data: buf.toString("base64"), mime };
  const ext = /webm/.test(mime) ? "webm" : /mp4|m4a/.test(mime) ? "m4a" : /ogg|opus/.test(mime) ? "ogg" : "caf";
  const mp3 = await transcode(buf, ext, ["-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k"], "mp3");
  return mp3 ? { data: mp3.toString("base64"), mime: "audio/mpeg" } : null;
}

export interface Inbound { text?: string; audio?: { data: string; mime: string }; image?: { data: string; mime: string } }

/** Run `handler` for every text / voice note / photo the user sends to the line; whatever it returns is sent back. */
export async function startInbound(handler: (input: Inbound) => Promise<string | null>, log: (s: string) => void = console.log): Promise<void> {
  const app = await getApp();
  const me = myPhone().replace(/\D/g, "");
  log(`📡 Listening for iMessages from ${myPhone()}`);
  for await (const [space, message] of app.messages) {
    try {
      const from = String(message.sender?.id ?? "").replace(/\D/g, "");
      if (from && from !== me) { log(`ignored message from ${from}`); continue; }
      const c = message.content;
      let input: Inbound | null = null;
      if (c?.type === "text") { const text = String(c.text ?? "").trim(); if (text) input = { text }; }
      else if (c?.type === "voice") {
        const buf: Buffer = await c.read(); log(`📥 voice note ${c.mimeType} ${buf.length} bytes`);
        const conv = await toGeminiAudio(buf, c.mimeType || "audio/x-caf");
        if (!conv) { await space.send("语音格式暂不支持（需要 ffmpeg），请打字或再试一次。"); log("voice: no converter, asked for text"); continue; }
        input = { audio: conv };
      }
      else if (c?.type === "attachment" && /^image\//.test(c.mimeType || "")) { const buf: Buffer = await c.read(); input = { image: { data: buf.toString("base64"), mime: c.mimeType } }; log(`📥 image ${c.mimeType} ${buf.length} bytes`); }
      else { log(`unsupported message type: ${c?.type}`); continue; }
      if (!input) continue;
      if (input.text) log(`📥 ${input.text}`);
      const reply = await handler(input);
      if (reply) { await space.send(reply); log(`📤 ${reply}`); }
    } catch (e: any) {
      log(`inbound error: ${e?.message ?? e}`);
    }
  }
}
