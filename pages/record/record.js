const { today, addCheckin, addBodyRecord, getProfile, getBodyRecords, getAllCheckins } = require('../../utils/store')
const { bmi, bodyFat } = require('../../utils/metrics')
const { uploadImages, syncCheckin, syncBodyRecord, enabled } = require('../../utils/cloud')
Page({
  data: { activeType:'breakfast', typeOptions:[{key:'breakfast',name:'早餐'},{key:'lunch',name:'午餐'},{key:'dinner',name:'晚餐'},{key:'sport',name:'运动'},{key:'treat',name:'放纵餐'}], sportOptions:[{key:'run',name:'跑步'},{key:'tennis',name:'网球'},{key:'incline',name:'爬坡运动'},{key:'aerobic',name:'有氧'},{key:'anaerobic',name:'无氧'},{key:'stretch',name:'拉伸'}], mealMoods:[{key:'full',name:'很满足',icon:'/assets/record/mood-full.png'},{key:'good',name:'好吃',icon:'/assets/record/mood-good.png'},{key:'hungry',name:'有点饿',icon:'/assets/record/mood-hungry.png'}], sportMoods:[{key:'full',name:'运动达标',icon:'/assets/record/mood-full.png'},{key:'good',name:'浅浅运动',icon:'/assets/record/mood-good.png'},{key:'hungry',name:'没有运动',icon:'/assets/record/mood-hungry.png'}], moods:[{key:'full',name:'很满足',icon:'/assets/record/mood-full.png'},{key:'good',name:'好吃',icon:'/assets/record/mood-good.png'},{key:'hungry',name:'有点饿',icon:'/assets/record/mood-hungry.png'}], mood:'good', note:'', images:[], sportItems:[], sampleImages:['/assets/record/food1.png','/assets/record/food2.png'], notePlaceholder:'记录食物和心情', saved:false, weight:'', inputWidth:170, bmiValue:'', weightLoss:'', dayCount:0, mealRate:0, sportRate:0 },
  onLoad(){ this.typeCache={}; this.computeWeekStats(); this.computeDayCount(); const records=getBodyRecords(); if(records.length){ const w=records[records.length-1].weight; this.setData({weight:String(w), inputWidth:this.weightInputWidth(String(w))},()=>this.computeWeightStats()); } else { this.computeWeightStats(); } this.loadType(this.data.activeType); },
  chooseType(e){ const prev=this.data.activeType; this.typeCache[prev]={note:this.data.note,mood:this.data.mood,images:this.data.images,sportItems:this.data.sportItems,saved:this.data.saved}; const t=e.currentTarget.dataset.key; this.loadType(t); },
  defaultSportItems(){ return this.data.sportOptions.map(o=>({key:o.key,name:o.name,selected:false,minutes:''})); },
  loadType(t){
    const sport=t==='sport';
    const base={note:'',mood:'good',images:[],sportItems:this.defaultSportItems(),saved:false};
    let draft=this.typeCache[t];
    if(!draft){
      const saved=getAllCheckins().filter(c=>c.date===today()&&c.type===t).slice(-1)[0];
      if(saved) draft={note:saved.note||'',mood:saved.mood||'good',images:saved.images||[],sportItems:saved.sportItems&&saved.sportItems.length?saved.sportItems:this.defaultSportItems(),saved:true};
    }
    const state=draft||base;
    this.setData({activeType:t,...state,moods:sport?this.data.sportMoods:this.data.mealMoods,notePlaceholder:sport?'选择今天的运动项目':'记录食物和心情',sampleImages:sport?['/assets/record/sport1.png','/assets/record/sport2.png']:['/assets/record/food1.png','/assets/record/food2.png']});
  },
  toggleSport(e){ const key=e.currentTarget.dataset.key; const items=this.data.sportItems.map(it=>it.key===key?{...it,selected:!it.selected}:it); this.setData({sportItems:items,saved:false}); },
  inputSport(e){ const key=e.currentTarget.dataset.key; const val=e.detail.value; const items=this.data.sportItems.map(it=>it.key===key?{...it,minutes:val}:it); this.setData({sportItems:items,saved:false}); },
  chooseMood(e){ this.setData({mood:e.currentTarget.dataset.key, saved:false}) },
  input(e){ const key=e.currentTarget.dataset.key; const value=e.detail.value; const patch={[key]:value, saved:false}; if(key==='weight'){ patch.inputWidth=this.weightInputWidth(value); this.setData(patch,()=>this.computeWeightStats()); } else { this.setData(patch); } },
  chooseImage(){ wx.chooseMedia({count:3,mediaType:['image'],success:res=>this.setData({images:res.tempFiles.map(f=>f.tempFilePath), saved:false})}) },
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
      const radius=Math.min(cx,cy)-8
      const lineWidth=12
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
  weightInputWidth(value){
    const len=String(value).length;
    if(!len||len<=2) return 120;
    if(len<=3) return 160;
    if(len<=4) return 200;
    return 240;
  },
  computeDayCount(){
    const checkins=getAllCheckins();
    const bodyRecords=getBodyRecords();
    const dates=[];
    checkins.forEach(c=>dates.push(c.date));
    bodyRecords.forEach(r=>dates.push(r.date));
    if(!dates.length) return this.setData({dayCount:1});
    dates.sort();
    const start=new Date(dates[0]);
    const now=new Date(today());
    start.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diff=Math.round((now-start)/(1000*60*60*24));
    this.setData({dayCount:Math.max(1,diff+1)});
  },
  computeWeightStats(){
    const p=getProfile(); const weight=Number(this.data.weight);
    const bmiValue=weight&&p.height?bmi(weight,p.height):'';
    let weightLoss='';
    if(weight&&p.startWeight!==undefined){
      const diff=p.startWeight-weight;
      weightLoss=diff.toFixed(1);
    }
    this.setData({bmiValue, weightLoss});
  },
  async saveCheckin(){ const type=this.data.activeType; if (type === 'sport'){ if(!this.data.sportItems.some(it=>it.selected)) return wx.showToast({title:'请选择至少一项运动',icon:'none'}); } else if(!this.data.note) return wx.showToast({title:'请写下今日记录',icon:'none'}); const record={date:today(),type,mood:this.data.mood,note:this.data.note,images:this.data.images,sportItems:this.data.sportItems}; addCheckin(record); this.typeCache[type]={note:record.note,mood:record.mood,images:record.images,sportItems:this.data.sportItems,saved:true}; this.setData({saved:true}); this.computeWeekStats(); this.computeDayCount(); if(!enabled()) return wx.showToast({title:'已保存到本地'}); wx.showLoading({title:'正在同步'}); try { record.images=await uploadImages(record.images); await syncCheckin(record); wx.showToast({title:'已保存并同步'}) } catch(error) { console.warn('打卡同步失败',error); wx.showToast({title:'已本地保存，待同步',icon:'none'}) } finally { wx.hideLoading() } },
  async saveWeight(){ const weight=Number(this.data.weight); const p=getProfile(); if(!weight) return wx.showToast({title:'请输入有效体重',icon:'none'}); const bmiValue=bmi(weight,p.height); const record={date:today(),weight,bmi:bmiValue,bodyFat:bodyFat({gender:p.gender,age:p.age,bmiValue})}; addBodyRecord(record); this.computeWeightStats(); if(!enabled()) return wx.showToast({title:'身体数据已更新'}); try { await syncBodyRecord(record); wx.showToast({title:'已更新并同步'}) } catch(error) { console.warn('身体数据同步失败',error); wx.showToast({title:'已本地保存，待同步',icon:'none'}) } }
})
