# Operator 🚂📠

[English](README.md) · 中文

**替你盯着 Brightspace 的电报员，从此不用再登录。**

Operator 是给石溪大学（Stony Brook）学生做的 agent。它每十分钟读一次你的 Brightspace 日历源，判断哪些真的重要，只在值得打扰你的时候通过 iMessage 发一封短电报。你可以直接回它：打字、发语音、拍张课表照片，或者在网页上跟它对话。它会回答、记下你交代的事，并记住你已经做完了什么。

SBUHacks 2026（主题 Steel and Steam）36 小时作品。
线上地址：**[myoperator.club](https://myoperator.club)**

![Operator 首页，蒸汽皮肤](docs/home-steam.jpg)

## 它做什么

| | |
|---|---|
| **盯着 Brightspace** | 每 10 分钟拉一次 iCal 源，和上次快照比对，老师悄悄改了截止时间也能发现。 |
| **筛选，而不是转发** | 每一条都判定为 *紧急 / 需知 / 忽略*。真实数据里 94 条有 83 条被忽略（旧学期、已过期、开放提示）。被忽略的永远不会推给你。 |
| **发电报** | `TELEGRAM: AMENDMENT EST 393 HW#3. STOP. MOVED TO MON, OCT 26, 11:59 PM. STOP.` 通过 iMessage 送达，外加截止前 24 小时 / 3 小时 / 1 小时三次提醒。 |
| **听得懂回复** | 手机发来的文字、语音、照片，都经过一次 Gemini 调用判断意图：*完成、撤销、提问、记录、追问、闲聊*。拿得准才动手，拿不准就反问。 |
| **读给你听** | 语音简报（Gemini 写稿，ElevenLabs 配音），可以发到手机当语音消息，也可以在网页上播放，字幕读到哪亮到哪。 |
| **语音通话** | 网页上的免提模式：说完停一秒自动发送，它出声回答，然后继续听。 |
| **仪表盘** | 主页、周视图、全部截止、按课程分卡，中英双语，三套皮肤。一个输入口、一条导航，没有任何筛选器要配置。 |

## 怎么运作

```
Brightspace iCal ──► poll.ts（比对）──► triage.ts ──► store ──► server.ts ──► web/index.html
                                            │                       ▲
                                            ▼                       │
                                       photon.ts  ◄── brain.ts ◄────┘（文字 · 语音 · 照片）
                                      （iMessage）       │
                                                         ▼
                                                   gemini.ts  ·  voice.ts（ElevenLabs）
```

- **`src/poll.ts`** 拉取并解析日历源，和 `data/snapshot.json` 比对，记录变化并发出变更电报。
- **`src/triage.ts`** 是规则驱动、可解释的：考试永远紧急，72 小时内截止的紧急，一周内的测验紧急，过期的和别的学期的忽略。
- **`src/brain.ts`** 是手机端的大脑。每条消息一次 Gemini 调用，上下文里带着实时日程，返回意图和用用户语言写的回复。语音先用 ffmpeg 转码，提示词禁止它对听不清的音频采取行动。
- **`src/agent.ts`** 跑主循环：收消息、轮询、提醒，以及提前生成语音简报，点了就能放。
- **`web/index.html`** 只有一个文件：没有框架，不用构建。

## 自己跑起来

需要：Node 22 以上，ffmpeg（语音功能用）。

```bash
git clone https://github.com/Owl-Lee/operator.git
cd operator
npm install
cp .env.example .env     # 有哪个 key 填哪个，缺了会自动降级
npm run web              # 仪表盘在 http://localhost:4242
```

| 配置项 | 用途 | 去哪拿 |
|---|---|---|
| `BRIGHTSPACE_ICAL_URL` | 一切的基础 | Brightspace → 日历 → 订阅。也可以在网页的设置页里直接粘贴。 |
| `GEMINI_API_KEY` | 理解文字、照片、语音；问答 | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `IMESSAGE_PROJECT_ID` / `IMESSAGE_PROJECT_SECRET` / `MY_PHONE` | iMessage 收发电报 | [Photon](https://app.photon.codes) Spectrum 项目。共享线路要先用手机给它发一条消息。 |
| `ELEVENLABS_API_KEY` | 语音简报、朗读、语音通话 | [elevenlabs.io](https://elevenlabs.io) |

没有 Gemini：照样轮询、筛选、发电报，网页退回规则解析。没有 Photon：电报只写进日志不发送。没有 ElevenLabs：语音功能隐藏。

其他命令：`npm run poll`（轮询一次）、`npm run ping`（发测试电报）、`npm run typecheck`。

进程固定运行在纽约时区（代码里已写死 `TZ=America/New_York`），因为 `schedule.json` 里的时间不带时区。

## 目录结构

```
src/
  server.ts    HTTP 接口 + 静态仪表盘，启动 agent
  agent.ts     轮询循环 · 提醒 · 收消息 · 简报预热
  poll.ts      拉取 iCal、比对、变更电报
  triage.ts    紧急 / 需知 / 忽略 的规则
  brain.ts     手机端意图大脑（每条消息一次 Gemini 调用）
  gemini.ts    Gemini REST 客户端，带模型降级
  photon.ts    iMessage 收发，ffmpeg 转码
  voice.ts     ElevenLabs 带时间戳的 TTS，简报缓存
  schedule.ts  课程 / 会议 / 活动 / 截止 的本地存储
  store.ts     快照、agent 日志、已完成列表
web/
  index.html   整个仪表盘
schedule.json  你的课程、会议、活动（标了 sample 的是占位）
data/          运行时状态（不进 git）
```

## 用到的赞助商技术

Google Gemini · Photon（iMessage）· ElevenLabs · GoDaddy Registry（域名）· Vultr（托管）

## 团队

[Owl-Lee](https://github.com/Owl-Lee)，石溪大学，2026 年 10 月。

## 许可

MIT
