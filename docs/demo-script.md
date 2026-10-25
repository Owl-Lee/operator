# Operator · 3 分钟评委演示稿

英文是照着念的台词，括号里是你手上的动作。总时长 2 分 50 秒左右，留 10 秒缓冲。

---

## 0:00–0:30 开场：真实的故事（主页，蒸汽皮肤，先别动）

> Hi, I'm Lee. A few weeks ago I got a zero on an assignment. Not because I didn't do it — I never saw it. It was sitting in Brightspace, the platform every Stony Brook class runs on, buried between old-semester posts, "module now available" notices and campus announcements. I counted my feed this week: 94 items. Eleven of them actually mattered.
>
> So I built Operator: the telegraph operator who listens to every line for you, and only taps you on the shoulder when something is worth it.

（说到 "taps you on the shoulder" 时指一下右边的「下一个截止」倒计时卡）

## 0:30–0:55 过滤是产品（「没打扰你的」卡片）

> It reads my Brightspace calendar every ten minutes and triages every item: urgent, need-to-know, or ignore. Eighty-three of ninety-four were ignored — and it shows me why.

（点「Old course」展开，滚两下，再点「Already past」）

> Old semester, already past, campus notices. None of this ever reaches my phone. The two urgent ones did.

## 0:55–1:35 手机闭环（举起手机，或者提前投屏）

> Here's what reaching me looks like. When a professor moved a deadline, I got one plain line — not a notification dump. Before anything is due I get a 24-hour, a 3-hour and a 1-hour nudge. And I can just talk back.

（手机发语音：「我刚交了 EST 393 的 HW#3」→ 等它回 → 切回网页，截止列表里 HW#3 变灰打勾）

> One voice note, one Gemini call: it figured out which assignment I meant, marked it done, and the reminders for it stopped. If it isn't sure which one, it asks instead of guessing — that's the rule everywhere in this project.

## 1:35–2:10 网页上的同一个大脑（点右下 Agent → 语音通话）

> Same brain on the dashboard.

（说："What do I have on Tuesday, and is anything urgent?" → 让它说完，字幕一个词一个词亮）

> ElevenLabs reads it back with live subtitles. And it understands anything that has a time in it —

（拖课表截图进页面 → 课进日程 → 点一个「撤销」）

> — a timetable screenshot, an email, a poster, a sentence in Chinese. Four classes in, one click to undo.

## 2:10–2:35 早报与周视图

（点导航栏「Morning telegram」，念 5 秒就按停）

> Every morning it writes and reads me a briefing of my day. And here's the week —

（切「Week」页）

> — classes, meetings, events and deadlines in one place, English or Chinese, nothing to configure.

（点一下「中」再切回「EN」）

## 2:35–2:50 收尾

> It's live at myoperator.club, open source on GitHub, built with Gemini, Photon for iMessage, ElevenLabs, a GoDaddy domain and Vultr. Filtering is the product: the value is in what it decides not to say. I haven't opened Brightspace in two days. Thanks.

---

## 演示前 10 分钟

- 手机给 +1 415 605-6081 发一句 hi，把 iMessage 线路预热。
- 笔记本：Chrome 开好两个标签（主页、GitHub），麦克风权限已允许，音量开大。
- 确认 HW#3 是未完成状态（现在所有作业都是未完成）。
- 准备好一张课表截图放在桌面，方便拖。

## 兜底

- 早报是缓存好的，网络再差也能放。
- 手机语音如果 30 秒没回，别等：切到之前收到消息的截图，口头说明，继续往下。
- Gemini 如果报「忙」，网页提问改成读之前的回答截图；过滤卡片和周视图不依赖任何外部服务。

## 评委可能问

- **怎么判断紧急？** 八条有顺序的规则，全部可解释：考试永远紧急；72 小时内到期紧急；一周内的测验紧急；旧学期、已过期、开放提示、校园通知忽略。没有黑盒。
- **别人怎么用？** 设置页粘贴自己的 Brightspace 日历链接，其余自动。多用户登录是下一步。
- **和 Canvas / Google 日历提醒有什么区别？** 它们提醒一切。Operator 先过滤、解释过滤了什么，而且能用文字、语音、照片双向对话。
- **为什么是 iMessage？** 学生真正会看的地方；Photon 让这件事只用十几行代码。
