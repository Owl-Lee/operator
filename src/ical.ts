import ical from "node-ical";

export type ItemKind = "assignment" | "discussion" | "quiz" | "exam" | "content" | "other";

export interface CourseItem {
  uid: string;
  title: string;
  course: string;
  kind: ItemKind;
  isDue: boolean;          // a deadline (vs. "Available" notices)
  due: string;             // ISO time
  sequence: number;
  lastModified: string | null;
  description: string;
  link: string | null;
}

function cleanCourse(loc: string | undefined): string {
  return (loc ?? "").replace(/^-/, "").trim();
}

function detectKind(title: string, desc: string): ItemKind {
  const t = `${title}\n${desc}`;
  if (/\bexam\b|midterm|final exam/i.test(title)) return "exam";
  if (/Quizzes:/i.test(desc) || /\bquiz\b/i.test(title)) return "quiz";
  if (/Discussions:/i.test(desc) || /discussion/i.test(title)) return "discussion";
  if (/Assignments:/i.test(desc) || /\bHW\b|homework/i.test(t)) return "assignment";
  if (/Materials:|Modules:/i.test(desc)) return "content";
  return "other";
}

function firstLink(desc: string): string | null {
  const m = desc.match(/https:\/\/mycourses\.stonybrook\.edu\/\S+/);
  return m ? m[0] : null;
}

/** Parse raw .ics text into normalized items. */
export function parseIcs(raw: string): CourseItem[] {
  const data = ical.sync.parseICS(raw);
  const items: CourseItem[] = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== "VEVENT") continue;
    const e = ev as any;
    const title = String(e.summary ?? "").trim();
    const desc = String(e.description ?? "");
    const kind = detectKind(title, desc);
    items.push({
      uid: String(e.uid),
      title: title.replace(/\s*-\s*(Due|Available|Availability Ends)$/i, ""),
      course: cleanCourse(e.location as string | undefined),
      kind,
      isDue: /- Due$/i.test(title) || /Availability Ends$/i.test(title) || kind === "discussion" || kind === "exam",
      due: new Date(e.start as Date).toISOString(),
      sequence: Number((e as any).sequence ?? 0),
      lastModified: e.lastmodified ? new Date(e.lastmodified as Date).toISOString() : null,
      description: desc.replace(/<[^>]+>/g, "").trim(),
      link: firstLink(desc),
    });
  }
  return items.sort((a, b) => a.due.localeCompare(b.due));
}

export async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
  return res.text();
}

/** Upcoming deadlines only, within `days` from now. */
export function upcoming(items: CourseItem[], now = new Date(), days = 14): CourseItem[] {
  const end = now.getTime() + days * 86400_000;
  return items.filter(i => i.isDue && Date.parse(i.due) >= now.getTime() && Date.parse(i.due) <= end);
}
