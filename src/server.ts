import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { loadSnapshot, loadTelegrams, loadAgentLog } from "./store.js";
import { triage } from "./triage.js";

/** npm run web → dashboard at http://localhost:4242 */
const PORT = Number(process.env.PORT ?? 4242);
const page = new URL("../web/index.html", import.meta.url);
const schedulePath = new URL("../schedule.json", import.meta.url);

/** Classes / meetings / events that Brightspace doesn't know about (user-edited). */
function loadSchedule(): unknown {
  return existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, "utf8")) : { classes: [], meetings: [], events: [] };
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const json = (data: unknown) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/api/state") {
    const now = process.env.FAKE_NOW ?? new Date().toISOString();
    const items = loadSnapshot();
    return json({
      now,
      items,
      triage: triage(items, new Date(now)),
      agentLog: loadAgentLog(),
      telegrams: loadTelegrams(),
      schedule: loadSchedule(),
    });
  }
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(page));
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`📠 Dashboard on http://localhost:${PORT}`));
