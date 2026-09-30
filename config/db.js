// mysql2 连接池
const mysql = require('mysql2/promise')
const env = require('./env')

const pool = mysql.createPool(env.db)

// 启动时探测连接
;(async () => {
  try {
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    console.log(`[DB] 连接成功 ${env.db.host}:${env.db.port}/${env.db.database}`)
  } catch (e) {
    console.error('[DB] 连接失败:', e.message)
  }
})()

module.exports = { pool }
