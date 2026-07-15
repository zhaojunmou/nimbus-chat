#!/usr/bin/env bash
#
# 阿里云 ECS 一键部署脚本 — 在服务器上执行
#
# 使用方法：
#   1. 将代码上传到 /opt/nimbus-chat（或 git clone）
#   2. cd /opt/nimbus-chat
#   3. sudo bash deploy/deploy.sh
#
# 脚本功能：
#   - 安装 Node.js 20 LTS / PM2 / Nginx
#   - 安装依赖、构建前后端
#   - 配置 Nginx 反代
#   - 用 PM2 启动后端并设置开机自启
#
# 注意：脚本以 root 身份运行，幂等可重复执行

set -euo pipefail

# ── 配置 ──
APP_DIR="/opt/nimbus-chat"
APP_USER="root"  # 也可改为专用用户
NODE_VERSION="20"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }

# ── 1. 安装 Node.js（如未安装） ──
if ! command -v node &>/dev/null; then
  log "安装 Node.js $NODE_VERSION ..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
log "Node.js 版本: $(node -v)"

# ── 2. 安装 PM2（如未安装） ──
if ! command -v pm2 &>/dev/null; then
  log "安装 PM2 ..."
  npm install -g pm2
fi
log "PM2 版本: $(pm2 -v)"

# ── 3. 安装 Nginx（如未安装） ──
if ! command -v nginx &>/dev/null; then
  log "安装 Nginx ..."
  apt-get update -qq
  apt-get install -y nginx
fi
log "Nginx 版本: $(nginx -v 2>&1)"

# ── 4. 安装项目依赖 ──
cd "$APP_DIR"
log "安装项目依赖 ..."
npm install

# ── 5. 构建前后端 ──
log "构建前端 (vite build) ..."
npm run build

log "构建后端 (tsc) ..."
npm run build:server

# ── 6. 准备数据目录 ──
DATA_DIR="${DATA_DIR:-/var/lib/nimbus-chat}"
mkdir -p "$DATA_DIR"
log "数据目录: $DATA_DIR"

# 如果 store.json 不存在，从项目复制一份初始数据
if [ ! -f "$DATA_DIR/store.json" ]; then
  if [ -f "$APP_DIR/server/data/store.json" ]; then
    cp "$APP_DIR/server/data/store.json" "$DATA_DIR/store.json"
    log "已复制初始数据到 $DATA_DIR/store.json"
  fi
fi

# ── 7. 配置 Nginx ──
NGINX_CONF="/etc/nginx/conf.d/nimbus-chat.conf"
log "配置 Nginx → $NGINX_CONF"

# 自动检测公网 IP 作为默认 server_name
PUBLIC_IP=$(curl -s --max-time 5 http://ifconfig.me || echo "localhost")
SERVER_NAME="${DOMAIN:-$PUBLIC_IP}"

# 替换 server_name 和 root
sed -e "s|YOUR_DOMAIN_OR_IP|$SERVER_NAME|" \
    -e "s|/opt/nimbus-chat/dist|$APP_DIR/dist|" \
    "$APP_DIR/deploy/nginx.conf" > "$NGINX_CONF"

nginx -t && systemctl reload nginx
log "Nginx 已配置，server_name: $SERVER_NAME"

# ── 8. 用 PM2 启动后端 ──
log "启动 PM2 ..."
mkdir -p "$APP_DIR/logs"

# 设置环境变量
export NODE_ENV=production
export PORT="${PORT:-3001}"
export DATA_DIR="$DATA_DIR"

# 如果存在 .env 文件则加载
if [ -f "$APP_DIR/.env" ]; then
  log "加载 .env 配置"
  set -a
  source "$APP_DIR/.env"
  set +a
fi

pm2 delete nimbus-chat 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.cjs" \
  --cwd "$APP_DIR" \
  --env production

pm2 save
log "PM2 已启动 nimbus-chat"

# ── 9. 配置 PM2 开机自启 ──
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || warn "PM2 开机自启配置失败，可手动执行: pm2 startup"
log "PM2 开机自启已配置"

# ── 10. 完成 ──
log "========================================"
log "部署完成！"
log "  前端访问: http://$SERVER_NAME"
log "  后端 API: http://$SERVER_NAME/api"
log "  健康检查: http://$SERVER_NAME/health"
log "  PM2 状态: pm2 status"
log "  PM2 日志: pm2 logs nimbus-chat"
log "  Nginx 日志: /var/log/nginx/access.log"
log ""
log "如需 HTTPS（推荐，WebRTC 语音通话必需）："
log "  1. 域名解析到本服务器 IP"
log "  2. apt install certbot python3-certbot-nginx"
log "  3. certbot --nginx -d $SERVER_NAME"
log "========================================"
