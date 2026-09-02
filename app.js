const { ensureProfile, getProfile } = require('./utils/store')
App({
  onLaunch() {
    if (wx.cloud) { try { wx.cloud.init({ env: 'cloud1-d1g0on3869c3170d5', traceUser: true }) } catch (error) { console.warn('云开发初始化失败，已使用本地模式', error) } }
    ensureProfile()
  },
  globalData: { getProfile }
})
