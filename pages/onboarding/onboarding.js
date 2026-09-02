const { getProfile, saveProfile, addBodyRecord, today } = require('../../utils/store')
const { bmi, bodyFat } = require('../../utils/metrics')
const cloud = require('../../utils/cloud')
Page({
  data: { form: null, genderOptions: ['女性', '男性'], genderIndex: 0 },
  onLoad() { const p = getProfile(); this.setData({ form: p, genderIndex: p.gender === 'male' ? 1 : 0 }); if (p.onboardingComplete) wx.switchTab({ url: '/pages/home/home' }) },
  input(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }) },
  gender(e) { this.setData({ genderIndex: Number(e.detail.value), 'form.gender': Number(e.detail.value) ? 'male' : 'female' }) },
  submit() {
    const f = this.data.form; const required = ['age','height','startWeight','targetWeight'];
    if (required.some(key => !Number(f[key]))) return wx.showToast({ title: '请补全有效的身体数据', icon: 'none' })
    const weight = Number(f.startWeight); const height = Number(f.height); const age = Number(f.age); const bmiValue = bmi(weight, height)
    const bodyFatValue = bodyFat({ gender: f.gender, age, bmiValue })
    const profile = { nickname: f.nickname || '轻减小伙伴', gender: f.gender, age, height, startWeight: weight, targetWeight: Number(f.targetWeight), targetDate: f.targetDate || '', onboardingComplete: true }
    saveProfile(profile)
    const record = { date: today(), weight, bmi: bmiValue, bodyFat: bodyFatValue }
    addBodyRecord(record)
    // 云端同步（失败不影响本地使用）
    cloud.syncProfile(profile)
    cloud.syncBodyRecord(record)
    wx.switchTab({ url: '/pages/home/home' })
  }
})
