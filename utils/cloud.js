// 在此填入微信云开发环境 ID 后，云端同步和图片上传会自动启用。
const ENV_ID = ''
const enabled = () => Boolean(ENV_ID && wx.cloud && wx.cloud.database)
function init() { if (!enabled()) return false; wx.cloud.init({ env: ENV_ID, traceUser: true }); return true }
async function uploadImages(paths = []) {
  if (!enabled() || !paths.length) return paths
  const results = await Promise.all(paths.map((filePath, index) => wx.cloud.uploadFile({ cloudPath: `checkins/${Date.now()}_${index}.jpg`, filePath })))
  return results.map(item => item.fileID)
}
async function syncCheckin(checkin) { if (!enabled()) return { synced: false }; return wx.cloud.database().collection('checkins').add({ data: checkin }).then(() => ({ synced: true })) }
async function syncBodyRecord(record) { if (!enabled()) return { synced: false }; return wx.cloud.database().collection('body_records').add({ data: record }).then(() => ({ synced: true })) }
module.exports = { ENV_ID, enabled, init, uploadImages, syncCheckin, syncBodyRecord }
