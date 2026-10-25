# Operator · 3-minute demo script

One story: **"I never log in to Brightspace again."** Order: problem → it watches → it only speaks when it matters → I talk back from my phone → it talks.

## 0:00–0:25 Open (home, steam skin)

> Hi, I'm Lee, this is Operator. Brightspace sends every student a flat list of everything. I counted mine this week: 94 items, and 11 of them actually mattered. Operator is the telegraph operator who listens to every line for you, and only taps you on the shoulder when something is worth it.

(point at the greeting and the next-deadline countdown card)

## 0:25–0:55 Filtering is the product ("Didn't bother you with" card)

> It reads my Brightspace calendar feed every ten minutes and triages every item: urgent, need-to-know, or ignore. 83 of 94 were ignored, and it tells me why.

(click "Old course" to expand, scroll, then click "Already past")

> Old semester, already past, campus notices. Nothing here ever reaches my phone. The two urgent ones did.

## 0:55–1:30 The phone loop (hold up the phone or mirror it)

> This is what reaching me looks like. When a professor moved a deadline, I got this one line. Before it's due I get 24-hour, 3-hour and 1-hour nudges. And I can just talk back.

(send a voice note: "I just submitted HW#3 for EST 393" → wait for the reply → back to the dashboard, HW#3 ticks off)

> One voice note, one Gemini call: it figured out which assignment I meant, marked it done, and the reminders stopped. If it isn't sure, it asks instead of guessing.

## 1:30–2:10 Talking to it on the dashboard (Agent button → Voice call)

> Same brain on the dashboard.

(say: "What do I have on Tuesday, and is anything urgent?" → let it answer; subtitles light up word by word)

> ElevenLabs reads the answer with word-level subtitles. And it understands anything with a time in it.

(drag a timetable screenshot onto the page → classes appear → click one undo)

## 2:10–2:40 Briefing and week

(click "Morning telegram" in the nav, let it read for ~5 s, stop)

> Every morning it writes and reads me a briefing for the day. Here's my week; everything you saw lives in one place, in English or Chinese, no settings to configure.

(switch to Week, toggle 中 then back to EN)

## 2:40–3:00 Close

> It's live at myoperator.club, open source, built on Gemini, Photon for iMessage, ElevenLabs, GoDaddy and Vultr. Filtering is the product: the value is in what it decides not to say. Thanks.

---

## Before you go on

- 10 minutes before: text "hi" to +1 415 605-6081 from the phone so the iMessage line is warm.
- Laptop: three tabs open (home, week, GitHub), microphone already allowed for myoperator.club, volume up.
- Reset HW#3 (and HW#4 / Discussion #10) to not-done so there is something to tick off.
- Fallbacks: the briefing is cached and always plays; if iMessage is slow, show the earlier message screenshot and keep talking.

## Likely questions

- **How does it decide what's urgent?** Eight ordered rules, all explainable: exams always, due within 72 h, quizzes within a week; old semesters, past items, availability notices and campus notices are ignored. No black box.
- **How would someone else use it?** Paste your own Brightspace iCal link on the Setup page; the rest follows.
- **How is this different from Canvas / Google Calendar reminders?** Those remind you of everything. Operator filters first, explains what it filtered, and you can talk back in text, voice or photos.
