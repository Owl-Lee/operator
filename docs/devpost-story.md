## Inspiration

Last month one of us got a zero on a homework. Not for skipping it: he never saw it. It was sitting in Brightspace, the platform every Stony Brook class runs on, between old-semester posts, "module now available" notices and campus announcements. We counted the feed this week: **94 items, and 11 of them actually mattered**.

The theme was Steel and Steam, and that made us think of the one job that used to solve exactly this problem: the telegraph operator, who listened to every line all day and only came to find you when a wire actually concerned you.

## What it does

Operator is an AI agent that watches Brightspace for you and reaches you on iMessage only when something matters.

- **Filters instead of forwarding.** Every ten minutes it reads your Brightspace calendar feed and sorts every item: urgent, need-to-know, or ignore. In our real feed 83 of 94 were ignored. The dashboard shows what was filtered and why.
- **Catches silent changes.** When a professor moves a deadline you get one plain line: `EST 393 · HW#3 moved: Thu, Oct 29, 11:59 PM → Mon, Oct 26, 11:59 PM.` Reminders at 24 h, 3 h and 1 h re-arm against the new time.
- **Takes replies in any form.** Text "HW#3 交了", send a voice note, or photograph your timetable. One Gemini call decides the intent (done, undo, question, add, clarify, chat), acts only when it is confident, and asks back otherwise.
- **Talks.** A spoken briefing of your day, written by Gemini and read by ElevenLabs, as a voice note on your phone or on the dashboard with live word-by-word subtitles. A hands-free voice-call mode lets you just talk to it.
- **A calm dashboard.** Home, week, deadlines by month, per-course cards, a log of everything the agent did, English or Chinese, five skins, one input and nothing to configure.

## How we built it

- **TypeScript on Node 22**, no framework on either side: the dashboard is a single HTML file, the server is Node's `http` module.
- **Brightspace** through its private iCal feed, parsed with `node-ical`, diffed against the previous snapshot every poll.
- **Google Gemini** (REST, JSON mode) for understanding text, photos and voice, for Q&A over the live schedule, and for writing the briefing. One call per message, automatic model fallback.
- **Photon Spectrum SDK** for iMessage in both directions. Incoming voice notes are transcoded with ffmpeg before Gemini sees them; outgoing ones are transcoded so iMessage plays them inline.
- **ElevenLabs** text-to-speech with per-character timestamps, which drives the subtitles. Briefings are pre-generated and cached so a click plays instantly.
- **Vultr** VPS behind nginx and Let's Encrypt, domain **myoperator.club** from the GoDaddy Registry offer.

## Challenges we ran into

- Gemini confidently invented a transcript for an audio format it could not decode and marked an assignment done. Now everything is transcoded to MP3 first and the prompt forbids acting on audio it cannot hear.
- iMessage shows a dead 00:00 player for MP3 voice notes. AAC in an m4a container fixed it.
- The server ran in UTC while every schedule time was New York wall-clock time. That shifted a briefing by five hours and produced a fake "deadline moved" message for a campus notice. Timezone is now pinned in code, and ignored items never produce change messages.
- Staying inside API quotas meant merging intent detection, extraction and answering into a single model call per message.

## Accomplishments that we're proud of

- A complete loop on real course data: Brightspace → triage → iMessage → reply from the phone → dashboard updates.
- 83 of 94 items correctly silenced, each with a readable reason.
- Voice in both directions, with subtitles that light up as the words are spoken.
- Live on a real domain with HTTPS, code public, tests for the rules engine.

## What we learned

Filtering is the product. Forwarding everything is easy and useless; the value is in what the agent decides not to say, and in being able to show why.

## What's next for Operator

Sign-in with SBU email so anyone can connect their own feed, Gemini-assisted triage with its reasoning written into the message, and reading instructor announcements (which the calendar feed does not carry) from Brightspace notification emails.
