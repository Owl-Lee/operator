import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { loadSnapshot, loadTelegrams, loadAgentLog, logAgent } from "./store.js";
import { triage } from "./triage.js";
import { runPoll, loadConfig, saveConfig, icalUrl } from "./poll.js";
import { parseText } from "./parse.js";
import { geminiExtract, hasGemini, type GItem } from "./gemini.js";

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
  return new Promise(res => { const chunks: Buffer[] = []; req.on("data", c => chunks.push(c)); req.on("end", () => { try { res(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { res({}); } }); });
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
    /* Agent intake: text and/or image → schedule items (Gemini when a key exists, rules otherwise). */
    if ((url.pathname === "/api/add" || url.pathname === "/api/add-image") && req.method === "POST") {
      const { text, image, mime } = await body(req);
      if (!text?.trim() && !image) return json({ error: "Nothing to read." }, 400);
      const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
      let imgPath: string | undefined;
      if (image) {
        mkdirSync("data/inbox", { recursive: true });
        imgPath = `data/inbox/${Date.now().toString(36)}.${(mime || "image/png").split("/")[1].replace("jpeg", "jpg")}`;
        writeFileSync(imgPath, Buffer.from(image, "base64"));
      }
      let items: GItem[] | null = null, summary = "", engine: "gemini" | "rules" | "queued" = "rules", notes: string[] = [];
      if (hasGemini()) {
        try {
          const g = await geminiExtract({ text, image: image ? { data: image, mime: mime || "image/png" } : undefined }, now);
          items = g.items; summary = g.summary; engine = "gemini";
        } catch (e: any) {
          notes.push(e?.message ?? "Gemini failed"); // fall through to rules / queue
        }
      }
      if (items) { /* Gemini answered */ }
      else if (image && !text?.trim()) {
        const inbox = existsSync("data/inbox.json") ? JSON.parse(readFileSync("data/inbox.json", "utf8")) : [];
        inbox.push({ at: new Date().toISOString(), path: imgPath });
        writeFileSync("data/inbox.json", JSON.stringify(inbox, null, 2));
        logAgent("triage", `Received an image. I'll read it as soon as Gemini is connected (${inbox.length} waiting).`, { path: imgPath });
        return json({ ok: true, queued: true, engine: "queued", items: [], summary: "", notes });
      } else {
        const p = parseText(text, now);
        notes = [...notes, ...p.notes]; engine = "rules";
        items = p.grounded ? [{ kind: p.kind, title: p.title, date: p.start.slice(0, 10), start: p.start.slice(11), end: p.end?.slice(11), location: p.location, course: p.kind === "class" ? p.title : undefined }] : [];
        summary = p.grounded ? `${p.kind}: ${p.title}` : "";
      }
      const s = loadSchedule(), added: any[] = [];
      for (const g of items) {
        const id = `p-${Date.now().toString(36)}${added.length}`;
        const base: any = { id, title: g.title, location: g.location, note: g.note, source: engine === "gemini" ? "agent" : "pasted", raw: (text || "").trim().slice(0, 500) || imgPath };
        if (g.kind === "class") { s.classes.push({ ...base, course: g.course || g.title, days: g.days?.length ? g.days : [new Date(`${g.date || now.toISOString().slice(0, 10)}T12:00`).toLocaleDateString("en-US", { weekday: "short" })], start: g.start || "09:00", end: g.end || g.start || "10:00" }); added.push({ ...g, id }); continue; }
        const date = g.date || now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        const start = `${date}T${g.start || (g.kind === "deadline" ? "23:59" : "09:00")}`, end = g.end ? `${date}T${g.end}` : undefined;
        const it = { ...base, course: g.course, start, end };
        (g.kind === "deadline" ? s.deadlines : g.kind === "meeting" ? s.meetings : s.events).push(it);
        added.push({ ...g, id, start, end });
      }
      saveSchedule(s);
      const what = added.map(a => `${a.kind}: “${a.title}”`).join("; ");
      logAgent("triage", added.length ? `Understood ${image ? "your image" : "your text"} as ${added.length} item${added.length > 1 ? "s" : ""} — ${what} (${engine}).` : `Read ${image ? "your image" : "your text"} but found nothing schedulable.`, { ids: added.map(a => a.id), engine });
      return json({ ok: true, items: added, summary, engine, notes });
    }
    if (url.pathname === "/api/remove" && req.method === "POST") {
      const { id } = await body(req);
      const s = loadSchedule();
      for (const k of ["classes", "meetings", "events", "deadlines"] as const) s[k] = s[k].filter((x: any) => x.id !== id);
      saveSchedule(s);
      logAgent("triage", "You removed an item I added. Noted.", { id });
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
