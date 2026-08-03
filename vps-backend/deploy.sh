#!/bin/bash
# 绑定到 VPS 的部署脚本（由 opencode 在本地执行，自动部署到 VPS）
# 用法: bash deploy.sh

set -e

VPS_USER="ai_worker"
VPS_HOST="107.175.44.146"
VPS_PROJECT="/home/ai_worker/stock_project"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 1. SSH 连接验证 ==="
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "echo 'SSH OK'"

echo "=== 2. 上传文件到 VPS ==="
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'data/*.db' \
  --exclude 'data/*.db-journal' \
  --exclude '.env' \
  "${LOCAL_DIR}/" "${VPS_USER}@${VPS_HOST}:${VPS_PROJECT}/"

echo "=== 3. 安装依赖 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && npm install"

echo "=== 4. 复制 .env 配置 ==="
if [ -f "${LOCAL_DIR}/.env" ]; then
  scp "${LOCAL_DIR}/.env" "${VPS_USER}@${VPS_HOST}:${VPS_PROJECT}/.env"
else
  echo "WARNING: .env 文件不存在，请在 VPS 上手动创建"
fi

echo "=== 5. 重启 PM2 进程 ==="
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PROJECT} && pm2 delete donew-backend 2>/dev/null; pm2 start src/index.js --name donew-backend && pm2 save"

echo "=== 6. 验证 ==="
sleep 3
ssh "${VPS_USER}@${VPS_HOST}" "curl -s http://localhost:3000/api/health | python3 -m json.tool || echo 'API 未响应，检查 PM2 日志: pm2 logs donew-backend'"

echo ""
echo "=== 部署完成 ==="
echo "API 健康检查: http://${VPS_HOST}/api/health"
echo "查看日志: pm2 logs donew-backend"
