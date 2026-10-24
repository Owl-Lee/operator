# 接入教程：Gemini 和 Photon

所有密钥只填在 `E:\Code\Projects\brass-telegraph\.env` 里（这个文件不进 git）。填完**重启** `npm run web` 才生效。

---

## 一、Gemini（免费）

1. 打开 https://aistudio.google.com/apikey ，用 Google 账号登录（学校账号被限制的话用个人 Gmail）。
2. 点 **Create API key** → 选一个项目（没有就让它新建）→ 复制生成的 key（`AIza…` 开头）。
3. 打开 `.env`，填：
   ```
   GEMINI_API_KEY=AIza你复制的那串
   ```
4. 重启：在项目文件夹里 `Ctrl+C` 停掉 `npm run web`，再跑一次 `npm run web`。
5. 验证：打开 http://localhost:4242 → 右上角 ⚙ 设置 → 「Gemini（判断与问答）」应显示 **就绪**；右下角 Agent 抽屉副标题变成「Gemini 读文字和图片」。
6. 试一下：把课表截图粘进 Agent 抽屉发送，应该直接解析出每门课的时间。

> 免费层够用，不绑卡。想换模型在 `.env` 加 `GEMINI_MODEL=…`，默认是 `gemini-3.8-flash`。

---

## 二、Photon（iMessage）

1. 打开 https://app.photon.codes ，注册登录。
2. **New project** → 平台选 **iMessage/RCS** → Create project。（你之前已经建到这一步，项目名 yanbao）
3. 进项目 → **Settings** → 复制 **PROJECT_ID** 和 **SECRET_KEY**。
4. 打开 `.env`，填三项：
   ```
   IMESSAGE_PROJECT_ID=你的 PROJECT_ID
   IMESSAGE_PROJECT_SECRET=你的 SECRET_KEY
   MY_PHONE=+1你的美国手机号（11 位，例如 +16315551234）
   ```
5. 发第一条测试消息：
   ```
   npm run ping
   ```
   手机应收到：`TELEGRAM: BRASS TELEGRAPH ONLINE. STOP. THE LINE IS OPEN. STOP.`
6. 重启 `npm run web`，设置页「iMessage（Photon）」应显示 **就绪**。之后 `npm run poll` 发现截止时间变动会自动发电报到手机。

> 免费版用共享号码池，发件号码可能每次不同，正常。手机必须是 iPhone 且开着 iMessage（或 Android 开 RCS）。
> 第一条可能进「未知发件人」，去信息里看一下。

---

## 三、卡住了

- `npm run ping` 报错：把完整报错贴给我。常见是 ID/Secret 复制时多了空格，或手机号没加 `+1`。
- Gemini 报 `403/400`：key 复制不全，或 AI Studio 里项目没启用 API，重新 Create 一个。
- Photon 卡住：直接去黑客松现场 Photon 赞助商摊位问，他们会帮你看。
