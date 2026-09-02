const { getProfile, getBodyRecords, getCheckins, getAllCheckins, addBodyRecord, addCheckin, today, saveProfile } = require('../../utils/store')
const cloud = require('../../utils/cloud')

const TYPE_META = {
  breakfast: { label: '早餐', icon: '🥚' },
  lunch: { label: '午餐', icon: '🥪' },
  dinner: { label: '晚餐', icon: '🍲' }
}
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

const METHODS = [
  { name: '16:8 间歇性断食', desc: '把每日进食窗口控制在 8 小时内，其余 16 小时只喝白水或无糖饮品，让身体有更多时间消耗储备。' },
  { name: '低碳水饮食', desc: '减少精制米面与添加糖，增加蔬菜和优质蛋白，帮助稳定血糖、降低饥饿感。' },
  { name: '韩女减肥法', desc: '以高蛋白 + 大量蔬菜 + 少量碳水为主，烹饪清淡少油，配合规律有氧，强调可长期坚持。' },
  { name: '血型减肥法', desc: '按 ABO 血型建议饮食倾向（如 O 型偏高蛋白、A 型偏植物性），参考即可，不替代专业建议。' }
]
const SPORTS = [
  { name: '快走', desc: '每天 30–45 分钟快走，门槛低、易坚持，是减脂入门的好选择。' },
  { name: '跳绳', desc: '高效燃脂，约 10 分钟接近 30 分钟慢跑；膝盖不适时请减量或换项目。' },
  { name: '游泳', desc: '全身低冲击运动，在保护关节的同时提升心肺耐力。' },
  { name: '瑜伽', desc: '改善体态与睡眠，配合饮食更容易长期维持理想状态。' }
]

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
    meals: [], sport: null, treatWeekCount: 0,
    methods: METHODS, sports: SPORTS, myShare: '',
    tipsOpen: false, tipTab: '', tipList: [], tipContent: ''
  },
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
      changeText = diff > 0 ? `+${diff}` : `${diff}`
    }
    const continuous = computeStreak(getAllCheckins())
    const checkins = getCheckins()
    const meals = MEAL_TYPES.map(type => {
      const c = checkins.find(x => x.type === type)
      return { type, label: TYPE_META[type].label, icon: TYPE_META[type].icon, done: !!c, status: c ? '已完成' : '未完成' }
    })
    const sportCheckin = checkins.find(x => x.type === 'sport')
    const sport = sportCheckin ? { text: sportCheckin.note || '已记录' } : null
    const weekStart = weekStartStr()
    const treatWeekCount = getAllCheckins().filter(c => c.type === 'treat' && c.date >= weekStart).length
    this.setData({
      greeting: greeting(), nickname: profile.nickname || '轻减小伙伴',
      today: today(), profile, current, target: profile.targetWeight,
      startWeight: profile.startWeight, progress: pct,
      changeArrow, changeText, changeClass,
      continuousDays: continuous, meals, sport, treatWeekCount, myShare: profile.myShare || ''
    })
    this.loadCloud()
  },
  record(e) {
    wx.switchTab({ url: '/pages/record/record' })
    setTimeout(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page && page.setData) page.setData({ activeType: e.currentTarget.dataset.type })
    }, 300)
  },
  openTip(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'share') {
      this.setData({ tipsOpen: true, tipTab: 'share', tipContent: this.data.myShare })
    } else {
      this.setData({ tipsOpen: true, tipTab: tab, tipList: tab === 'methods' ? this.data.methods : this.data.sports })
    }
  },
  editShare(e) { this.setData({ tipContent: e.detail.value }) },
  saveShare() {
    saveProfile({ myShare: this.data.tipContent })
    this.setData({ tipsOpen: false })
    wx.showToast({ title: '已保存', icon: 'success' })
  },
  closeTip() { this.setData({ tipsOpen: false }) },
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
  }
})
