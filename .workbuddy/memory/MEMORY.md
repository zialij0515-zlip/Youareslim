# 项目长期记忆：轻减日记（Youareslim）微信小程序

## 产品定位
个人减脂打卡工具：早/中/晚餐打卡、运动打卡、放纵餐打卡、体重/BMI/体脂率记录与分析；达标后生成可分享海报。风格：清新、轻盈、简约、可爱（浅绿 Morandi 基调）。

## 已确认决策（2026-09-02）
- **热量计算**：v1 用「分类+份量」预设估算（`utils/metrics.js` 已有 breakfast350/lunch550/dinner480/treat650/sport220 等），不建食物库。
- **体脂率**：用 Deurenberg 估算公式 `1.2*BMI + 0.23*age - 10.8*sex - 5.4`（BMI 由体重/身高算，已隐含体重），页面必须标注「估算值·仅供参考」，不替代专业设备。
- **云开发**：用户已有微信云环境 ID（待提供）。需接通 `ENV_ID` + 建集合 + 配权限（按 openid 隔离）。
- **登录**：微信登录取 openid，v1 不绑定手机号。
- **视觉**：沿用浅绿 Morandi 基调（app.json: 背景 #F8F6F1，主色 #4F8567）+ imagegen 生成可爱插画，不换主色。
- **推进方式**：分阶段 A→F，每阶段做完给用户确认再继续（契合用户节奏）。

## 实施阶段
- A 云环境接通 + 集合 + 权限（进行中起点）
- B 建档/首页（今日状态 + Banner 切换 + 进度）
- C 记录闭环（早午晚/运动/放纵餐 + 多图上传 + 热量）
- D 数据页（体重/BMI/体脂曲线，日/周/月）
- E 达标海报（Canvas + 存相册）
- F 真机/弱网/空数据验收

## 关键路径
- 工程目录：`E:\Mini Program`（原生微信小程序）
- 远程仓库：GitHub `zialij0515-zlip/Youareslim`（分支 main，已推送）
- 方案文档：`docs/fat-loss-mini-program-development-plan.md` v0.1
- 云接入说明：`docs/cloud-development-setup.md`
- 数据层：`utils/store.js`（本地 Storage 降级）；云层：`utils/cloud.js`（ENV_ID 待填）
- 指标：`utils/metrics.js`（bmi/bodyFat/calorieEstimate/labelForBmi）
