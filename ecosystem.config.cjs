/**
 * PM2 进程配置 — 生产环境运行后端服务
 *
 * 使用：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # 开机自启
 */
module.exports = {
  apps: [
    {
      name: "nimbus-chat",
      script: "dist-server/server/index.js",
      instances: 1, // 单实例 — JSON 文件存储不支持多实例并发写入
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
      },
      // 日志
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
