const { getProfile, saveProfile, getBodyRecords } = require('../../utils/store')
const cloud = require('../../utils/cloud')
// 订阅消息模板 ID：在微信公众平台「订阅消息」中创建「打卡提醒」模板后填入，留空则只做应用内提醒
const REMIND_TEMPLATE_ID = ''
Page({
  data: { profile: {}, current: {} },
  onShow() { const profile = getProfile(), current = getBodyRecords().slice(-1)[0] || {}; this.setData({ profile, current }) },
  edit() { wx.navigateTo({ url: '/pages/onboarding/onboarding' }) },
  poster() { wx.navigateTo({ url: '/pages/poster/poster' }) },
  toggleRemind(e) {
    const value = e.detail.value
    saveProfile({ remindCheckIn: value })
    this.setData({ profile: { ...this.data.profile, remindCheckIn: value } })
    if (value) this.requestSubscribe()
  },
  requestSubscribe() {
    if (!REMIND_TEMPLATE_ID) return
    wx.requestSubscribeMessage({
      tmplIds: [REMIND_TEMPLATE_ID],
      success: () => { if (cloud.enabled()) cloud.syncSubscription(REMIND_TEMPLATE_ID) },
      fail: (e) => console.warn('[profile] 订阅授权失败', e)
    })
  }
})
