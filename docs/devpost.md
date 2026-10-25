# Devpost submission · Operator

Paste each section into the matching Devpost field. Links to include: https://myoperator.club · https://github.com/Owl-Lee/operator

---

## Project name

Operator

## Tagline (≤ 60 chars)

The telegraph operator who watches your Brightspace for you.

## Inspiration

Brightspace's notification bell is a flat, unranked list. On the first night of this hackathon one of us almost missed a discussion post due at 11:59 PM, buried under old-semester items and "module now available" notices. We counted: our real feed had 94 items and 11 of them mattered. Steel and Steam made us think of the one person who used to solve exactly this problem: the telegraph operator, who listened to every line all day and only ran to find you when a wire actually concerned you.

## What it does

Operator reads your Brightspace calendar feed every ten minutes, decides what deserves your attention, and sends you a short telegram over iMessage only when something does.

- **Triages instead of forwarding.** Every item is judged urgent / need-to-know / ignore. In our real feed 83 of 94 were ignored (old semesters, past dates, availability windows). Those are never pushed; the dashboard shows what was filtered and why.
- **Catches silent changes.** When a professor moves a deadline, you get `TELEGRAM: AMENDMENT EST 393 HW#3. STOP. MOVED TO MON, OCT 26, 11:59 PM. STOP.` and the 24 h / 3 h / 1 h reminders re-arm against the new time.
- **Takes replies in any form.** Text "HW#3 交了", send a voice note, or photograph your timetable. One Gemini call decides the intent (done / undo / question / add / clarify / chat), acts only when confident, and asks back otherwise.
- **Talks.** A spoken briefing written by Gemini and read by ElevenLabs, as a voice note on your phone or on the dashboard with live word-by-word subtitles. A hands-free voice-call mode lets you just talk to it.
- **A calm dashboard** with home, week, deadlines and course views, bilingual (EN / 中), with one input and no filters to configure.

## How we built it

- **TypeScript on Node 22**, no framework on either side: the dashboard is a single HTML file, the server is Node's `http` module.
- **Brightspace** via its private iCal feed, parsed with `node-ical`, diffed against the previous snapshot every poll.
- **Google Gemini** (REST, JSON mode) for understanding text, photos and voice, for Q&A over the live schedule, and for writing the briefing. One call per message, with automatic model fallback.
- **Photon Spectrum SDK** for iMessage in both directions; incoming voice notes are transcoded with ffmpeg before Gemini sees them, outgoing ones are transcoded so iMessage plays them inline.
- **ElevenLabs** text-to-speech with per-character timestamps, which drives the karaoke-style subtitles. Briefings are pre-generated and cached so a click plays instantly.
- **Vultr** VPS behind nginx + Let's Encrypt, domain **myoperator.club** from the GoDaddy Registry / MLH offer.

## Challenges we ran into

- Gemini confidently invented a transcript for an audio format it could not decode and marked an assignment done. We now transcode everything to MP3 first and the prompt forbids acting on audio it cannot hear.
- iMessage shows a dead 00:00 player for MP3 voice notes; AAC in an m4a container fixed it.
- The server ran in UTC while every schedule time was New York wall-clock time, which shifted a briefing by five hours and even triggered a fake "deadline moved" telegram for a campus notice. Timezone is now pinned in code and ignored items never produce change telegrams.
- Keeping within API quotas meant merging intent detection, extraction and answering into a single model call per message.

## Accomplishments that we're proud of

- A complete loop: Brightspace → triage → iMessage → reply from the phone → dashboard updates, all working on real course data.
- 83 of 94 items correctly silenced, with a human-readable reason for each.
- Voice in both directions with subtitles that light up as the words are spoken.
- Shipped on a real domain with HTTPS, and the code is public.

## What we learned

Filtering is the product. Forwarding everything is easy and useless; the value is in what the agent decides not to say, and in being able to show why.

## What's next for Operator

Multi-user sign-in with SBU email, Gemini-assisted triage with its reasoning written into the telegram, and reading instructor announcements (which the iCal feed does not carry) from Brightspace notification emails.

## Built with

typescript · node.js · google-gemini · photon-spectrum · imessage · elevenlabs · ffmpeg · node-ical · nginx · vultr · godaddy-registry · letsencrypt
