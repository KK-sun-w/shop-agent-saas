// pm2 部署配置
module.exports = {
  apps: [
    {
      name: 'shop-agent-saas',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
}
