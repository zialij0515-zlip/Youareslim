const { getProfile, getBodyRecords } = require('../../utils/store')
Page({ data:{profile:{},current:{},reached:false},onShow(){const profile=getProfile(),current=getBodyRecords().slice(-1)[0]||{};this.setData({profile,current,reached:Number(current.weight)<=Number(profile.targetWeight)})}, save(){wx.showModal({title:'海报准备中',content:'当前为页面预览。绑定云环境后，可接入 Canvas 导出并保存至相册。',showCancel:false})} })
