// Rule-engine tests: iCal parsing, change detection, triage, the text parser and telegram wording.
// No network, no sends. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseIcs, upcoming } from "../src/ical.js";
import { diffSnapshots } from "../src/diff.js";
import { triage, summarize } from "../src/triage.js";
import { parseText } from "../src/parse.js";
import { changeTelegram, reminderTelegram, telegram } from "../src/telegram.js";

const NOW = new Date("2026-10-24T20:00:00-04:00");
const ics = (events: string) => `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//EN\n${events}END:VCALENDAR\n`;
const vevent = (o: { uid: string; summary: string; loc: string; dt: string; seq?: number }) =>
  `BEGIN:VEVENT\nUID:${o.uid}\nSUMMARY:${o.summary}\nLOCATION:${o.loc}\nDTSTART:${o.dt}\nDTEND:${o.dt}\nSEQUENCE:${o.seq ?? 0}\nLAST-MODIFIED:20261001T000000Z\nEND:VEVENT\n`;

const feed = ics(
  vevent({ uid: "hw3", summary: "HW#3 - Due", loc: "-EST 393.01 Project Management - Fall 2026", dt: "20261027T035900Z" }) + // Mon Oct 26 11:59 PM ET → 51 h
  vevent({ uid: "quiz", summary: "Quiz 2 - Due", loc: "-EST 391.30 Technology Assessment - Fall 2026", dt: "20261030T035900Z" }) + // 5 days
  vevent({ uid: "disc", summary: "Discussion Week #12 - Due", loc: "-EST 391.30 Technology Assessment - Fall 2026", dt: "20261114T045900Z" }) + // 3 weeks
  vevent({ uid: "final", summary: "Final Exam - Due", loc: "-ANT 102.01 What Makes Us Human? - Fall 2026", dt: "20261215T161500Z" }) +
  vevent({ uid: "old", summary: "Essay - Due", loc: "-WRT 102.05 Writing - Summer 2026", dt: "20260706T035900Z" }) +
  vevent({ uid: "past", summary: "HW#1 - Due", loc: "-EST 393.01 Project Management - Fall 2026", dt: "20260915T035900Z" }) +
  vevent({ uid: "avail", summary: "Module 5 - Available", loc: "-EST 393.01 Project Management - Fall 2026", dt: "20261101T040000Z" }) +
  vevent({ uid: "notice", summary: "Winter Session Begins", loc: "Stony Brook University", dt: "20270107" })
);

test("iCal: titles, course, kind and due are extracted", () => {
  const items = parseIcs(feed);
  const hw = items.find(i => i.uid === "hw3")!;
  assert.equal(hw.title, "HW#3");
  assert.match(hw.course, /EST 393/);
  assert.equal(hw.kind, "assignment");
  assert.equal(hw.isDue, true);
  assert.equal(new Date(hw.due).toISOString(), "2026-10-27T03:59:00.000Z");
  assert.equal(items.find(i => i.uid === "quiz")!.kind, "quiz");
  assert.equal(items.find(i => i.uid === "final")!.kind, "exam");
  assert.equal(items.find(i => i.uid === "avail")!.isDue, false, "availability windows are not deadlines");
});

test("triage: rules fire in the documented order", () => {
  const items = parseIcs(feed);
  const by = Object.fromEntries(triage(items, NOW).map(t => [t.uid, t]));
  assert.equal(by.hw3.level, "urgent", "due within 72 h");
  assert.equal(by.quiz.level, "urgent", "quiz within a week");
  assert.equal(by.disc.level, "need");
  assert.equal(by.final.level, "urgent", "exams are always urgent");
  assert.equal(by.old.level, "ignore"); assert.match(by.old.reason, /Old course/);
  assert.equal(by.past.level, "ignore"); assert.match(by.past.reason, /past/i);
  assert.equal(by.avail.level, "ignore");
  assert.equal(by.notice.level, "ignore"); assert.match(by.notice.reason, /Not a course/);
  const s = summarize(Object.values(by));
  assert.deepEqual([s.urgent, s.need, s.ignore], [3, 1, 4]);
});

test("diff: moved deadline and new item are detected; unchanged feed is quiet", () => {
  const a = parseIcs(feed);
  assert.deepEqual(diffSnapshots(a, a), []);
  const movedFeed = feed.replace("20261027T035900Z", "20261030T035900Z").replace("UID:hw3\nSUMMARY:HW#3 - Due\nLOCATION:-EST 393.01 Project Management - Fall 2026\nDTSTART:20261030T035900Z\nDTEND:20261030T035900Z\nSEQUENCE:0", "UID:hw3\nSUMMARY:HW#3 - Due\nLOCATION:-EST 393.01 Project Management - Fall 2026\nDTSTART:20261030T035900Z\nDTEND:20261030T035900Z\nSEQUENCE:1");
  const b = parseIcs(movedFeed + "");
  const changes = diffSnapshots(a, b);
  const moved = changes.find(c => c.item.uid === "hw3");
  assert.ok(moved && moved.type === "moved", JSON.stringify(changes));
  const withNew = parseIcs(feed.replace("END:VCALENDAR", vevent({ uid: "new1", summary: "HW#4 - Due", loc: "-EST 393.01 Project Management - Fall 2026", dt: "20261110T045900Z" }) + "END:VCALENDAR"));
  assert.ok(diffSnapshots(a, withNew).some(c => c.type === "new" && c.item.uid === "new1"));
});

test("message wording: plain sentences, both times on a move", () => {
  const a = parseIcs(feed), b = parseIcs(feed.replace("20261027T035900Z", "20261030T035900Z"));
  const c = diffSnapshots(a, b).find(x => x.item.uid === "hw3")!;
  const t = changeTelegram(c);
  assert.match(t, /^EST 393 · HW#3 moved: /);
  assert.ok(!/TELEGRAM|STOP\./.test(t), "plain wording, no telegram caps");
  assert.match(t, /Mon, Oct 26, 11:59 PM/);
  assert.match(t, /Thu, Oct 29, 11:59 PM/);
  const r = reminderTelegram(a.find(i => i.uid === "hw3")!, 3);
  assert.match(r, /due in 3 hours/);
  assert.equal(telegram(["Hello"]), "Hello.");
});

test("upcoming: window and ordering", () => {
  const items = parseIcs(feed);
  const up = upcoming(items, NOW, 7).map(i => i.uid);
  assert.deepEqual(up, ["hw3", "quiz"]);
});

test("text parser: grounded English and Chinese; vague text stays ungrounded", () => {
  const en = parseText("Office hours with Prof. Pinto next Tuesday 3-4pm at Harriman 212", NOW);
  assert.equal(en.grounded, true); assert.equal(en.kind, "meeting");
  assert.equal(en.start.slice(0, 10), "2026-10-27"); assert.equal(en.start.slice(11, 16), "15:00"); assert.equal(en.end?.slice(11, 16), "16:00");
  assert.match(en.location ?? "", /Harriman 212/);
  const zh = parseText("周二下午3点和教授见面 在 Harriman 212", NOW);
  assert.equal(zh.grounded, true); assert.equal(zh.start.slice(0, 10), "2026-10-27"); assert.equal(zh.start.slice(11, 16), "15:00");
  const dl = parseText("Quiz 2 submission closes 10/28 at 23:59", NOW);
  assert.equal(dl.kind, "deadline"); assert.equal(dl.start, "2026-10-28T23:59");
  const vague = parseText("remind me to study more", NOW);
  assert.equal(vague.grounded, false);
});
