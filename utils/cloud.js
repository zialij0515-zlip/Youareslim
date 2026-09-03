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

// 建档信息同步到云端（集合 users，按 openid 作为文档 id，幂等覆盖）
async function syncProfile(profile) {
  const db = getDb()
  if (!db) return { synced: false }
  try {
    const openid = await getOpenid()
    if (!openid) return { synced: false }
    await db.collection('users').doc(openid).set({ data: { ...profile, openid, updatedAt: Date.now() } })
    return { synced: true }
  } catch (e) {
    console.warn('[cloud] 同步档案失败', e)
    return { synced: false, error: e }
  }
}

// 拉取云端最新一条身体记录（本地缺失时用于跨设备恢复），失败返回 null
async function getLatestBodyRecord() {
  const db = getDb()
  if (!db) return null
  try {
    const res = await db.collection('body_records').get()
    const list = (res.data || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1))
    return list[0] || null
  } catch (e) {
    console.warn('[cloud] 读取身体记录失败', e)
    return null
  }
}

// 拉取云端当日打卡（本地缺失时用于跨设备恢复），失败返回空数组
async function getTodayCheckins(date) {
  const db = getDb()
  if (!db) return []
  try {
    const res = await db.collection('checkins').get()
    return (res.data || []).filter(c => c.date === date)
  } catch (e) {
    console.warn('[cloud] 读取打卡失败', e)
    return []
  }
}

// 日记同步到云端（集合 diary，权限按 _openid 隔离）
async function syncDiary(entry) {
  const db = getDb()
  if (!db) return { synced: false }
  try {
    await db.collection('diary').add({
      data: {
        date: entry.date,
        text: entry.text,
        createdAt: entry.createdAt || entry.updatedAt || Date.now(),
        updatedAt: entry.updatedAt || Date.now()
      }
    })
    return { synced: true }
  } catch (e) {
    console.warn('[cloud] 同步日记失败', e)
    return { synced: false, error: e }
  }
}

// 拉取云端全部日记（按 openid 隔离，仅返回当前用户），失败返回空数组
async function getCloudDiary() {
  const db = getDb()
  if (!db) return []
  try {
    const res = await db.collection('diary').get()
    return (res.data || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  } catch (e) {
    console.warn('[cloud] 读取日记失败', e)
    return []
  }
}

module.exports = { ENV_ID, enabled, init, getOpenid, uploadImages, getDb, syncCheckin, syncBodyRecord, syncProfile, getLatestBodyRecord, getTodayCheckins, syncDiary, getCloudDiary }
