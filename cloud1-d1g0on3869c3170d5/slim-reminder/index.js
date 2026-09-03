const cloud = require('wx-server-sdk')
const https = require('https')
// 固定使用当前云环境 ID（定时触发器下 DYNAMIC_CURRENT_ENV 可能解析异常）
cloud.init({ env: 'cloud1-d1g0on3869c3170d5' })
const db = cloud.database()

// 订阅消息「打卡提醒」模板 ID（与 pages/profile/profile.js 的 REMIND_TEMPLATE_ID 保持一致）
const TEMPLATE_ID = 'YC8eJXTIXEa2snIHZaZEjE7BP9NWumRcUoCEVpxfuI4'

// 从小程序后台「开发设置」拿到，填到云函数「配置 - 环境变量」里，不写入代码
const APPID = process.env.APPID
const APPSECRET = process.env.APPSECRET

let tokenCache = null
let tokenExpireAt = 0

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })
}

// 用 AppID + AppSecret 换取 access_token，并做简单缓存
async function getAccessToken() {
  const now = Date.now()
  if (tokenCache && tokenExpireAt > now + 60 * 1000) return tokenCache
  if (!APPID || !APPSECRET) {
    throw new Error('缺少 APPID 或 APPSECRET 环境变量，请去云函数配置里填写')
  }
  // 日志脱敏：只打印长度和首尾，确认环境变量读到了什么
  console.log('[reminder] APPID 长度', APPID ? APPID.length : 0, '首尾', APPID ? `${APPID.slice(0, 4)}...${APPID.slice(-4)}` : '空')
  console.log('[reminder] APPSECRET 长度', APPSECRET ? APPSECRET.length : 0, '首尾', APPSECRET ? `${APPSECRET.slice(0, 4)}...${APPSECRET.slice(-4)}` : '空')
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  const res = JSON.parse(await httpGet(url))
  if (!res.access_token) {
    throw new Error(`获取 access_token 失败: ${JSON.stringify(res)}`)
  }
  tokenCache = res.access_token
  tokenExpireAt = now + (res.expires_in || 7200) * 1000
  console.log('[reminder] access_token 获取成功，有效期至', new Date(tokenExpireAt).toISOString())
  return tokenCache
}

// 手动调微信订阅消息发送接口（绕过 cloud.openapi）
async function sendSubscribeMsg(openid, data) {
  const token = await getAccessToken()
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`
  const body = {
    touser: openid,
    template_id: TEMPLATE_ID,
    page: 'pages/home/home',
    data
  }
  const res = JSON.parse(await httpPost(url, body))
  if (res.errcode !== 0) {
    throw new Error(`发送失败 errcode=${res.errcode} errmsg=${res.errmsg}`)
  }
  return res
}

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
    return { skipped: true, reason: 'TEMPLATE_ID 未配置' }
  }
  if (!APPID || !APPSECRET) {
    return { skipped: true, reason: '缺少 APPID/APPSECRET 环境变量，请去云函数配置里填写' }
  }
  const subs = await db.collection('reminder_subs').get()
  let sent = 0
  const timeStr = beijingTimeString()
  for (const s of subs.data) {
    try {
      await sendSubscribeMsg(s._openid, {
        thing26: { value: '今天还没打卡哦' },
        time23: { value: timeStr }
      })
      sent++
    } catch (e) {
      console.warn('[reminder] 发送给', s._openid, '失败', e)
    }
  }
  return { total: subs.data.length, sent }
}
