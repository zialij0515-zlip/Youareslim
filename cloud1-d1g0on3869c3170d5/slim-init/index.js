const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 需要创建的 6 个集合（权限在控制台按 openid 隔离设置，见 docs/cloud-development-setup.md）
const COLLECTIONS = ['users', 'body_records', 'checkins', 'daily_summary', 'posters', 'diary']

// 部署后在开发者工具「云开发 - 云函数」右键运行一次即可批量建集合
exports.main = async (event, context) => {
  const results = []
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (e) {
      // 已存在会抛错，视为已就绪
      results.push({ name, status: 'exists', message: (e && e.message) || String(e) })
    }
  }
  return { ok: true, env: cloud.DYNAMIC_CURRENT_ENV, results }
}
