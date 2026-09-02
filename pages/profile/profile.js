const { getProfile, saveProfile, getBodyRecords } = require('../../utils/store')
Page({ data:{profile:{},current:{}},onShow(){const profile=getProfile(),current=getBodyRecords().slice(-1)[0]||{};this.setData({profile,current})}, edit(){wx.navigateTo({url:'/pages/onboarding/onboarding'})}, poster(){wx.navigateTo({url:'/pages/poster/poster'})} })
