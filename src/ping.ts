import "dotenv/config";
import { sendTelegram } from "./send.js";
import { telegram } from "./telegram.js";

/** npm run ping → sends one test telegram to MY_PHONE. */
await sendTelegram(telegram(["BRASS TELEGRAPH ONLINE", "THE LINE IS OPEN"]));
console.log("📠 Sent. Check your phone.");
process.exit(0);
