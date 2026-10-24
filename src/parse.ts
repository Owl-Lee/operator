/**
 * Turn any pasted text (email, group chat, poster, one sentence — English or Chinese)
 * into a schedule item. Rule-based for now; Gemini will take over the same contract.
 */
export type Kind = "deadline" | "class" | "meeting" | "event";
export interface Parsed {
  kind: Kind; title: string; start: string; end?: string; location?: string;
  allDay?: boolean; confidence: number; notes: string[];
  /** true when an actual date or time was found — rules refuse to add ungrounded text */
  grounded: boolean;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const WD: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const pad = (n: number) => String(n).padStart(2, "0");

function etParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)!.value;
  return { y: +g("year"), m: +g("month"), d: +g("day"), wd: WD[g("weekday").toLowerCase()] };
}
function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function findDate(text: string, now: Date): { y: number; m: number; d: number; hit: string } | null {
  const t = etParts(now), lower = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/))) return { y: +m[1], m: +m[2], d: +m[3], hit: m[0] };
  if ((m = text.match(/(\d{1,2})月(\d{1,2})[日号]?/))) return { y: t.y, m: +m[1], d: +m[2], hit: m[0] };
  if ((m = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) return { y: t.y, m: MONTHS[m[1]], d: +m[2], hit: m[0] };
  if ((m = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/))) return { y: t.y, m: MONTHS[m[2]], d: +m[1], hit: m[0] };
  if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) return { y: m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : t.y, m: +m[1], d: +m[2], hit: m[0] };
  if (/今天|today/i.test(text)) return { ...addDays(t.y, t.m, t.d, 0), hit: "today" };
  if (/明天|tomorrow/i.test(text)) return { ...addDays(t.y, t.m, t.d, 1), hit: "tomorrow" };
  if (/后天/.test(text)) return { ...addDays(t.y, t.m, t.d, 2), hit: "后天" };
  if ((m = lower.match(/\b(next\s+)?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b/)) || (m = text.match(/(下?)(?:周|星期|礼拜)([一二三四五六日天])/))) {
    const key = m[2].toLowerCase(), target = WD[key], next = !!m[1];
    let delta = (target - t.wd + 7) % 7;
    if (delta === 0 && !next) delta = 0; else if (next && delta < 7) delta += delta === 0 ? 7 : 0;
    return { ...addDays(t.y, t.m, t.d, delta), hit: m[0] };
  }
  return null;
}

function findTimes(text: string): { start?: { h: number; mi: number }; end?: { h: number; mi: number }; hit: string } {
  // "3-4pm", "11am–3pm", "15:00-16:30", "下午3点到4点": a range where the suffix applies to both ends
  const range = text.match(/(上午|下午|晚上|中午|早上)?\s*(\d{1,2})(?:[:：点](\d{2}))?\s*(am|pm)?\s*[-–~至到]\s*(\d{1,2})(?:[:：点](\d{2}))?\s*(am|pm|点)?/i);
  if (range && (range[4] || range[7] || range[1] || /[:：点]/.test(range[0]))) {
    const pm = (s?: string) => /p/i.test(s || "") || /下午|晚上/.test(range[1] || "");
    let h1 = +range[2], h2 = +range[5];
    const m1 = +(range[3] || 0), m2 = +(range[6] || 0);
    const endPm = pm(range[7]) || (!range[7] && pm(range[4]));
    if (endPm && h2 < 12) h2 += 12;
    if ((pm(range[4]) || (!range[4] && endPm && h1 <= h2 - 12 + 12 && h1 < 12 && h1 + 12 <= h2)) && h1 < 12) h1 += 12;
    if (h1 <= 23 && h2 <= 23 && h2 > h1) return { start: { h: h1, mi: m1 }, end: { h: h2, mi: m2 }, hit: range[0] };
  }
  const re = /(上午|下午|晚上|中午|早上)?\s*(\d{1,2})(?:[:：点](\d{2})?)?\s*(am|pm|a\.m\.|p\.m\.|点半|半)?/gi;
  const out: { h: number; mi: number }[] = []; let hit = "";
  for (const m of text.matchAll(re)) {
    if (!m[1] && !m[3] && !m[4] && !/[:：点]/.test(m[0])) continue; // bare numbers aren't times
    let h = +m[2], mi = m[3] ? +m[3] : 0;
    const ap = (m[4] || "").toLowerCase(), cn = m[1] || "";
    if (/半/.test(ap)) mi = 30;
    if (/p/.test(ap) || /下午|晚上/.test(cn)) { if (h < 12) h += 12; }
    if (/中午/.test(cn) && h < 11) h += 12;
    if (/a/.test(ap) && h === 12) h = 0;
    if (h > 23) continue;
    out.push({ h, mi }); hit += m[0] + " ";
    if (out.length === 2) break;
  }
  // "3-4pm": first time inherits pm from the second
  if (out.length === 2 && out[1].h >= 12 && out[0].h < 12 && out[0].h + 12 <= out[1].h) out[0].h += 12;
  return { start: out[0], end: out[1], hit: hit.trim() };
}

export function parseText(raw: string, now = new Date()): Parsed {
  const text = raw.replace(/\s+/g, " ").trim();
  const notes: string[] = [];
  const kind: Kind = /\b(due|deadline|submit|submission|turn in)\b|截止|提交|交作业/i.test(text) ? "deadline"
    : /office hours?|meeting|meet with|advis|appointment|1:1|zoom|call with|会议|开会|见面|面谈|约了/i.test(text) ? "meeting"
    : /lecture|\bclass\b|seminar|recitation|每周|上课/i.test(text) ? "class"
    : "event";
  const date = findDate(text, now);
  const times = findTimes(text);
  let confidence = 0.4;
  if (date) confidence += 0.3; else notes.push("No date found — assumed today.");
  if (times.start) confidence += 0.2; else notes.push(kind === "deadline" ? "No time found — assumed 11:59 PM." : "No time found — marked all day.");
  const t = date ?? { ...etParts(now), hit: "" };
  const start = times.start ?? (kind === "deadline" ? { h: 23, mi: 59 } : { h: 9, mi: 0 });
  const startIso = `${t.y}-${pad(t.m)}-${pad(t.d)}T${pad(start.h)}:${pad(start.mi)}`;
  const end = times.end ? `${t.y}-${pad(t.m)}-${pad(t.d)}T${pad(times.end.h)}:${pad(times.end.mi)}` : undefined;

  const loc = text.match(/(?:\bat\b|\bin\b|@|地点[:：]?|在)\s*([A-Z][\w.'&-]*(?:\s+[A-Z0-9][\w.'&-]*){0,4}|[一-龥A-Za-z0-9]{2,20}(?:楼|厅|室|教室|馆|中心|Hall|Room|Library|Center)\s*[A-Za-z0-9-]*)/)
    ?? text.match(/((?:[A-Z][\w'&.-]*\s+){0,3}(?:Hall|Room|Ballroom|Library|Center|Centre|Building|Lab|Auditorium|Lounge|Theater)\b(?:\s+[A-Z0-9][\w-]*)?)/);
  const location = loc?.[1]?.trim();
  if (location) confidence += 0.1;

  let title = text.split(/[.。!！\n]/)[0];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const h of [date?.hit, times.hit, loc?.[0]].filter(Boolean) as string[]) title = title.replace(new RegExp(esc(h.trim()), "i"), " ");
  title = title.replace(/\b(on|at|from|to|by|due|is|the|a|an|next|this)\b/gi, " ").replace(/[,，:：\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  if (title.length > 70) title = title.slice(0, 70).replace(/\s+\S*$/, "") + "…";
  if (!title) title = kind === "deadline" ? "Deadline" : kind === "meeting" ? "Meeting" : "Event";

  return { kind, title, start: startIso, end, location, allDay: !times.start && kind !== "deadline", confidence: Math.min(1, confidence), notes, grounded: !!(date || times.start) };
}
