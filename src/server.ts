import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { loadSnapshot, loadTelegrams } from "./store.js";

/** npm run web → dashboard at http://localhost:4242 */
const PORT = Number(process.env.PORT ?? 4242);
const page = new URL("../web/index.html", import.meta.url);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const json = (data: unknown) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/api/state") {
    return json({
      now: process.env.FAKE_NOW ?? new Date().toISOString(),
      items: loadSnapshot(),
      telegrams: loadTelegrams(),
    });
  }
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(page));
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`📠 Dashboard on http://localhost:${PORT}`));
