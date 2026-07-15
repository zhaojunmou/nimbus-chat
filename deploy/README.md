# 阿里云 ECS 部署指南

本项目为 React + Express + Socket.IO 单页应用，部署方式：**Nginx 托管前端静态资源 + 反代后端 API/WebSocket + PM2 守护后端进程**。

## 架构

```
浏览器
  │
  ▼
Nginx (80/443)
  ├── /          → dist/index.html (前端 SPA)
  ├── /assets/   → dist/assets/ (静态资源，长缓存)
  ├── /api/      → 反代到 127.0.0.1:3001 (Express REST)
  └── /socket.io/→ 反代到 127.0.0.1:3001 (WebSocket，需 Upgrade)
                    │
                    ▼
                PM2 → node dist-server/server/index.js
                    │
                    ▼
                /var/lib/nimbus-chat/store.json (数据持久化)
```

## 前置条件

- 阿里云 ECS 实例（推荐 2核4G 起步，Ubuntu 22.04/24.04）
- 安全组开放端口：**80**（HTTP）、**443**（HTTPS，可选）、**22**（SSH）
- **WebRTC 语音通话需要 HTTPS** — 浏览器只在 secure context（HTTPS 或 localhost）下开放 `getUserMedia`
  - 如无域名/证书，语音通话功能不可用，但文字聊天、图片、群聊等功能正常

## 部署步骤

### 1. 上传代码到服务器

**方式 A：Git 克隆（推荐）**

```bash
ssh root@你的ECS公网IP
cd /opt
git clone https://github.com/你的用户名/你的仓库.git nimbus-chat
cd nimbus-chat
```

**方式 B：本地上传**

在本地打包（排除 node_modules）：
```bash
cd /workspace
tar --exclude='node_modules' --exclude='dist' --exclude='dist-server' --exclude='.git' -czf nimbus-chat.tar.gz .
scp nimbus-chat.tar.gz root@你的ECS公网IP:/opt/
```

在服务器上解压：
```bash
ssh root@你的ECS公网IP
mkdir -p /opt/nimbus-chat
cd /opt/nimbus-chat
tar -xzf /opt/nimbus-chat.tar.gz
```

### 2. 一键部署

```bash
cd /opt/nimbus-chat
sudo bash deploy/deploy.sh
```

脚本会自动完成：
- 安装 Node.js 20 LTS / PM2 / Nginx
- `npm install` 安装依赖
- `npm run build` 构建前端
- `npm run build:server` 构建后端
- 配置 Nginx 反代（自动检测公网 IP）
- PM2 启动后端 + 开机自启
- 创建数据目录 `/var/lib/nimbus-chat`

### 3. 配置环境变量（可选但推荐）

```bash
cd /opt/nimbus-chat
cp .env.example .env
vi .env
```

修改 `.env` 中的关键配置：
```bash
PORT=3001
JWT_SECRET=用 openssl rand -hex 32 生成的随机串
DATA_DIR=/var/lib/nimbus-chat
```

改完后重启：
```bash
pm2 restart nimbus-chat
```

### 4. 验证部署

```bash
# 健康检查
curl http://localhost/health
# 期望: {"ok":true,"ts":...}

# 查看 PM2 状态
pm2 status

# 查看实时日志
pm2 logs nimbus-chat

# 查看 Nginx 状态
systemctl status nginx
```

浏览器访问 `http://你的ECS公网IP` 即可看到应用。

### 5. 配置 HTTPS（语音通话必需）

**前提**：有备案域名并解析到 ECS 公网 IP。

```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
certbot --nginx -d 你的域名.com
```

certbot 会自动：
- 申请 Let's Encrypt 免费证书
- 修改 Nginx 配置，80 → 443 跳转
- 配置证书自动续期

完成后访问 `https://你的域名.com`，语音通话功能即可使用。

## 常用运维命令

```bash
# PM2 管理
pm2 status                    # 查看进程状态
pm2 logs nimbus-chat          # 实时日志
pm2 restart nimbus-chat       # 重启
pm2 reload nimbus-chat        # 零停机重载
pm2 stop nimbus-chat          # 停止

# Nginx 管理
nginx -t                       # 测试配置
systemctl reload nginx         # 重载配置
systemctl restart nginx        # 重启

# 数据备份
cp /var/lib/nimbus-chat/store.json /backup/store-$(date +%Y%m%d).json

# 更新代码后重新部署
cd /opt/nimbus-chat
git pull
npm install
npm run build
npm run build:server
pm2 restart nimbus-chat
```

## 安全组配置

在阿里云控制台 → ECS → 安全组，添加入方向规则：

| 端口范围 | 授权对象 | 说明 |
|---------|---------|------|
| 22      | 你的 IP/32 | SSH（建议限制来源） |
| 80      | 0.0.0.0/0 | HTTP |
| 443     | 0.0.0.0/0 | HTTPS |

**不要开放 3001** — 后端只监听 127.0.0.1，通过 Nginx 反代访问。

## 故障排查

### 访问 502 Bad Gateway
后端未启动或崩溃：
```bash
pm2 status          # 检查进程是否在线
pm2 logs nimbus-chat --lines 50  # 查看错误日志
```

### WebSocket 连接失败（消息不实时）
Nginx 的 `/socket.io/` 反代配置缺失或 `Connection upgrade` 头未设置。检查 `/etc/nginx/conf.d/nimbus-chat.conf`。

### 语音通话提示"麦克风不可用"
- 必须通过 HTTPS 访问（或 localhost）
- 浏览器地址栏检查是否已授权麦克风权限
- 确认 Nginx 配置了 HTTPS 证书

### 数据丢失
检查 `DATA_DIR` 环境变量是否指向正确目录：
```bash
pm2 env nimbus-chat | grep DATA_DIR
ls -la /var/lib/nimbus-chat/store.json
```

## 文件清单

```
deploy/
├── deploy.sh           # 一键部署脚本
├── nginx.conf          # Nginx 配置模板
└── README.md           # 本文档

ecosystem.config.cjs    # PM2 进程配置
.env.example            # 环境变量模板
```
