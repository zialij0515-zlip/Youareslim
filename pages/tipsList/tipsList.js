const { getList } = require('../../utils/tips')

Page({
  data: { type: 'methods', title: '', list: [] },
  onLoad(opts) {
    const type = opts.type || 'methods'
    const list = getList(type)
    const title = type === 'sports' ? '更好的运动' : '更多减脂方法'
    this.setData({ type, title, list })
    wx.setNavigationBarTitle({ title })
  },
  open(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/article/article?type=${this.data.type}&id=${id}` })
  }
})
