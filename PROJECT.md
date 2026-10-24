# Brass Telegraph 🚂📠

> SBUHacks 2026 · Theme: Steel and Steam · Submission due **Sun Oct 25, 9:00 AM** on Devpost

**One line:** You never log in to Brightspace again. An agent watches every course for you and only "sends a telegram" (iMessage) when something actually matters.

## Problem
Brightspace's notification bell is a flat, unranked list. Students log in daily to check announcements and deadlines, and still miss things (Lee almost missed a discussion due 11:59 PM on the first night of this hackathon).

## What makes it an agent, not a forwarder
1. **Judges** — classifies each item: urgent / need-to-know / ignore. Ignored items are never pushed.
2. **Tracks changes** — detects when a professor silently moves a deadline (iCal `SEQUENCE` / `LAST-MODIFIED` / `DTSTART` diff) and sends an AMENDMENT telegram.
3. **Proactive** — escalating reminders (24h / 3h / 1h) without being asked; reply "done" to stop them.
4. **Answers questions** — Gemini function calling over the local DB (`get_deadlines`, `search_announcements`, `mark_done`, `snooze`).

## Data sources (both verified 2026-10-23)
| Source | What it gives | How |
|---|---|---|
| Brightspace iCal feed | Every assignment / discussion / quiz / exam with exact due time, course name, full instructions | `BRIGHTSPACE_ICAL_URL` (private token — keep in `.env`, reset after event) |
| Brightspace email notifications | Instructor announcements (content iCal doesn't have), grade releases, "due in 2 days" | From `donotreply@notifications.mycourses.stonybrook.edu` → SBU Gmail, filtered to label `Brightspace` (skip inbox) |

**iCal field mapping (observed):**
- `SUMMARY` → title; suffix tells type: `- Due`, `- Available`, `- Availability Ends`
- `LOCATION` → course, e.g. `-EST 393.01 Project Management - Fall 2026`
- `DTSTART` → due time (UTC; `T035959Z` = 11:59 PM ET)
- `UID` → stable id · `SEQUENCE` → bumps on edit · `LAST-MODIFIED`
- `DESCRIPTION` → instructions + `Assignments:/Discussions:/Quizzes:` + link
- Feed includes old Summer 2026 courses → filter to future events

**Email subject format:** `<COURSE> - Announcements: <Title>`

## Theme integration (real, not a skin)
- **Telegraph office** = messaging. Every push is telegram-style: `TELEGRAM: CSE 214 QUIZ MOVED TO THURSDAY. STOP.`
- **Boiler pressure gauge** = workload. Needle = load of the next 72h; red zone + steam when overloaded; drops when you reply "done".

## Stack
TypeScript / Node everywhere (Photon's Spectrum SDK is TS).
- `node-ical` — parse feed
- Gemini API — extract / classify / function-calling agent
- Photon (spectrum-ts) — iMessage send/receive via webhook
- SQLite or JSON file — tasks, announcements, snapshots
- Frontend: React (Lovable for the steampunk UI) reading backend API
- Optional: ElevenLabs voice "morning telegram" (Photon supports voice-note bubbles)

## Prize targets
Best Overall · Best UI/UX · MLH Best Use of Gemini · (opt.) ElevenLabs · Photon sponsor

## Priorities
- **P0** iCal ingest ✅ skeleton · email ingest · Gemini classify · iMessage push · Q&A
- **P1** change detection ✅ skeleton · escalating reminders · reply "done"
- **P2** voice briefing · conflict warnings (2 exams + HW same day)

## Timeline
| When | Goal |
|---|---|
| Fri night → 2 AM | Three lines open: iCal ✅, Gmail read, **Photon sends 1 msg to phone** |
| Sat AM | Gemini extract + classify, store, push |
| Sat PM | Q&A agent w/ tools; change detection; escalating reminders |
| Sat evening | Dashboard + pressure gauge |
| Sun 0–4 AM | **Sleep** |
| Sun 4–8 AM | Polish, bugs, rehearse demo ×3, record backup video |
| Sun 8–9 AM | Devpost write-up, submit |

## 3-min demo script
1. (20s) Screenshot: "First night of the hackathon I almost missed a 11:59 deadline."
2. (30s) Dashboard, gauge in red, steaming.
3. (40s) Forward an old notification email → phone receives telegram live.
4. (30s) Simulate deadline change → AMENDMENT telegram.
5. (40s) Text "what should I do first this week?" → agent calls tools, answers; reply "done" → gauge drops.
6. (20s) Scales to any school on Brightspace: one Gmail auth + paste iCal link.

## Risks
| Risk | Fallback |
|---|---|
| SBU Google blocks 3rd-party OAuth | Google Apps Script inside own account → POST to backend webhook |
| No new announcement during demo | Forward an old one; edit a snapshot to fake a deadline change |
| Photon setup stuck | Ask Photon sponsor table; fallback: web dashboard + email push |

## Security
- iCal URL = private key. `.env` only, never commit. **Reset it on Brightspace after the event** (the current one was pasted in a chat).
