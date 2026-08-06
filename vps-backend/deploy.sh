#!/bin/bash
# 绑定到 VPS 的安全部署脚本（由本地执行，VPS 从 GitHub 更新）
# 用法: bash deploy.sh

set -e

VPS_USER="ai_worker"
VPS_HOST="107.175.44.146"
VPS_PROJECT="/home/ai_worker/stock_project"
echo "=== 1. SSH 连接验证 ==="
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "echo 'SSH OK'"

echo "=== 2. 拉取 GitHub 最新代码 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && git pull"

echo "=== 3. 同步规范后端到 PM2 运行目录 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && rsync -a vps-backend/src/ src/ && cp vps-backend/package.json package.json"

echo "=== 4. 安装依赖 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && npm install"

echo "=== 5. 重启 PM2 进程 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && pm2 restart donew-backend && pm2 save"

echo "=== 6. 验证 ==="
sleep 3
ssh "${VPS_USER}@${VPS_HOST}" "curl -s http://localhost:3000/api/health | python3 -m json.tool || echo 'API 未响应，检查 PM2 日志: pm2 logs donew-backend'"

echo ""
echo "=== 部署完成 ==="
echo "API 健康检查: http://${VPS_HOST}/api/health"
echo "查看日志: pm2 logs donew-backend"
