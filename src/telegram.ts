import type { CourseItem } from "./ical.js";
import type { Change } from "./diff.js";

const ET = "America/New_York";

export function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", { timeZone: ET, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .toUpperCase();
}

function courseCode(course: string): string {
  return course.match(/^[A-Z]{3}\s\d{3}/)?.[0] ?? course;
}

/** Telegram-style text, all caps, "STOP." between sentences. */
export function telegram(lines: string[]): string {
  return "TELEGRAM: " + lines.map(l => l.toUpperCase().replace(/[.!]+$/, "") + ". STOP.").join(" ");
}

export function changeTelegram(c: Change): string {
  const code = courseCode(c.item.course);
  switch (c.type) {
    case "moved":
      return telegram([`AMENDMENT ${code} ${c.item.title}`, `MOVED FROM ${fmtTime(c.oldDue)} TO ${fmtTime(c.item.due)}`]);
    case "new":
      return telegram([`NEW ${c.item.kind} IN ${code}: ${c.item.title}`, `DUE ${fmtTime(c.item.due)}`]);
    case "edited":
      return telegram([`${code} ${c.item.title} WAS EDITED`, `CHECK INSTRUCTIONS`]);
    case "removed":
      return telegram([`${code} ${c.item.title} WAS REMOVED`]);
  }
}

export function reminderTelegram(i: CourseItem, hoursLeft: number): string {
  const urgency = hoursLeft <= 1 ? "URGENT" : hoursLeft <= 3 ? "PRIORITY" : "NOTICE";
  return telegram([`${urgency} ${courseCode(i.course)} ${i.title}`, `DUE IN ${Math.round(hoursLeft)} HOURS`]);
}
