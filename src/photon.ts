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

/** Run `handler` for every text the user sends to the line; whatever it returns is sent back. */
export async function startInbound(handler: (text: string) => Promise<string | null>, log: (s: string) => void = console.log): Promise<void> {
  const app = await getApp();
  const me = myPhone().replace(/\D/g, "");
  log(`📡 Listening for iMessages from ${myPhone()}`);
  for await (const [space, message] of app.messages) {
    try {
      if (message.content?.type !== "text") continue;
      const from = String(message.sender?.id ?? "").replace(/\D/g, "");
      if (from && from !== me) { log(`ignored message from ${from}`); continue; }
      const text = String(message.content.text ?? "").trim();
      if (!text) continue;
      log(`📥 ${text}`);
      const reply = await handler(text);
      if (reply) { await space.send(reply); log(`📤 ${reply}`); }
    } catch (e: any) {
      log(`inbound error: ${e?.message ?? e}`);
    }
  }
}
