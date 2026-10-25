## Inspiration

Last month one of us got a zero on a homework. He never saw it. It was hidden in Brightspace, the platform every Stony Brook class uses, between old posts and campus notices. We counted our feed this week: 94 items, 11 that mattered.

The theme was Steel and Steam. That made us think of the telegraph operator: someone who listens to every line all day and only comes to find you when a message really matters.

## What it does

Operator is an AI agent that watches Brightspace for you and messages you on iMessage only when something matters.

- **Filters, not forwards.** Every 10 minutes it reads your Brightspace calendar and sorts each item: urgent, good to know, or ignore. In our feed, 83 of 94 were ignored. The dashboard shows why.
- **Catches changes.** If a professor moves a deadline, you get one line. Reminders at 24 h, 3 h and 1 h move with it.
- **You can talk back.** Text, voice note or a photo of your timetable. Gemini works out what you mean, marks things done, adds events, or answers questions. If it is not sure, it asks.
- **It talks too.** A short spoken briefing of your day, on your phone or on the dashboard with live subtitles. There is also a hands-free voice call mode.
- **A simple dashboard.** Home, week, deadlines, courses, a log of what the agent did. English or Chinese. Nothing to set up.

## How we built it

- TypeScript on Node. The dashboard is one HTML file, no framework.
- Brightspace via its calendar feed, checked every 10 minutes and compared with the last check.
- Google Gemini for understanding text, photos and voice, for questions, and for writing the briefing.
- Photon for iMessage in both directions.
- ElevenLabs for voice, with word timestamps for the subtitles.
- Hosted on Vultr at myoperator.club, a GoDaddy Registry domain.

## Challenges we ran into

- Gemini once made up a transcript for audio it could not decode and marked a homework done. We now convert all audio first and tell the model never to guess.
- iMessage would not play our voice notes until we changed the audio format.
- The server ran in UTC while all our times were New York time, which caused a fake "deadline moved" message. Fixed by pinning the timezone.

## Accomplishments that we're proud of

- The full loop works on real course data: Brightspace → filter → iMessage → reply from the phone → dashboard updates.
- 83 of 94 items correctly silenced, each with a reason.
- Voice in both directions, with live subtitles.
- Live on a real domain, open source, with tests.

## What we learned

Filtering is the product. The value is in what the agent decides not to say, and in showing why.

## What's next for Operator

Login with SBU email so anyone can connect their own feed, and reading instructor announcements from Brightspace emails.
