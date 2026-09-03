# 微信云开发接入说明（轻减日记）

环境 ID：`cloud1-d1g0on3869c3170d5`
数据隔离方案：**客户端直写 + 按 openid 权限隔离**（已确认，最简单且够用，不串用户）。

---

## 1. 已落地的代码改动

- `utils/cloud.js`：`ENV_ID` 已填入；`cloud.init()` 幂等初始化（app.js 统一调用）。
- `utils/cloud.js`：新增 `getOpenid()`，调用 `slim-login` 云函数拿 openid 并缓存。
- `utils/cloud.js`：`uploadImages()` 路径改为按用户隔离 `checkins/{openid}/{date}_{ts}_{idx}.jpg`。
- `app.js`：移除硬编码 env，改用 `cloud.init()` 单一来源。
- 云函数 `cloud1-d1g0on3869c3170d5/slim-login`：返回调用方 openid。
- 云函数 `cloud1-d1g0on3869c3170d5/slim-init`：批量创建 7 个集合（见步骤 2）。
- 云函数 `cloud1-d1g0on3869c3170d5/slim-reminder`：每日定时触发器，向授权过订阅消息的用户推送打卡提醒（见步骤 6）。

---

## 2. 部署云函数并建集合（需在微信开发者工具里点一下）

1. 打开本项目 → 左侧「云开发」→ 确认环境 `cloud1-d1g0on3869c3170d5` 已存在。
2. 在资源管理器 `cloud1-d1g0on3869c3170d5/slim-login` 目录上 **右键 → 上传并部署（云端安装依赖）**。
3. 同样对 `cloud1-d1g0on3869c3170d5/slim-init` 右键 **上传并部署**。
4. 上传完成后，在云函数 `slim-init` 上 **右键 → 测试 / 运行一次**（或本地调试调用），触发建集合。
   - 返回 `{ ok: true, results: [...] }` 即成功；已存在的集合会标记为 `exists`，可忽略。

> 若不想用云函数，也可在「云开发 - 数据库」手动新建 7 个集合：`users` / `body_records` / `checkins` / `daily_summary` / `posters` / `diary` / `reminder_subs`。

---

## 3. 配置集合权限（关键，必做，7 次粘贴）

在「云开发 - 数据库」中逐个点开集合 → 权限设置 → 选择「自定义安全规则」→ 粘贴以下 JSON：

```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

对以下 7 个集合都设置一遍：**users / body_records / checkins / daily_summary / posters / diary / reminder_subs**。
含义：只有记录的创建者本人能读写，普通用户之间数据完全隔离。

> `reminder_subs` 由**定时推送云函数（管理员权限）**读取全部记录用于群发，集合本身仍按 openid 隔离写入，无需担心互相看到。

---

## 4. 配置云存储权限（图片隔离）

「云开发 - 存储」→ 权限设置 → 设为「仅创建者可读写」（与集合一致）。
图片路径已按 `checkins/{openid}/...` 隔离，配合此权限即可防止互相查看/覆盖。

---

## 5. 真机验收清单

- 弱网重试、断网提示、上传失败兜底（已走本地记录，云端失败不影响本地）。
- 重复提交防护、跨用户数据隔离验证、存储文件权限。
- 首次进入能拿到 openid（slim-login 云函数正常返回）。

---

## 6. 订阅消息每日推送（打卡提醒）

> 微信小程序**无法做系统级强制推送**。订阅消息是唯一的主动触达通道，且**个人主体默认只有「一次性订阅」**（用户每次授权后只能发 1 条），要每天自动推送需「长期订阅」权限（仅政务/医疗/教育/交通/金融/生活缴费等类目可申请，减脂类个人号基本拿不到）。因此本功能 = 应用内强提醒（稳定可靠）+ 订阅消息推送（尽力而为，覆盖不全）。

### 6.1 在微信公众平台创建订阅消息模板
1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → 功能 → 订阅消息 → 我的模板 → 新建。
2. 选用「事项提醒 / 日程提醒」类模板（关键词如：提醒内容、提醒时间、备注等），或选「打卡提醒」相关模板。
3. 记下生成的 **模板 ID**（形如 `xxxxxxxxxxxxxxxxxxxx`）。

### 6.2 填入模板 ID（两处需一致）
- `pages/profile/profile.js` 顶部的 `REMIND_TEMPLATE_ID = ''` → 填模板 ID（用于开启提醒时请求用户授权）。
- `cloud1-d1g0on3869c3170d5/slim-reminder/index.js` 顶部的 `TEMPLATE_ID = ''` → 填同一模板 ID。
- 并在 `index.js` 的 `data: { ... }` 中，按模板的**关键词字段名**填充内容（如 `thing1` / `time2`），否则云函数会报错。

### 6.3 部署定时推送云函数
1. 在 `cloud1-d1g0on3869c3170d5/slim-reminder` 目录右键 → **上传并部署（云端安装依赖）**。
2. 部署后右键 → 新建/查看**定时触发器**：`config.json` 已配置 `0 0 20 * * * *`（每天 20:00 触发）。如需改时间，改 `config.json` 后重新部署。
3. 运行一次测试：`index.js` 会读取 `reminder_subs` 集合，向每个授权用户发送订阅消息，返回 `{ total, sent }`。

### 6.4 数据流
- 用户在「我的」页打开「每日打卡提醒」→ `wx.requestSubscribeMessage` 弹窗授权 → 授权成功后写入 `reminder_subs`（openid + 模板 ID）。
- 每天 20:00 云函数 `slim-reminder` 遍历 `reminder_subs` 群发提醒。
- 个人号「一次性订阅」限制：每条授权当日有效，次日需用户再次开启/授权才能继续收到；这是平台限制，非代码 bug。
