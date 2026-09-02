const { getProfile, getBodyRecords } = require('../../utils/store')

function dpr() {
  try { return wx.getSystemInfoSync().pixelRatio || 2 } catch (e) { return 2 }
}

Page({
  data: { profile: {}, current: {}, reached: false },
  onShow() {
    const profile = getProfile()
    const current = getBodyRecords().slice(-1)[0] || {}
    this.setData({ profile, current, reached: Number(current.weight) <= Number(profile.targetWeight) }, () => this.drawPoster())
  },
  drawPoster() {
    const { profile, current, reached } = this.data
    wx.createSelectorQuery().in(this).select('#posterCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const ratio = dpr()
      const W = res[0].width, H = res[0].height
      canvas.width = W * ratio
      canvas.height = H * ratio
      ctx.scale(ratio, ratio)
      ctx.clearRect(0, 0, W, H)

      // 背景渐变
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#D9EDDB')
      g.addColorStop(1, '#FFF8E9')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)

      ctx.textAlign = 'center'

      // 品牌
      ctx.fillStyle = '#376146'
      ctx.font = '600 26px sans-serif'
      ctx.fillText('轻 减 日 记', W / 2, 70)

      // 装饰花
      ctx.fillStyle = '#E6A774'
      ctx.font = '64px sans-serif'
      ctx.fillText('✦', W / 2, 175)

      // 标题
      ctx.fillStyle = '#365E45'
      ctx.font = '700 42px sans-serif'
      ctx.fillText(reached ? '我做到了！' : '我正在靠近目标', W / 2, 268)

      // 昵称
      ctx.fillStyle = '#376146'
      ctx.font = '28px sans-serif'
      ctx.fillText(profile.nickname || '轻减小伙伴', W / 2, 318)

      // 三个数字
      const items = [
        { l: '起始', v: profile.startWeight },
        { l: '当前', v: current.weight || profile.startWeight },
        { l: '目标', v: profile.targetWeight }
      ]
      const gap = W / 3
      items.forEach((it, i) => {
        const x = gap * i + gap / 2
        ctx.fillStyle = '#6B806F'
        ctx.font = '22px sans-serif'
        ctx.fillText(it.l, x, 470)
        ctx.fillStyle = '#365E45'
        ctx.font = '700 38px sans-serif'
        ctx.fillText(String(it.v), x, 518)
      })

      // 文案
      ctx.fillStyle = '#376146'
      ctx.font = '26px sans-serif'
      ctx.fillText(reached ? '每一份坚持，都值得被看见。' : '慢慢来，记录本身也是一种进步。', W / 2, H - 56)
    })
  },
  save() {
    wx.createSelectorQuery().in(this).select('#posterCanvas').fields({ node: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return wx.showToast({ title: '海报尚未就绪', icon: 'none' })
      this.drawPoster()
      wx.canvasToTempFilePath({
        canvas: res[0].node,
        success: r => {
          wx.saveImageToPhotosAlbum({
            filePath: r.tempFilePath,
            success: () => wx.showToast({ title: '已保存到相册' }),
            fail: err => {
              const msg = (err && err.errMsg) || ''
              if (/auth|deny/i.test(msg)) {
                wx.showModal({ title: '需要相册权限', content: '请在设置中允许「保存到相册」后重试', showCancel: false })
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          })
        },
        fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
      })
    })
  }
})
