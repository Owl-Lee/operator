import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadSnapshot, loadTelegrams, loadAgentLog, logAgent } from "./store.js";
import { triage } from "./triage.js";
import { runPoll, loadConfig, saveConfig, icalUrl } from "./poll.js";
import { parseText } from "./parse.js";

/** npm run web → dashboard at http://localhost:4242 */
const PORT = Number(process.env.PORT ?? 4242);
const page = new URL("../web/index.html", import.meta.url);
const schedulePath = new URL("../schedule.json", import.meta.url);

interface Schedule { classes: any[]; meetings: any[]; events: any[]; deadlines: any[]; _readme?: string }
function loadSchedule(): Schedule {
  const s = existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, "utf8")) : {};
  return { classes: [], meetings: [], events: [], deadlines: [], ...s };
}
function saveSchedule(s: Schedule): void {
  writeFileSync(schedulePath, JSON.stringify(s, null, 2));
}
function body(req: IncomingMessage): Promise<any> {
  return new Promise(res => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
const mask = (u?: string) => u ? u.replace(/token=([^&]{4})[^&]*/, "token=$1…") : null;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const json = (data: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  try {
    if (url.pathname === "/api/state") {
      const now = process.env.FAKE_NOW ?? new Date().toISOString();
      const items = loadSnapshot();
      return json({ now, items, triage: triage(items, new Date(now)), agentLog: loadAgentLog(), telegrams: loadTelegrams(), schedule: loadSchedule(),
        setup: { ical: mask(icalUrl()), icalFromEnv: !!process.env.BRIGHTSPACE_ICAL_URL, photon: !!process.env.IMESSAGE_PROJECT_ID, gemini: !!process.env.GEMINI_API_KEY, phone: process.env.MY_PHONE && process.env.MY_PHONE !== "+1" ? process.env.MY_PHONE.replace(/\d(?=\d{2})/g, "•") : null } });
    }
    /* Setup page: save the Brightspace feed URL and import right away. */
    if (url.pathname === "/api/setup" && req.method === "POST") {
      const { icalUrl: u } = await body(req);
      if (!/^https:\/\/.+\.ics\?token=/.test(u || "")) return json({ error: "That doesn't look like a Brightspace iCal link (should end in feed.ics?token=…)." }, 400);
      saveConfig({ ...loadConfig(), icalUrl: u });
      logAgent("poll", "Connected a Brightspace calendar feed. Importing now.");
      const r = await runPoll();
      return json({ ok: true, imported: r.items.length, summary: r.summary });
    }
    if (url.pathname === "/api/poll" && req.method === "POST") {
      const r = await runPoll();
      return json({ ok: true, imported: r.items.length, changes: r.changes.length, summary: r.summary });
    }
    /* "Paste anything": free text → parsed item → schedule.json, with an undo id. */
    if (url.pathname === "/api/add" && req.method === "POST") {
      const { text } = await body(req);
      if (!text?.trim()) return json({ error: "Nothing to read." }, 400);
      const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
      const p = parseText(text, now);
      const s = loadSchedule();
      const id = `p-${Date.now().toString(36)}`;
      const item: any = { id, title: p.title, start: p.start, end: p.end, location: p.location, source: "pasted", raw: text.trim().slice(0, 500), confidence: p.confidence };
      if (p.kind === "class") { item.course = p.title; item.days = [new Date(p.start).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" })]; item.start = p.start.slice(11); item.end = (p.end || p.start).slice(11); s.classes.push(item); }
      else if (p.kind === "deadline") s.deadlines.push(item);
      else if (p.kind === "meeting") s.meetings.push(item);
      else s.events.push(item);
      saveSchedule(s);
      logAgent("triage", `Read your pasted text as ${p.kind === "event" ? "an" : "a"} ${p.kind}: “${p.title}” on ${p.start.replace("T", " ")}${p.location ? " at " + p.location : ""} (${Math.round(p.confidence * 100)}% sure).`, { id, kind: p.kind });
      return json({ ok: true, id, parsed: p });
    }
    if (url.pathname === "/api/remove" && req.method === "POST") {
      const { id } = await body(req);
      const s = loadSchedule();
      for (const k of ["classes", "meetings", "events", "deadlines"] as const) s[k] = s[k].filter((x: any) => x.id !== id);
      saveSchedule(s);
      logAgent("triage", "You removed an item I added from pasted text. Noted.", { id });
      return json({ ok: true });
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(page));
    }
    res.writeHead(404).end();
  } catch (e: any) {
    json({ error: e?.message ?? String(e) }, 500);
  }
}).listen(PORT, () => console.log(`📠 Dashboard on http://localhost:${PORT}`));
