import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

let dmPromise: Promise<{ send(text: string): Promise<unknown> }> | null = null;

/** Lazily connect to Photon and open (or reuse) the DM with MY_PHONE. */
function getDm() {
  dmPromise ??= (async () => {
    const projectId = process.env.IMESSAGE_PROJECT_ID;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
    const phone = process.env.MY_PHONE;
    if (!projectId || !projectSecret || !phone || phone === "+1") {
      throw new Error("Set IMESSAGE_PROJECT_ID, IMESSAGE_PROJECT_SECRET and MY_PHONE in .env");
    }
    const app = await Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
    const im = imessage(app);
    const me = await im.user(phone);
    return im.space.create(me);
  })();
  return dmPromise;
}

/** Send one telegram to the user's phone via iMessage. */
export async function sendTelegram(text: string): Promise<void> {
  const dm = await getDm();
  await dm.send(text);
}
