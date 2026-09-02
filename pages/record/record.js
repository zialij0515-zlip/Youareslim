const { today, addCheckin, addBodyRecord, getProfile, getAllCheckins } = require('../../utils/store')
const { bmi, bodyFat, calorieEstimate } = require('../../utils/metrics')
const { uploadImages, syncCheckin, syncBodyRecord, enabled } = require('../../utils/cloud')
Page({
  data: { activeType:'breakfast', typeOptions:[{key:'breakfast',name:'早餐'},{key:'lunch',name:'午餐'},{key:'dinner',name:'晚餐'},{key:'sport',name:'运动'},{key:'treat',name:'放纵餐'}], note:'', calories:350, images:[], weight:'', mealRate:0, sportRate:0 },
  onLoad(){ this.refreshEstimate(); this.computeWeekStats() },
  chooseType(e){ this.setData({activeType:e.currentTarget.dataset.key},()=>this.refreshEstimate()) },
  refreshEstimate(){ this.setData({calories:calorieEstimate(this.data.activeType,'normal')}) },
  input(e){ this.setData({[e.currentTarget.dataset.key]:e.detail.value}) },
  chooseImage(){ wx.chooseMedia({count:3,mediaType:['image'],success:res=>this.setData({images:res.tempFiles.map(f=>f.tempFilePath)})}) },
  previewImage(e){ wx.previewImage({urls:this.data.images,current:this.data.images[e.currentTarget.dataset.idx]}) },
  computeWeekStats(){
    const all=getAllCheckins()
    const now=new Date()
    const day=now.getDay()
    const diff=now.getDate()-day+(day===0?-6:1)
    const monday=new Date(now.getFullYear(),now.getMonth(),diff)
    monday.setHours(0,0,0,0)
    const sunday=new Date(monday)
    sunday.setDate(monday.getDate()+6)
    sunday.setHours(23,59,59,999)
    const mealDays=new Set()
    const sportDays=new Set()
    all.forEach(c=>{
      const d=new Date(c.date)
      if(d<monday||d>sunday) return
      if(c.type==='sport') sportDays.add(c.date)
      else mealDays.add(c.date)
    })
    const mealRate=Math.round((mealDays.size/7)*100)
    const sportRate=Math.round((sportDays.size/7)*100)
    this.setData({mealRate,sportRate},()=>{
      this.drawRing('mealRing',mealRate,'#B3C99E')
      this.drawRing('sportRing',sportRate,'#C8A9A6')
    })
  },
  drawRing(canvasId,percent,color){
    const query=wx.createSelectorQuery().in(this)
    query.select('#'+canvasId).fields({node:true,size:true}).exec(res=>{
      if(!res||!res[0]) return
      const canvas=res[0].node
      const ctx=canvas.getContext('2d')
      const dpr=wx.getSystemInfoSync().pixelRatio
      const width=res[0].width
      const height=res[0].height
      canvas.width=width*dpr
      canvas.height=height*dpr
      ctx.scale(dpr,dpr)
      const cx=width/2
      const cy=height/2
      const radius=Math.min(cx,cy)-10
      const lineWidth=14
      ctx.clearRect(0,0,width,height)
      ctx.beginPath()
      ctx.arc(cx,cy,radius,0,2*Math.PI)
      ctx.lineWidth=lineWidth
      ctx.strokeStyle='#EBE6F0'
      ctx.lineCap='round'
      ctx.stroke()
      const start=-Math.PI/2
      const end=start+(2*Math.PI*percent/100)
      ctx.beginPath()
      ctx.arc(cx,cy,radius,start,end)
      ctx.strokeStyle=color
      ctx.stroke()
    })
  },
  async saveCheckin(){ const type=this.data.activeType; if (type === 'sport' && !this.data.note) return wx.showToast({title:'请写下运动内容或时长',icon:'none'}); const record={date:today(),type,calories:Number(this.data.calories)||0,note:this.data.note,images:this.data.images}; addCheckin(record); this.setData({note:'',images:[]}); this.computeWeekStats(); if(!enabled()) return wx.showToast({title:'已保存到本地'}); wx.showLoading({title:'正在同步'}); try { record.images=await uploadImages(record.images); await syncCheckin(record); wx.showToast({title:'已保存并同步'}) } catch(error) { console.warn('打卡同步失败',error); wx.showToast({title:'已本地保存，待同步',icon:'none'}) } finally { wx.hideLoading() } },
  async saveWeight(){ const weight=Number(this.data.weight); const p=getProfile(); if(!weight) return wx.showToast({title:'请输入有效体重',icon:'none'}); const bmiValue=bmi(weight,p.height); const record={date:today(),weight,bmi:bmiValue,bodyFat:bodyFat({gender:p.gender,age:p.age,bmiValue})}; addBodyRecord(record); this.setData({weight:''}); if(!enabled()) return wx.showToast({title:'身体数据已更新'}); try { await syncBodyRecord(record); wx.showToast({title:'已更新并同步'}) } catch(error) { console.warn('身体数据同步失败',error); wx.showToast({title:'已本地保存，待同步',icon:'none'}) } }
})
