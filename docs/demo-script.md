# Operator · 3 分钟演示稿（简单版）

短句，简单词。英文照着念，括号里是动作。全部念完约 2 分 50 秒。

---

## 0:00–0:20 开场（主页）

> Hi, I'm Lee. This is Operator.
>
> Last month I got a zero on a homework. I did not see it. It was hidden in Brightspace, with 90 other things. Brightspace is where all our classes post homework.
>
> Operator watches Brightspace for me. It only tells me the things that matter.

## 0:20–0:40 过滤（「没打扰你的」卡片）

> Every 10 minutes it reads my Brightspace calendar. Then it sorts every item: urgent, good to know, or ignore.
>
> My feed has 94 items. 83 are ignored. It shows me why.

（点开「Old course」，滚一下，再点「Already past」）

## 0:40–1:00 Agent 记录（往下滚到「What the agent did」）

> Everything it does is written here. When it checked Brightspace. When it sent me a message. When I told it something.
>
> No black box. I can always see what it did and why.

## 1:00–1:35 手机（举起手机）

> The same agent lives on my phone, in iMessage.

（展示手机上的对话）

> It sends me short messages when something changes, and reminds me before every deadline. And I can talk to it right here. Watch.

（手机发语音：「我刚交了 EST 393 的 HW#3」→ 等回复 → 切回网页，HW#3 打勾）

> I just said "I finished HW#3". It found the right homework, marked it done, and the reminders stopped. If it is not sure what I mean, it asks me first.

## 1:35–2:10 网页对话（点右下 Agent → Voice call）

> The same brain is on the website. I can talk to it.

（说："What do I have on Tuesday?" → 等它读完，字幕一个词一个词亮）

> It answers out loud, with live subtitles.
>
> I can also just tell it things, in English or Chinese.

（挂断，在输入框打字："Meeting with Prof. Lee Friday 2pm at Harriman 212" → 回车 → 会议出现在周五下午 → 点 Undo）

> One sentence, one meeting added. One click to undo.

## 2:10–2:35 早报、本周、截止、课程

（点顶部 Morning telegram，听 5 秒，按停）

> Every morning it reads me my day.

（切 Week 页）

> This is my week. Classes, meetings, events, deadlines, all in one place.

（切 Deadlines 页，再切 Courses 页，各停一秒）

> Every deadline, by month. And every class, with what is due for it.

## 2:35–2:50 皮肤和语言，收尾

（点右上调色盘，选「Steam · Airship」→ 点「中」再切回 EN）

> Five looks. English or Chinese. Nothing to set up.
>
> Operator is live at myoperator.club. The code is on GitHub. We used Gemini, Photon for iMessage, ElevenLabs for voice, a GoDaddy domain, and Vultr.
>
> Less noise, only what matters. I have not opened Brightspace in two days. Thank you.

---

## 演示前 10 分钟

- 手机给 +1 415 605-6081 发一句 hi，预热 iMessage 线路。
- Chrome 开两个标签：主页、GitHub。麦克风权限允许。音量开大。
- 开场用「简洁」皮肤，最后再切到蒸汽皮肤，对比更明显。
- HW#3 是未完成（现在全部作业都是未完成）。

## 出问题怎么办

- 早报是提前做好的，一定能放。
- 手机 30 秒没回：给评委看之前收到的消息截图，继续讲。
- Gemini 报忙：跳过网页提问，直接演示周视图、截止、课程、皮肤。

## 评委可能问（简单英语，背熟）

**1. How do you decide what is urgent?**
> Eight simple rules, in order. Exams are always urgent. Anything due within 72 hours is urgent. A quiz within a week is urgent. Old classes, past items, "module available" notices and school notices are ignored. Everything else is "good to know". No black box, I can show every rule in the code.

**2. What if it ignores something important?**
> It never deletes anything. The dashboard shows every ignored item and the reason, and Brightspace is still there. The agent reduces noise, it does not hide your data.

**3. How is this different from Canvas or Google Calendar reminders?**
> They remind you about everything. Operator filters first, explains what it filtered, and you can talk back by text, voice or photo.

**4. Where does the data come from? Do you need my password?**
> No password. Brightspace gives every student a private calendar link. We only read that link. Nothing is scraped, nothing is logged in.

**5. How can another student use it?**
> Paste your own Brightspace calendar link on the Setup page. That is the whole setup. Login with SBU email for many users is the next step.

**6. What does Gemini do exactly?**
> It understands what you send: text, a voice note, a photo of a timetable. It decides what you mean: done, undo, question, add, or just chat. It answers questions about your schedule, and it writes the daily briefing. The urgency rules themselves are not AI, so they are predictable.

**7. What happens if Gemini is wrong?**
> Two safety rules. It only acts when it is confident; otherwise it asks you which item you meant. And every action is logged and can be undone in one click.

**8. Why iMessage and not an app or email?**
> Students read iMessage. Nobody opens another app. Photon gave us two-way iMessage in a few lines of code.

**9. What did ElevenLabs add?**
> The briefing and answers are spoken. ElevenLabs gives us word timestamps, so the subtitles light up as it speaks. You can also just talk to it, hands free.

**10. What was the hardest part?**
> Trust. Gemini once invented a transcript for audio it could not decode and marked a homework done. Now we convert all audio first and tell the model never to guess. Also timezones: the server was in UTC and sent a wrong "deadline moved" message.

**11. Is it running right now? How is it hosted?**
> Yes, live at myoperator.club on a Vultr server, HTTPS, checking my real Brightspace every ten minutes. The code is public on GitHub, with tests for the rules.

**12. What would you do with more time?**
> Login for many users, Gemini explaining its reasoning inside the message, and reading instructor announcements from Brightspace emails, which the calendar feed does not include.

**13. How does this fit "Steel and Steam"?**
> The telegraph operator. In the steam age, one person listened to every line and only ran to find you when a wire mattered. That is exactly what this agent does. The steam skin is the visual nod.

**14. Did you use AI to build it?**
> Yes, we used Claude for coding and Gemini inside the product. The design decisions, the rules, and the testing on real data are ours.

**答不上来时**
> Good question. We did not get to that this weekend, but here is how I would do it: ...
