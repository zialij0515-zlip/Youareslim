const { getProfile, saveProfile, addBodyRecord, today } = require('../../utils/store')
const { bmi, bodyFat } = require('../../utils/metrics')
Page({
  data: { form: null, genderOptions: ['女性', '男性'], genderIndex: 0 },
  onLoad() { const p = getProfile(); this.setData({ form: p, genderIndex: p.gender === 'male' ? 1 : 0 }); if (p.onboardingComplete) wx.switchTab({ url: '/pages/home/home' }) },
  input(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }) },
  gender(e) { this.setData({ genderIndex: Number(e.detail.value), 'form.gender': Number(e.detail.value) ? 'male' : 'female' }) },
  submit() {
    const f = this.data.form; const required = ['age','height','startWeight','targetWeight'];
    if (required.some(key => !Number(f[key]))) return wx.showToast({ title: '请补全有效的身体数据', icon: 'none' })
    const weight = Number(f.startWeight); const height = Number(f.height); const age = Number(f.age); const bmiValue = bmi(weight, height)
    saveProfile({ ...f, age, height, startWeight: weight, targetWeight: Number(f.targetWeight), onboardingComplete: true })
    addBodyRecord({ date: today(), weight, bmi: bmiValue, bodyFat: bodyFat({ gender: f.gender, age, bmiValue }) })
    wx.switchTab({ url: '/pages/home/home' })
  }
})
