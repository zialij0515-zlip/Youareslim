const { getProfile, getBodyRecords, getAllCheckins } = require('../../utils/store')
const { labelForBmi, labelForBodyFat } = require('../../utils/metrics')

// ===== 预览用假数据开关：true 时数据页展示编造数据，便于看 UI 效果；正式使用时改回 false =====
const USE_FAKE_DATA = true
const FAKE_RECORDS = (() => {
  const arr = []
  for (let i = 0; i < 10; i++) {
    const mm = String(9).padStart(2, '0')
    const dd = String(2 + i).padStart(2, '0')
    const date = `2026-${mm}-${dd}`
    const weight = 60 - i
    const bmi = Number((18.5 + Math.random() * 9.5).toFixed(1)) // 18.5~28.0 随机
    arr.push({ date, weight, bmi })
  }
  return arr
})()
function sourceRecords() {
  return USE_FAKE_DATA ? FAKE_RECORDS : getBodyRecords()
}

const RANGES = {
  week: { key: 'week', name: '近7天', days: 7 },
  month: { key: 'month', name: '近30天', days: 30 },
  all: { key: 'all', name: '全部', days: Infinity }
}
const METRICS = {
  weight: { key: 'weight', name: '体重', unit: 'kg', color: '#4F8567', get: r => Number(r.weight) },
  bmi: { key: 'bmi', name: 'BMI', unit: '', color: '#E6A774', get: r => Number(r.bmi) },
  bodyFat: { key: 'bodyFat', name: '体脂率', unit: '%', color: '#7BA3C9', get: r => Number(r.bodyFat) }
}

function filterByRange(records, days) {
  if (!records.length) return []
  if (!Number.isFinite(days)) return records
  const last = records[records.length - 1].date
  const cutoff = new Date(last)
  cutoff.setDate(cutoff.getDate() - (days - 1))
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return records.filter(r => r.date >= cutoffStr)
}

function dpr() {
  try { return wx.getSystemInfoSync().pixelRatio || 2 } catch (e) { return 2 }
}

Page({
  data: {
    profile: {}, latest: {}, records: [],
    rangeKey: 'week', rangeOptions: Object.values(RANGES),
    metricKey: 'weight', metricOptions: Object.values(METRICS),
    hasData: false,
    bmiSections: [
      { key: 'low', name: '偏低', range: '<18.5', active: false },
      { key: 'normal', name: '正常', range: '18.5~23.9', active: false },
      { key: 'overweight', name: '超重', range: '24.0~27.9', active: false },
      { key: 'obese', name: '肥胖', range: '≥28.0', active: false }
    ],
    bmiPointerLeft: 0,
    bmiAdvice: '先记录一次体重，就能从这里看到属于你的 BMI 趋势。'
  },
  onShow() {
    const profile = getProfile()
    const all = sourceRecords()
    const latest = all[all.length - 1] || {}
    const bmiLabel = labelForBmi(latest.bmi)
    const bodyFatLabel = labelForBodyFat(latest.bodyFat, profile.gender)
    const scale = this.buildBmiScale(latest.bmi)
    this.setData({ profile, latest, bmiLabel, bodyFatLabel, bmiSections: scale.sections, bmiPointerLeft: scale.pointerLeft, bmiAdvice: scale.advice }, () => this.refreshChart())
  },
  changeRange(e) { this.setData({ rangeKey: e.currentTarget.dataset.key }, () => this.refreshChart()) },
  changeMetric(e) { this.setData({ metricKey: e.currentTarget.dataset.key }, () => this.refreshChart()) },
  goBmiGuide() { wx.navigateTo({ url: '/pages/bmiGuide/bmiGuide' }) },
  buildBmiScale(bmiValue) {
    const sections = [
      { key: 'low', name: '偏低', range: '<18.5', min: 0, max: 18.5 },
      { key: 'normal', name: '正常', range: '18.5~23.9', min: 18.5, max: 24 },
      { key: 'overweight', name: '超重', range: '24.0~27.9', min: 24, max: 28 },
      { key: 'obese', name: '肥胖', range: '≥28.0', min: 28, max: 35 }
    ]
    const adviceMap = {
      low: '你的 BMI 偏低，注意均衡营养，保持健康体重哦！',
      normal: '你的 BMI 处于正常范围，继续保持良好的生活习惯哦！',
      overweight: '你的 BMI 处于超重范围，适当调整饮食和运动会更棒！',
      obese: '你的 BMI 处于肥胖范围，建议循序渐进地改善饮食和运动。'
    }
    const v = Number(bmiValue)
    let activeKey = ''
    let pointerLeft = 0
    if (!Number.isFinite(v)) {
      return { sections: sections.map(s => ({ ...s, active: false })), pointerLeft: 0, advice: '先记录一次体重，就能从这里看到属于你的 BMI 趋势。' }
    }
    sections.forEach((s, i) => {
      const active = i === sections.length - 1 ? v >= s.min : (v >= s.min && v < s.max)
      s.active = active
      if (active && !activeKey) activeKey = s.key
    })
    if (v < 18.5) {
      pointerLeft = Math.max(0, Math.min(25, (v / 18.5) * 25))
    } else if (v < 24) {
      pointerLeft = 25 + ((v - 18.5) / (24 - 18.5)) * 25
    } else if (v < 28) {
      pointerLeft = 50 + ((v - 24) / (28 - 24)) * 25
    } else {
      pointerLeft = Math.min(100, 75 + ((v - 28) / (35 - 28)) * 25)
    }
    return { sections, pointerLeft, advice: adviceMap[activeKey] || '持续记录，了解自己的身体变化。' }
  },
  refreshChart() {
    const metric = METRICS[this.data.metricKey]
    const range = RANGES[this.data.rangeKey]
    const records = filterByRange(sourceRecords(), range.days).filter(r => Number.isFinite(metric.get(r)))
    this.setData({ records, hasData: records.length > 0 }, () => this.drawChart(metric, records))
  },
  drawChart(metric, records) {
    if (!records.length) return
    wx.createSelectorQuery().in(this).select('#chart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const ratio = dpr()
      const W = res[0].width, H = res[0].height
      canvas.width = W * ratio
      canvas.height = H * ratio
      ctx.scale(ratio, ratio)
      ctx.clearRect(0, 0, W, H)

      const padL = 46, padR = 20, padT = 22, padB = 40
      const cw = W - padL - padR, ch = H - padT - padB
      const vals = records.map(metric.get)
      const rawMin = Math.min(...vals), rawMax = Math.max(...vals)
      const pad = (rawMax - rawMin) * 0.18 || 1
      const lo = rawMin - pad, hi = rawMax + pad, span = hi - lo || 1
      const xOf = i => padL + (records.length === 1 ? cw / 2 : (i / (records.length - 1)) * cw)
      const yOf = v => padT + ch - ((v - lo) / span) * ch

      // 横向网格 + y 轴标签
      ctx.lineWidth = 1
      ctx.strokeStyle = '#EDF1EC'
      ctx.fillStyle = '#9AA79F'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const ticks = 3
      for (let t = 0; t <= ticks; t++) {
        const v = lo + (span * t) / ticks
        const y = yOf(v)
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
        ctx.fillText(v.toFixed(1), padL - 6, y)
      }

      // 区域填充
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ch)
      grad.addColorStop(0, metric.color + '33')
      grad.addColorStop(1, metric.color + '05')
      ctx.beginPath()
      ctx.moveTo(xOf(0), yOf(vals[0]))
      records.forEach((r, i) => ctx.lineTo(xOf(i), yOf(metric.get(r))))
      ctx.lineTo(xOf(records.length - 1), padT + ch)
      ctx.lineTo(xOf(0), padT + ch)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // 折线
      ctx.beginPath()
      ctx.moveTo(xOf(0), yOf(metric.get(records[0])))
      records.forEach((r, i) => ctx.lineTo(xOf(i), yOf(metric.get(r))))
      ctx.strokeStyle = metric.color
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 数据点
      records.forEach((r, i) => {
        ctx.beginPath()
        ctx.arc(xOf(i), yOf(metric.get(r)), 4, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = metric.color
        ctx.stroke()
      })

      // 末值标签 + 日期
      ctx.fillStyle = metric.color
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      const lastV = vals[vals.length - 1]
      ctx.fillText(lastV.toFixed(1) + metric.unit, xOf(records.length - 1), yOf(lastV) - 8)

      ctx.fillStyle = '#9AA79F'
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText(records[0].date.slice(5), padL, H - padB + 8)
      ctx.textAlign = 'right'
      ctx.fillText(records[records.length - 1].date.slice(5), W - padR, H - padB + 8)
    })
  }
})
