import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

/** One Spectrum connection shared by outbound telegrams and the inbound listener. */
let appPromise: Promise<any> | null = null;
let dmPromise: Promise<{ send(text: string): Promise<unknown> }> | null = null;

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
      else if (c?.type === "voice") { const buf: Buffer = await c.read(); input = { audio: { data: buf.toString("base64"), mime: c.mimeType || "audio/mp4" } }; log(`📥 voice note ${c.mimeType} ${buf.length} bytes`); }
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
