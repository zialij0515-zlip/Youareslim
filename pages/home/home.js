const { getProfile, getBodyRecords, getCheckins, today } = require('../../utils/store')
Page({
  data: { profile: {}, body: {}, checkins: [], today: '', tasks: [] },
  onShow() { const profile = getProfile(); if (!profile.onboardingComplete) return wx.reLaunch({url:'/pages/onboarding/onboarding'}); const body = getBodyRecords().slice(-1)[0] || {}; const checkins = getCheckins(); const types = ['breakfast','lunch','dinner','sport','treat']; const labels = { breakfast:'早餐', lunch:'午餐', dinner:'晚餐', sport:'运动', treat:'放纵餐' }; this.setData({ profile, body, checkins, today: today(), tasks: types.map(type => ({ type, label: labels[type], done: checkins.some(c => c.type === type) })) }) },
  record(e) { wx.switchTab({url:'/pages/record/record'}); setTimeout(() => { const pages = getCurrentPages(); pages[pages.length - 1].setData({ activeType: e.currentTarget.dataset.type }) }, 300) },
  progress() { const { startWeight, targetWeight } = this.data.profile; const current = this.data.body.weight || startWeight; return Math.max(0, Math.min(100, Math.round((startWeight - current) / (startWeight - targetWeight) * 100) || 0)) }
})
