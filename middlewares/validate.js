// 轻量参数校验中间件
// 用法：validate([{ field:'name', required:true, type:'string', min:2, max:50 }])
const AppError = require('../utils/appError')

function validate(rules) {
  return function (req, res, next) {
    const source = { ...req.query, ...req.body, ...req.params }
    for (const rule of rules) {
      const val = source[rule.field]
      if (rule.required && (val === undefined || val === null || val === '')) {
        return next(new AppError(400, rule.message || `参数 ${rule.field} 不能为空`, 400))
      }
      if (val !== undefined && val !== null && val !== '') {
        if (rule.type === 'int' && !Number.isInteger(Number(val))) {
          return next(new AppError(400, rule.message || `参数 ${rule.field} 必须为整数`, 400))
        }
        if (rule.type === 'number' && isNaN(Number(val))) {
          return next(new AppError(400, rule.message || `参数 ${rule.field} 必须为数字`, 400))
        }
        if (rule.type === 'string' && typeof val !== 'string') {
          return next(new AppError(400, rule.message || `参数 ${rule.field} 必须为字符串`, 400))
        }
        if (rule.min !== undefined && String(val).length < rule.min) {
          return next(new AppError(400, rule.message || `参数 ${rule.field} 长度不能小于 ${rule.min}`, 400))
        }
        if (rule.max !== undefined && String(val).length > rule.max) {
          return next(new AppError(400, rule.message || `参数 ${rule.field} 长度不能大于 ${rule.max}`, 400))
        }
      }
    }
    next()
  }
}

module.exports = validate
