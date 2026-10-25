# Operator · 评委问答准备（面试式）

简单英语，每题 2 到 4 句。粗体是问题，引用块是答案。答案都基于这个周末真实发生的事，不用编。

---

## A. 行为类（Behavioral）

**1. What was the hardest part of this project?**
> Trust. The agent acts on my real homework, so a wrong guess has a real cost. Early on, Gemini invented a transcript for a voice note it could not decode and marked an assignment done. After that we added a rule: act only when confident, otherwise ask. That rule shaped the whole product.

**2. What took the most time?**
> The dashboard. We rebuilt the week view maybe five times until text was never cut off and overlapping events looked right. Filtering logic took one hour; making it feel calm took a day.

**3. How did you split the work?**
> One of us owned product and UX: what the agent says, what it ignores, how the dashboard looks, and testing every flow on real data. The other tested from the phone side, found bugs like the overlapping meetings and the Chinese text in the English UI, and worked on the demo.

**4. Did you disagree about anything? How did you resolve it?**
> Yes. We first had the agent suggest items into the schedule by itself. One of us thought it was helpful; the other thought it was dangerous, because a wrong suggestion looks like a real event. We removed it. The rule became: the agent never writes to your schedule unless you asked.

**5. What would you do differently if you started again?**
> Pin the timezone on day one and test on a real phone earlier. Both bugs cost us hours late at night. Also write the rules tests first; they took ten minutes and caught a wording regression immediately.

**6. What did you learn this weekend?**
> Filtering is the product. Forwarding everything is easy and useless. The value is in what the agent decides not to say, and in showing why.

**7. How did you decide what features to cut?**
> One question: does a student who has not seen this before understand it in three minutes? Anything that needed explaining got cut: filters, settings, the auto-suggest, the "GEMINI" badge on every answer.

**8. How did you handle being tired and under time pressure?**
> We deployed early, Saturday afternoon, so every later change went live with one command and was tested on the real site. That meant no scary big-bang at 3 AM. We also kept a short list of "must do before sleep" and did only that.

**9. Who is this for? Did you talk to users?**
> For ourselves first; we are the users and this came from a real zero. Then three classmates tested it on their phones during the hackathon. Their feedback gave us the overlapping-meeting bug, the English-only mode, and the idea that reminders must move when a deadline moves.

**10. What are you most proud of?**
> That the whole loop works on real data: Brightspace to filter to iMessage to a voice reply from the phone to the dashboard updating. And that it is live on a real domain, not a localhost demo.

## B. 产品类（Product）

**11. Why would a student use this instead of just checking Brightspace?**
> Because they do not check Brightspace. That is the problem. Operator comes to them, on iMessage, only when needed. It is a change from pulling to pushing, with a filter in between.

**12. How is it different from Canvas or Google Calendar reminders?**
> Those remind you about everything, so people turn them off. Operator filters first, explains what it filtered, and lets you talk back by text, voice or photo.

**13. What if it ignores something important?**
> It never deletes anything. Every ignored item is on the dashboard with its reason, and Brightspace is still there. The agent reduces noise; it does not hide data.

**14. How do you measure success?**
> Two numbers. How many items were silenced correctly: 83 of 94 in our feed, zero misses so far. And how often the user opens Brightspace: for us, not once in two days.

**15. Could this work at another university?**
> Yes. Any school on Brightspace gives the same calendar link. Canvas and Moodle have similar feeds, so the adapter is small. The rules and the agent do not change.

**16. How would you make money or sustain it?**
> Honestly, this is a student tool first. If it grew, the natural path is a small subscription or a campus license, because every call to Gemini and ElevenLabs costs a little. Right now it costs about one dollar a day to run for one person.

**17. How does it fit the theme, Steel and Steam?**
> The telegraph operator. In the steam age, one person listened to every line all day and only ran to find you when a wire mattered. That is exactly this agent. The steam skin is the visual nod.

## C. 技术类（Technical）

**18. Walk me through the architecture.**
> A Node server polls the Brightspace calendar feed every ten minutes, diffs it against the last snapshot, and runs the triage rules. Results go to a local JSON store. The dashboard is one HTML file reading a small API. Photon connects iMessage both ways. Every inbound message goes through one Gemini call that returns an intent and a reply. ElevenLabs turns text into speech with timestamps.

**19. How do you decide what is urgent?**
> Eight ordered rules. Not a course item: ignore. Old semester: ignore. Already past: ignore. Not a deadline, just an availability notice: ignore. Exam: urgent. Due within 72 hours: urgent. Quiz within a week: urgent. Everything else: need-to-know. Rules, not AI, so it is predictable and we can show every reason.

**20. Why rules and not the model for triage?**
> Because the cost of a wrong "ignore" is high and rules are explainable. A student can read the eight rules and trust them. The model is used where rules fail: understanding free text, voice and photos.

**21. What exactly does Gemini do, and how many calls?**
> One call per message. The prompt includes the current time, the open deadlines with ids, and the next two weeks of schedule. It returns JSON: the intent, a confidence, the item id, and the reply in the user's language. For photos and voice it also returns what it saw or heard, so the user can check it.

**22. How do you stop the model from doing something wrong?**
> Three ways. A confidence threshold of 0.75 for marking things done; below that it asks. Every action is logged and undoable. And for audio, the prompt says: if you cannot clearly hear words, say so and do nothing.

**23. How do you handle voice?**
> Incoming iMessage voice notes are Apple CAF files. We transcode them to MP3 with ffmpeg, then send them to Gemini, which transcribes and decides in the same call. Outgoing speech comes from ElevenLabs as MP3, transcoded to AAC so iMessage plays it inline.

**24. How do the live subtitles work?**
> ElevenLabs returns start and end times for every character. We group them into words, and as the audio plays we light up each word when its timestamp passes. The current word is highlighted in orange.

**25. Why is the briefing instant?**
> It is pre-generated. The server writes and voices the briefing on startup, after every poll, after any edit, and every twenty minutes, in both languages. A click plays the cached one. If the schedule changed a second ago, you get the previous version and a fresh one is made in the background.

**26. What happens when a professor moves a deadline?**
> The diff sees the same item id with a new due time. The user gets one line with the old and new time. The reminder markers include the due time, so the 24-hour, 3-hour and 1-hour reminders re-arm against the new date.

**27. How do you avoid spamming the user?**
> Ignored items never produce messages, even when they change. Reminders fire once per deadline per stage. Identical log entries collapse. And the dashboard feed hides housekeeping, so it reads like a diary, not a console.

**28. What was the timezone bug?**
> The server ran in UTC. Schedule times like 2026-10-25T09:00 have no zone and were read as UTC, which is five hours off. The briefing said the deadline was at 5 AM, and a date-only campus notice looked like it had moved. We pin the process to New York time in code now, and ignored items never trigger change messages.

**29. How do you handle API failures or rate limits?**
> Gemini: try the next model on a 429, retry once on a 503, give up after two quota hits and tell the user to try again in a minute. ElevenLabs: if it fails, the text answer still shows. Photon: if the line is down, the message is logged as drafted.

**30. What about privacy and security?**
> No passwords. We read a private calendar link the student controls and can reset any time. Keys live in a .env file on the server, never in the page or the repo. The agent only accepts messages from one phone number. All data is local JSON on our own server.

**31. How would this scale to many users?**
> Each user needs their own feed link, phone number and store. The polling and rules are cheap. The real costs are Gemini and ElevenLabs calls, which are per message, so they scale with use, not with users. First step would be login with SBU email and one store per user.

**32. How did you test it?**
> Three layers. Unit tests for the rules engine: parsing, triage order, change detection, message wording. A smoke suite of 59 checks against the live API, including voice. And manual testing on real phones by three people.

**33. Why one HTML file and no framework?**
> Speed and control. Two people, one weekend, and we changed the UI dozens of times. No build step meant every change was live in seconds. For a bigger team we would move to components.

**34. How is it deployed?**
> A small Vultr VPS, nginx in front, Let's Encrypt for HTTPS, pm2 keeps the process alive. One command pushes to GitHub, pulls on the server and restarts. The domain is myoperator.club from GoDaddy Registry.

**35. What would you build next, technically?**
> Multi-user login, Gemini writing its reasoning into the message, and reading instructor announcements from Brightspace emails, which the calendar feed does not include. Also streaming the voice reply so it starts speaking before the whole answer is ready.

## D. 兜底句

- 听不懂问题：
  > Sorry, could you say that again?
- 不知道答案：
  > Good question. We did not get to that this weekend. Here is how I would approach it: ...
- 评委挑错：
  > You are right, that is a limitation. We chose X because of Y; with more time we would do Z.
- 被打断没时间了：
  > The short version: it filters Brightspace and messages you only when it matters. Try it at myoperator.club.
