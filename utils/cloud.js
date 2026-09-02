// 微信云开发环境 ID（在微信开发者工具「云开发」面板顶部复制）
const ENV_ID = 'cloud1-d1g0on3869c3170d5'

let _inited = false
let _openid = ''

const enabled = () => Boolean(ENV_ID && wx.cloud && wx.cloud.database)

// 初始化云环境（幂等，多次调用只生效一次）
function init() {
  if (!enabled()) {
    console.warn('[cloud] 未启用云端（wx.cloud 不可用），将使用本地模式')
    return false
  }
  if (!_inited) {
    wx.cloud.init({ env: ENV_ID, traceUser: true })
    _inited = true
  }
  return true
}

// 获取当前用户 openid（用于数据/图片按用户隔离），结果缓存
async function getOpenid(force = false) {
  if (_openid && !force) return _openid
  if (!enabled()) return ''
  try {
    const res = await wx.cloud.callFunction({ name: 'slim-login' })
    _openid = (res.result && res.result.openid) || ''
  } catch (e) {
    console.warn('[cloud] 获取 openid 失败，图片将以 anon 隔离', e)
  }
  return _openid
}

// 上传图片到云存储，路径按用户隔离：checkins/{openid}/{date}_{ts}_{idx}.jpg
async function uploadImages(paths = [], openid = '') {
  if (!enabled() || !paths.length) return paths
  const uid = openid || await getOpenid() || 'anon'
  const date = new Date().toISOString().slice(0, 10)
  const results = await Promise.all(paths.map((filePath, index) =>
    wx.cloud.uploadFile({
      cloudPath: `checkins/${uid}/${date}_${Date.now()}_${index}.jpg`,
      filePath
    })
  ))
  return results.map(item => item.fileID)
}

function getDb() { return enabled() ? wx.cloud.database() : null }

// 打卡记录同步到云端（集合 checkins，权限按 _openid 隔离）
async function syncCheckin(checkin) {
  const db = getDb()
  if (!db) return { synced: false }
  try {
    await db.collection('checkins').add({ data: checkin })
    return { synced: true }
  } catch (e) {
    console.warn('[cloud] 同步打卡失败', e)
    return { synced: false, error: e }
  }
}

// 身体数据同步到云端（集合 body_records）
async function syncBodyRecord(record) {
  const db = getDb()
  if (!db) return { synced: false }
  try {
    await db.collection('body_records').add({ data: record })
    return { synced: true }
  } catch (e) {
    console.warn('[cloud] 同步身体数据失败', e)
    return { synced: false, error: e }
  }
}

module.exports = { ENV_ID, enabled, init, getOpenid, uploadImages, getDb, syncCheckin, syncBodyRecord }
