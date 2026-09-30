// 业务自定义错误
class AppError extends Error {
  constructor(code = 1, message = '业务错误', status = 400) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'AppError'
  }
}

module.exports = AppError
