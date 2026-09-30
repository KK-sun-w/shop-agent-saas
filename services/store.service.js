// 门店（租户）管理服务
const { pool } = require('../config/db')
const AppError = require('../utils/appError')

// 店主查看自己门店信息
async function getMyStore(tenantId) {
  const [rows] = await pool.query('SELECT * FROM tenant WHERE id = ? LIMIT 1', [tenantId])
  if (!rows.length) throw new AppError(404, '门店不存在', 404)
  return rows[0]
}

// 更新门店信息
async function updateStore(tenantId, body) {
  const sets = []
  const args = []
  const allowed = ['name', 'contact_name', 'contact_phone', 'address']
  for (const k of allowed) {
    if (body[k] !== undefined) { sets.push(`${k} = ?`); args.push(body[k]) }
  }
  if (!sets.length) throw new AppError(400, '没有可更新的字段', 400)
  args.push(tenantId)
  await pool.query(`UPDATE tenant SET ${sets.join(', ')} WHERE id = ?`, args)
  return getMyStore(tenantId)
}

// 管理员：所有门店列表
async function listAll({ page = 1, pageSize = 20, keyword = '' }) {
  const offset = (page - 1) * pageSize
  let where = '1=1'
  const args = []
  if (keyword) { where += ' AND (name LIKE ? OR contact_name LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`) }
  const [list] = await pool.query(
    `SELECT * FROM tenant WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...args, Number(pageSize), offset]
  )
  const [total] = await pool.query(`SELECT COUNT(*) as cnt FROM tenant WHERE ${where}`, args)
  return { list, total: total[0].cnt }
}

module.exports = { getMyStore, updateStore, listAll }
