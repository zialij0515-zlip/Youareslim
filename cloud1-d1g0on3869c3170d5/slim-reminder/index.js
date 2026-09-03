const cloud = require('wx-server-sdk')
// 固定使用当前云环境 ID（定时触发器下 DYNAMIC_CURRENT_ENV 可能解析异常）
cloud.init({ env: 'cloud1-d1g0on3869c3170d5' })
const db = cloud.database()

// 订阅消息「打卡提醒」模板 ID（与 pages/profile/profile.js 的 REMIND_TEMPLATE_ID 保持一致）
const TEMPLATE_ID = 'YC8eJXTIXEa2snIHZaZEjE7BP9NWumRcUoCEVpxfuI4'

// 生成北京时间字符串（云函数运行时不一定是东八区）
function beijingTimeString(d = new Date()) {
  const offsetMin = d.getTimezoneOffset() // 当前时区与 UTC 的分钟差
  const cst = new Date(d.getTime() + (offsetMin + 480) * 60000)
  const pad = n => n.toString().padStart(2, '0')
  return `${cst.getFullYear()}年${cst.getMonth() + 1}月${cst.getDate()}日 ${pad(cst.getHours())}:${pad(cst.getMinutes())}`
}

// 每日定时触发：向所有授权过订阅消息的用户推送打卡提醒
exports.main = async (event) => {
  if (!TEMPLATE_ID) {
    return { skipped: true, reason: 'TEMPLATE_ID 未配置，请在 index.js 填写' }
  }
  // 诊断：打印云函数运行上下文，确认 AppID/环境是否正确
  const wxCtx = cloud.getWXContext()
  console.log('[reminder] WXContext', JSON.stringify({ appid: wxCtx.APPID, openid: wxCtx.OPENID, unionid: wxCtx.UNIONID, env: wxCtx.ENV }))
  const subs = await db.collection('reminder_subs').get()
  let sent = 0
  const timeStr = beijingTimeString()
  for (const s of subs.data) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: s._openid,
        templateId: TEMPLATE_ID,
        page: 'pages/home/home',
        data: {
          thing26: { value: '今天还没打卡哦' },
          time23: { value: timeStr }
        }
      })
      sent++
    } catch (e) {
      console.warn('[reminder] 发送给', s._openid, '失败', e)
    }
  }
  return { total: subs.data.length, sent }
}
