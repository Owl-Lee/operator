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
| **发电报** | `EST 393 · HW#3 moved: Thu, Oct 29, 11:59 PM → Mon, Oct 26, 11:59 PM.` 通过 iMessage 送达，外加截止前 24 小时 / 3 小时 / 1 小时三次提醒。 |
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

整条链路可以拆成五段：**拿数据 → 判轻重 → 发电报 → 听回复 → 出声音**。下面按顺序讲。

### 1. 拿数据：Brightspace 的日历源

Brightspace 给每个学生一个私有的 iCal 订阅链接，里面是你所有课程的作业、讨论、测验、考试，每条带标题、所属课程、精确的截止时间和稳定的 `UID`。Operator 不碰 Brightspace 的登录和页面，只读这个链接，所以不需要你的密码，也不会被改版影响。

`src/agent.ts` 每 10 分钟调一次 `runPoll()`（`src/poll.ts`）：

1. 下载并解析 iCal（`src/ical.ts`），把 `SUMMARY` 的后缀（`- Due` / `- Available` / `- Availability Ends`）翻译成类型，从 `LOCATION` 里取出课程名和学期。
2. 和上一次的快照 `data/snapshot.json` 逐条比对（`src/diff.ts`）：新增的、截止时间被挪动的、消失的。老师悄悄把作业从周四改到周一，这一步就能抓到。
3. 保存新快照，把这次检查写进 agent 日志，网页上「Agent 做了什么」那一栏就是读这个日志。

Brightspace 自己对这个链接有几分钟缓存，所以老师改完到你收到电报，一般在 15 到 20 分钟内。

### 2. 判轻重：规则化的分诊

`src/triage.ts` 给每一条打一个等级，规则故意写得简单、能解释：

| 顺序 | 条件 | 结果 |
|---|---|---|
| 1 | 不是课程条目（校园通知、系统公告） | 忽略 |
| 2 | 属于 Summer / Spring 等旧学期 | 忽略 |
| 3 | 截止时间已经过了 | 忽略 |
| 4 | 不是「截止」类（只是「开放」提示） | 忽略 |
| 5 | 是考试 | **紧急** |
| 6 | 72 小时内截止 | **紧急** |
| 7 | 一周内的测验 | **紧急** |
| 8 | 其余有截止时间的 | 需知 |

真实数据里 94 条有 83 条落在前四条规则里。这些条目仍然在网页的「没打扰你的」卡片里能展开看到，并标明被过滤的原因，但永远不会推送到手机。变更电报也只针对没被过滤的条目：旧学期的作业时间变了，只记日志，不发消息。

### 3. 发电报：iMessage 与三段提醒

`src/photon.ts` 用 Photon 的 Spectrum SDK 通过 iMessage 收发。发出去的消息统一是电报体（`src/telegram.ts`）：大写、短句、以 `STOP.` 分隔，例如

```
EST 393 · HW#3 moved: Thu, Oct 29, 11:59 PM → Mon, Oct 26, 11:59 PM.
```

三种情况会发：

- **变更电报**：比对发现没被过滤的条目新增或被挪动。
- **提醒电报**：`agent.ts` 每分钟扫一遍，对每个未完成的截止在前 24 小时、3 小时、1 小时各发一次。发过的记在 `data` 里，重启不会重复发。
- **你主动要的**：比如在手机上说「早报」，会收到一条语音消息。

标为完成的条目（手机上回一句「交了」，或网页上点勾）不再提醒。

### 4. 听回复：手机端的大脑

你给 Operator 发的每一条 iMessage 都进 `src/brain.ts`，不管是文字、语音还是照片，都是**一次** Gemini 调用。提示词里带着当前时间、所有未完成的截止（含 id）和未来两周的完整日程，让 Gemini 返回一个 JSON，里面有意图和回复：

| 意图 | 例子 | 动作 |
|---|---|---|
| `done` / `undo` | 「HW3 交了」「刚才标错了」 | 置信度 ≥ 0.75 才标记，否则转为追问 |
| `clarify` | 「作业写完了」但有两个候选 | 列出候选让你选 |
| `question` | 「周一有什么课」「这周先做哪个」 | 直接按日程回答，考试和 72 小时内的优先说 |
| `add` | 「周日下午两点和 Jennifer 老师在 ESS 102 开会」 | 写进 `schedule.json`，同时存中英文两份标题 |
| `chat` | 「你是谁」 | 一句话回复 |

几个细节：

- **语音**先用 ffmpeg 把 iMessage 的 CAF 转成 MP3 再给 Gemini，提示词明确要求「听不清就说听不清，绝不猜」。早期版本直接喂原始音频，Gemini 编造了一段转写并把作业标成了完成，这是血的教训。
- **照片**（课表截图、海报、邮件截图）走同一条路，Gemini 先描述看到了什么，再按「记录」处理。
- 回复里会先附上它听到或看到的内容，你能核对它有没有听错。
- 每条消息只调一次 Gemini，是为了留在免费配额里；模型按 `gemini-3.8-flash → 3.5 → 3.7 → flash-latest` 自动降级，限流两次就停下来告诉你「线路繁忙」，而不是无限重试。

网页抽屉里的输入走的是同一套逻辑：能提取出日程条目就记录，提取不出来就当成问题回答。

### 5. 出声音：ElevenLabs

`src/voice.ts` 负责所有语音输出：

- **简报**：Gemini 根据当前时段和日程写 3 到 5 句话，ElevenLabs 配音。用的是带时间戳的接口，返回每个字的起止时间，网页字幕才能读到哪亮到哪。
- **预生成**：简报是提前做好缓存的，服务启动、每次轮询之后、你改动日程之后、每 20 分钟都会在后台刷新中英文各一份，所以点「今日早报」基本是秒播。
- **发到手机**：iMessage 只认自己的语音格式，MP3 会显示一个 00:00 的死播放器，所以发送前用 ffmpeg 转成 AAC。
- **语音通话**：网页用浏览器麦克风录音，靠音量检测判断「你说完了」（约一秒静音），发给后端走 `brain.ts`，回答再用 ElevenLabs 读出来，读完自动继续听。

### 存在哪、没有什么

- 所有状态都是本地 JSON：`data/snapshot.json`（上次日历）、`data/agent-log.json`（agent 做过的每件事）、`data/done.json`（已完成）、`schedule.json`（课程、会议、活动）。没有数据库，没有账号系统。
- 密钥只在 `.env`，网页不显示、也不会传给前端。
- 任何一个外部服务缺失都只是少一块功能：没有 Gemini 就退回规则解析，没有 Photon 就只写日志，没有 ElevenLabs 就隐藏语音按钮。
- 时间统一按纽约时区处理，进程启动时在代码里写死 `TZ`，因为 `schedule.json` 里的时间不带时区，服务器时区不同会差 4 到 5 小时。

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
