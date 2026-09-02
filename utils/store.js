const KEYS = { profile: 'slim_profile', body: 'slim_body_records', checkins: 'slim_checkins' }
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
function addCheckin(item) { const all = read(KEYS.checkins, []); const next = [...all, { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, createdAt: Date.now(), ...item }]; return write(KEYS.checkins, next) }
function getAllCheckins() { return read(KEYS.checkins, []) }
module.exports = { today, ensureProfile, getProfile, saveProfile, getBodyRecords, addBodyRecord, getCheckins, addCheckin, getAllCheckins }
