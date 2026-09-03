function round(value, decimals = 1) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(decimals)) : null }
function bmi(weight, height) { if (!weight || !height) return null; return round(weight / Math.pow(height / 100, 2), 1) }
function bodyFat({ gender, age, bmiValue }) { if (!bmiValue || !age) return null; const sex = gender === 'male' ? 1 : 0; return round(1.2 * bmiValue + 0.23 * age - 10.8 * sex - 5.4, 1) }
function calorieEstimate(category, portion) { const base = { breakfast: 350, lunch: 550, dinner: 480, treat: 650, sport: 220 }[category] || 400; const multiplier = { small: .75, normal: 1, large: 1.35 }[portion] || 1; return Math.round(base * multiplier) }
function labelForBmi(value) { if (!value) return '待记录'; if (value < 18.5) return '偏低'; if (value < 24) return '正常'; if (value < 28) return '超重'; return '肥胖' }
function labelForBodyFat(value, gender) { if (!value) return '待记录'; const isMale = gender === 'male'; if (isMale) { if (value < 10) return '偏低'; if (value <= 20) return '标准'; if (value < 25) return '偏高'; return '肥胖'; } if (value < 20) return '偏低'; if (value <= 30) return '标准'; if (value < 35) return '偏高'; return '肥胖'; }
module.exports = { bmi, bodyFat, calorieEstimate, labelForBmi, labelForBodyFat }
