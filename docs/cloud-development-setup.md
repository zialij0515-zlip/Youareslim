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
- 云函数 `cloud1-d1g0on3869c3170d5/slim-init`：批量创建 6 个集合（见步骤 2）。

---

## 2. 部署云函数并建集合（需在微信开发者工具里点一下）

1. 打开本项目 → 左侧「云开发」→ 确认环境 `cloud1-d1g0on3869c3170d5` 已存在。
2. 在资源管理器 `cloud1-d1g0on3869c3170d5/slim-login` 目录上 **右键 → 上传并部署（云端安装依赖）**。
3. 同样对 `cloud1-d1g0on3869c3170d5/slim-init` 右键 **上传并部署**。
4. 上传完成后，在云函数 `slim-init` 上 **右键 → 测试 / 运行一次**（或本地调试调用），触发建集合。
   - 返回 `{ ok: true, results: [...] }` 即成功；已存在的集合会标记为 `exists`，可忽略。

> 若不想用云函数，也可在「云开发 - 数据库」手动新建 6 个集合：`users` / `body_records` / `checkins` / `daily_summary` / `posters` / `diary`。

---

## 3. 配置集合权限（关键，必做，6 次粘贴）

在「云开发 - 数据库」中逐个点开集合 → 权限设置 → 选择「自定义安全规则」→ 粘贴以下 JSON：

```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

对以下 6 个集合都设置一遍：**users / body_records / checkins / daily_summary / posters / diary**。
含义：只有记录的创建者本人能读写，普通用户之间数据完全隔离。

---

## 4. 配置云存储权限（图片隔离）

「云开发 - 存储」→ 权限设置 → 设为「仅创建者可读写」（与集合一致）。
图片路径已按 `checkins/{openid}/...` 隔离，配合此权限即可防止互相查看/覆盖。

---

## 5. 真机验收清单

- 弱网重试、断网提示、上传失败兜底（已走本地记录，云端失败不影响本地）。
- 重复提交防护、跨用户数据隔离验证、存储文件权限。
- 首次进入能拿到 openid（slim-login 云函数正常返回）。
