// 统一响应格式
function ok(res, data = null, message = 'success', code = 0) {
  res.json({ code, message, data })
}

function fail(res, message = '请求失败', code = 1, status = 400) {
  res.status(status).json({ code, message, data: null })
}

module.exports = { ok, fail }
