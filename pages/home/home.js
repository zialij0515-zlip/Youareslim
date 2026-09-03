const { getProfile, getBodyRecords, getCheckins, getAllCheckins, addBodyRecord, addCheckin, today, saveProfile, getDiary, upsertDiary, mergeDiary } = require('../../utils/store')
const cloud = require('../../utils/cloud')

const TYPE_META = {
  breakfast: { label: '早餐', icon: 'toast', color: '#E8C28C' },
  lunch: { label: '午餐', icon: 'salad', color: '#7DB98C' },
  dinner: { label: '晚餐', icon: 'salad2', color: '#5E9B75' },
  sport: { label: '运动', icon: 'runner', color: '#4F8567' }
}
const GRID_TYPES = ['breakfast', 'lunch', 'dinner', 'sport']

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早安'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  return '晚安'
}

function weekStartStr() {
  const d = new Date()
  const day = d.getDay() // 0 周日 .. 6 周六
  const diff = day === 0 ? -6 : 1 - day // 以周一为一周起点
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

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
  if (!dates.has(todayKey)) d.setDate(d.getDate() - 1) // 今天还没打卡则从昨天起算，避免白天误判为 0
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10)
    if (dates.has(key)) { streak++; d.setDate(d.getDate() - 1) } else break
  }
  return streak
}

Page({
  data: {
    greeting: '', nickname: '', today: '', profile: {}, current: 0, target: 0,
    startWeight: 0, progress: 0, continuousDays: 0,
    changeArrow: '', changeText: '--', changeClass: 'empty',
    grid: [], treatWeekCount: 0,
    diaryLatest: '',
    diaryOpen: false, diaryList: [], diaryDraft: '', diaryView: null
  },
  onLoad() { this.refresh() },
  onShow() { this.refresh() },
  refresh() {
    const profile = getProfile()
    if (!profile.onboardingComplete) return wx.reLaunch({ url: '/pages/onboarding/onboarding' })
    const records = getBodyRecords()
    const body = records.slice(-1)[0] || {}
    const current = body.weight || profile.startWeight
    const pct = progressPct(profile, body)
    let changeArrow = '', changeText = '--', changeClass = 'empty'
    if (records.length >= 2) {
      const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date))
      const diff = Math.round((current - sorted[sorted.length - 2].weight) * 10) / 10
      changeArrow = diff > 0 ? '↑' : (diff < 0 ? '↓' : '→')
      changeClass = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat')
      changeText = String(Math.abs(diff))
    }
    const continuous = computeStreak(getAllCheckins())
    const checkins = getCheckins()
    const grid = GRID_TYPES.map(type => {
      const c = checkins.find(x => x.type === type)
      const meta = TYPE_META[type]
      const isSport = type === 'sport'
      return {
        type, label: meta.label, icon: meta.icon, color: meta.color,
        done: !!c,
        sub: isSport
          ? (c ? (c.sportItems && c.sportItems.filter(i => i.selected).length ? `${c.sportItems.filter(i => i.selected).length}项运动` : '已完成') : '未完成')
          : (c ? '已完成' : '未完成'),
        showCheck: !!c
      }
    })
    const weekStart = weekStartStr()
    const treatWeekCount = getAllCheckins().filter(c => c.type === 'treat' && c.date >= weekStart).length
    const diary = getDiary()
    const diaryLatest = diary[0] ? diary[0].text : ''
    this.setData({
      greeting: greeting(), nickname: profile.nickname || '轻减小伙伴',
      today: today(), profile, current, target: profile.targetWeight,
      startWeight: profile.startWeight, progress: pct,
      changeArrow, changeText, changeClass,
      continuousDays: continuous, grid, treatWeekCount, diaryLatest
    })
    this.loadCloud()
  },
  record(e) {
    const type = e.currentTarget.dataset.type
    wx.switchTab({ url: '/pages/record/record' })
    setTimeout(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page && page.setData) page.setData({ activeType: type })
      if (page && page.loadType) page.loadType(type)
    }, 300)
  },
  openTip(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'diary') {
      this.openDiary()
    } else {
      wx.navigateTo({ url: `/pages/tipsList/tipsList?type=${tab}` })
    }
  },
  openDiary() {
    const list = getDiary().map(d => ({ ...d, preview: d.text.length > 20 ? d.text.slice(0, 20) + '…' : d.text }))
    const todayEntry = list.find(d => d.date === today())
    this.setData({ diaryOpen: true, diaryList: list, diaryDraft: todayEntry ? todayEntry.text : '', diaryView: null })
  },
  onDiaryInput(e) { this.setData({ diaryDraft: e.detail.value }) },
  saveDiary() {
    const text = (this.data.diaryDraft || '').trim()
    if (!text) { wx.showToast({ title: '写点什么吧～', icon: 'none' }); return }
    const savedList = upsertDiary(text)
    const list = savedList.map(d => ({ ...d, preview: d.text.length > 20 ? d.text.slice(0, 20) + '…' : d.text }))
    this.setData({ diaryList: list, diaryDraft: '', diaryOpen: false })
    wx.showToast({ title: '已保存', icon: 'success' })
    // 同步到云端（按 openid 隔离）
    const todayEntry = savedList.find(d => d.date === today())
    if (cloud.enabled() && todayEntry) cloud.syncDiary(todayEntry)
  },
  viewDiary(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.diaryList.find(d => d.id === id)
    if (item) this.setData({ diaryView: item })
  },
  closeDiaryView() { this.setData({ diaryView: null }) },
  closeDiary() { this.setData({ diaryOpen: false }) },
  noop() {},
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
    // 日记：拉取云端合并到本地，并把本地独有的补推到云端
    try {
      const cloudDiary = await cloud.getCloudDiary()
      if (cloudDiary && cloudDiary.length) {
        const local = getDiary()
        mergeDiary(cloudDiary)
        const cloudDates = new Set(cloudDiary.map(c => c.date))
        for (const d of local) {
          if (!cloudDates.has(d.date)) { await cloud.syncDiary(d) }
        }
        this.refresh()
      }
    } catch (e) {
      console.warn('[home] 云端日记同步失败，使用本地数据', e)
    }
  }
})
