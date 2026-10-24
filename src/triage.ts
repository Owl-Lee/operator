import type { CourseItem } from "./ical.js";

export type Level = "urgent" | "need" | "ignore";
export interface Triage { uid: string; level: Level; reason: string }

const COURSE = /^[A-Z]{3}\s\d{3}/;
const H = 3.6e6;

/**
 * Rule-based judgement of every feed item. Gemini will replace the rules later;
 * the shape (level + one-line reason) is what the dashboard and telegrams consume.
 */
export function triage(items: CourseItem[], now = new Date()): Triage[] {
  const n = now.getTime();
  return items.map(i => {
    const due = Date.parse(i.due);
    const hours = (due - n) / H;
    const semester = i.course.match(/(Fall|Spring|Summer|Winter)\s\d{4}/)?.[0];
    if (!COURSE.test(i.course)) return { uid: i.uid, level: "ignore", reason: "Not a course item (campus notice)" };
    if (semester && /Summer|Spring/.test(semester)) return { uid: i.uid, level: "ignore", reason: `Old course (${semester})` };
    if (due < n) return { uid: i.uid, level: "ignore", reason: "Already past" };
    if (!i.isDue) return { uid: i.uid, level: "ignore", reason: "Availability notice, not a deadline" };
    if (i.kind === "exam") return { uid: i.uid, level: "urgent", reason: "Exam — always top priority" };
    if (hours <= 72) return { uid: i.uid, level: "urgent", reason: `Due in ${Math.round(hours)} h` };
    if (i.kind === "quiz" && hours <= 24 * 7) return { uid: i.uid, level: "urgent", reason: "Quiz within a week" };
    return { uid: i.uid, level: "need", reason: `${i.kind} due in ${Math.round(hours / 24)} days` };
  });
}

export function summarize(t: Triage[]) {
  const c = { urgent: 0, need: 0, ignore: 0 };
  for (const x of t) c[x.level]++;
  return c;
}
