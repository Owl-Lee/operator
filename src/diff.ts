import type { CourseItem } from "./ical.js";

export type Change =
  | { type: "new"; item: CourseItem }
  | { type: "moved"; item: CourseItem; oldDue: string }
  | { type: "edited"; item: CourseItem }
  | { type: "removed"; item: CourseItem };

/** Compare last snapshot to current feed. Keyed by UID; SEQUENCE bumps on any edit. */
export function diffSnapshots(prev: CourseItem[], curr: CourseItem[]): Change[] {
  const before = new Map(prev.map(i => [i.uid, i]));
  const after = new Map(curr.map(i => [i.uid, i]));
  const changes: Change[] = [];

  for (const [uid, item] of after) {
    const old = before.get(uid);
    if (!old) changes.push({ type: "new", item });
    else if (old.due !== item.due) changes.push({ type: "moved", item, oldDue: old.due });
    else if (old.sequence !== item.sequence) changes.push({ type: "edited", item });
  }
  for (const [uid, item] of before) if (!after.has(uid)) changes.push({ type: "removed", item });
  return changes;
}
