import type { CourseItem } from "./ical.js";
import type { Change } from "./diff.js";

const ET = "America/New_York";

/** "Mon, Oct 26, 11:59 PM" in New York time. */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: ET, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function courseCode(course: string): string {
  return course.match(/^[A-Z]{3}\s\d{3}/)?.[0] ?? course;
}

/** Plain, short messages. One sentence per line, joined with a space. (The telegraph is the metaphor, not the typography.) */
export function telegram(lines: string[]): string {
  return lines.map(l => l.trim().replace(/[.!]+$/, "") + ".").join(" ");
}

export function changeTelegram(c: Change): string {
  const code = courseCode(c.item.course);
  switch (c.type) {
    case "moved":
      return telegram([`${code} · ${c.item.title} moved: ${fmtTime(c.oldDue)} → ${fmtTime(c.item.due)}`]);
    case "new":
      return telegram([`New in ${code}: ${c.item.title}, due ${fmtTime(c.item.due)}`]);
    case "edited":
      return telegram([`${code} · ${c.item.title} was edited — worth a look at the instructions`]);
    case "removed":
      return telegram([`${code} · ${c.item.title} was removed from Brightspace`]);
  }
}

export function reminderTelegram(i: CourseItem, hoursLeft: number): string {
  const h = Math.round(hoursLeft);
  const left = h <= 1 ? "in about an hour" : `in ${h} hours`;
  return telegram([`${courseCode(i.course)} · ${i.title} is due ${left} (${fmtTime(i.due)})`, `Reply "done" once it's in`]);
}
