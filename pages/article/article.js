const { getItem } = require('../../utils/tips')

Page({
  data: { item: null },
  onLoad(opts) {
    const item = getItem(opts.type, opts.id)
    if (item) {
      this.setData({ item })
      wx.setNavigationBarTitle({ title: item.name })
    }
  }
})
