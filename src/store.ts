import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import type { CourseItem } from "./ical.js";

const DIR = "data";
const SNAP = `${DIR}/snapshot.json`;

export function loadSnapshot(): CourseItem[] {
  return existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, "utf8")) : [];
}

export function saveSnapshot(items: CourseItem[]): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(SNAP, JSON.stringify(items, null, 2));
}
