const { getProfile, getBodyRecords, getCheckins, getAllCheckins, addBodyRecord, addCheckin, today } = require('../../utils/store')
const cloud = require('../../utils/cloud')
const { labelForBmi } = require('../../utils/metrics')

const TYPE_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', sport: '运动', treat: '放纵餐' }
const TYPES = ['breakfast', 'lunch', 'dinner', 'sport', 'treat']
const CHEERS = [
  '今天还没开始，先从一杯温水起跑吧',
  '不错的开头，再记录一项试试？',
  '已经两项啦，节奏挺好',
  '过半了，稳稳的',
  '就差一点点，今天很完整',
  '全部完成，今天的你很棒'
]
const RING_R = 54
const RING_CIRC = 2 * Math.PI * RING_R

function progressPct(profile, body) {
  const start = profile.startWeight
  const target = profile.targetWeight
  const current = (body && body.weight) || start
  if (!start || !target || start === target) return 0
  return Math.max(0, Math.min(100, Math.round((start - current) / (start - target) * 100)))
}

function computeStreak(checkins) {
  const dates = new Set(checkins.map(c => c.date).filter(Boolean))
  const d = new Date()
  const todayKey = d.toISOString().slice(0, 10)
  if (!dates.has(todayKey)) d.setDate(d.getDate() - 1) // 今天还没打卡，从昨天起算，避免白天误判为 0
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10)
    if (dates.has(key)) { streak++; d.setDate(d.getDate() - 1) } else break
  }
  return streak
}

function recentChange(records) {
  if (!records || records.length < 2) return null
  const sorted = records.slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first.weight || !last.weight) return null
  return Math.round((last.weight - first.weight) * 10) / 10
}

Page({
  data: {
    profile: {}, body: {}, today: '', tasks: [], progress: 0,
    ringOffset: RING_CIRC.toFixed(1), continuousDays: 0, encouragement: '', banners: []
  },
  onShow() { this.refresh() },
  refresh() {
    const profile = getProfile()
    if (!profile.onboardingComplete) return wx.reLaunch({ url: '/pages/onboarding/onboarding' })
    const records = getBodyRecords()
    const body = records.slice(-1)[0] || {}
    const checkins = getCheckins()
    const tasks = TYPES.map(type => ({ type, label: TYPE_LABELS[type], done: checkins.some(c => c.type === type) }))
    const pct = progressPct(profile, body)
    const doneCount = tasks.filter(t => t.done).length
    const continuous = computeStreak(getAllCheckins())
    const change = recentChange(records)
    this.setData({
      profile, body, today: today(), tasks, progress: pct,
      ringOffset: (RING_CIRC * (1 - pct / 100)).toFixed(1),
      continuousDays: continuous,
      encouragement: CHEERS[Math.min(doneCount, 5)],
      banners: this.buildBanners(profile, body, pct, continuous, change, doneCount)
    })
    this.loadCloud()
  },
  buildBanners(profile, body, pct, continuous, change, doneCount) {
    const current = (body && body.weight) || profile.startWeight
    const left = Math.max(0, Math.round((current - profile.targetWeight) * 10) / 10)
    const bmiText = body && body.bmi ? body.bmi + ' · ' + labelForBmi(body.bmi) : '待记录'
    return [
      { type: 'progress', label: '目标进度', main: current + ' kg', sub: left > 0 ? '距目标还差 ' + left + ' kg · 已完成 ' + pct + '%' : '已达成目标，太棒了' },
      { type: 'trend', label: '数据趋势', main: change === null ? '继续记录' : (change > 0 ? '+' : '') + change + ' kg', sub: 'BMI ' + bmiText },
      { type: 'cheer', label: '今日鼓励', main: CHEERS[Math.min(doneCount, 5)], sub: '每天一点点，已经很了不起' },
      { type: 'achievement', label: '成就', main: '连续打卡 ' + continuous + ' 天', sub: continuous > 0 ? '保持节奏，稳稳靠近目标' : '今天打卡就能开启连胜' }
    ]
  },
  record(e) {
    wx.switchTab({ url: '/pages/record/record' })
    setTimeout(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page && page.setData) page.setData({ activeType: e.currentTarget.dataset.type })
    }, 300)
  },
  async loadCloud() {
    if (!cloud.enabled()) return
    try {
      const [cloudBody, cloudCheckins] = await Promise.all([cloud.getLatestBodyRecord(), cloud.getTodayCheckins(today())])
      let needRefresh = false
      const localBody = getBodyRecords().slice(-1)[0] || {}
      if (cloudBody && (!localBody.date || cloudBody.date > localBody.date)) {
        addBodyRecord(cloudBody); needRefresh = true
      }
      if (cloudCheckins && cloudCheckins.length) {
        const localToday = getCheckins(today())
        cloudCheckins.forEach(item => {
          if (!localToday.some(c => c.type === item.type)) { addCheckin(item); needRefresh = true }
        })
      }
      if (needRefresh) this.refresh()
    } catch (e) {
      console.warn('[home] 云端拉取失败，使用本地数据', e)
    }
  }
})
