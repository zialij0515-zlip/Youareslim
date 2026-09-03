const KEYS = { profile: 'slim_profile', body: 'slim_body_records', checkins: 'slim_checkins', diary: 'slim_diary' }
const today = () => new Date().toISOString().slice(0, 10)
const defaultProfile = { nickname: '轻减小伙伴', gender: 'female', age: 28, height: 165, startWeight: 62, targetWeight: 55, targetDate: '', onboardingComplete: false }
function read(key, fallback) { return wx.getStorageSync(key) || fallback }
function write(key, value) { wx.setStorageSync(key, value); return value }
function ensureProfile() { const profile = read(KEYS.profile, null); if (!profile) write(KEYS.profile, defaultProfile); return read(KEYS.profile, defaultProfile) }
function getProfile() { return ensureProfile() }
function saveProfile(patch) { return write(KEYS.profile, { ...ensureProfile(), ...patch }) }
function getBodyRecords() { return read(KEYS.body, []) }
function addBodyRecord(record) { const records = getBodyRecords().filter(item => item.date !== record.date); records.push(record); records.sort((a,b) => a.date.localeCompare(b.date)); return write(KEYS.body, records) }
function getCheckins(date = today()) { return read(KEYS.checkins, []).filter(item => item.date === date) }
function addCheckin(item) { const all = read(KEYS.checkins, []).filter(c => !(c.date === item.date && c.type === item.type)); const next = [...all, { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, createdAt: Date.now(), ...item }]; return write(KEYS.checkins, next) }
function getAllCheckins() { return read(KEYS.checkins, []) }
function getDiary() {
  return read(KEYS.diary, []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}
function upsertDiary(text) {
  const list = read(KEYS.diary, [])
  const t = today()
  const now = Date.now()
  const idx = list.findIndex(e => e.date === t)
  if (idx >= 0) {
    list[idx].text = text
    list[idx].updatedAt = now
  } else {
    list.push({ id: `${now}_${Math.random().toString(16).slice(2)}`, date: t, text, createdAt: now, updatedAt: now })
  }
  write(KEYS.diary, list)
  return getDiary()
}
// 将云端日记合并进本地（按日期去重，updatedAt 较新的一方胜出），返回合并后列表
function mergeDiary(cloudList) {
  const local = read(KEYS.diary, [])
  const map = {}
  local.forEach(d => { map[d.date] = d })
  cloudList.forEach(c => {
    const ex = map[c.date]
    if (!ex || (c.updatedAt || 0) > (ex.updatedAt || 0)) {
      map[c.date] = {
        id: c._id || c.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        date: c.date, text: c.text,
        createdAt: c.createdAt || c.updatedAt || 0,
        updatedAt: c.updatedAt || 0
      }
    }
  })
  const merged = Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  write(KEYS.diary, merged)
  return merged
}
module.exports = { today, ensureProfile, getProfile, saveProfile, getBodyRecords, addBodyRecord, getCheckins, addCheckin, getAllCheckins, getDiary, upsertDiary, mergeDiary }
