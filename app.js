const cloud = require('./utils/cloud')
const { ensureProfile, getProfile } = require('./utils/store')
App({
  onLaunch() {
    cloud.init() // 集中初始化云环境（ENV_ID 在 utils/cloud.js）
    ensureProfile()
  },
  globalData: { getProfile }
})
