const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// TODO: 填入你在微信公众平台「订阅消息」中创建的「打卡提醒」模板 ID（与 pages/profile/profile.js 中的 REMIND_TEMPLATE_ID 保持一致）
const TEMPLATE_ID = ''

// 每日定时触发：向所有授权过订阅消息的用户推送打卡提醒
exports.main = async (event) => {
  if (!TEMPLATE_ID) {
    return { skipped: true, reason: 'TEMPLATE_ID 未配置，请在 index.js 填写' }
  }
  const subs = await db.collection('reminder_subs').get()
  let sent = 0
  for (const s of subs.data) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: s._openid,
        templateId: TEMPLATE_ID,
        page: 'pages/home/home',
        data: {
          // TODO: 按模板的关键词字段填充，例如：
          // thing1: { value: '该打卡啦' },
          // time2: { value: '今天' }
        }
      })
      sent++
    } catch (e) {
      console.warn('[reminder] 发送给', s._openid, '失败', e)
    }
  }
  return { total: subs.data.length, sent }
}
