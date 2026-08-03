#!/bin/bash
# VPS 首次部署脚本：系统初始化 + Nginx + Node.js + PM2
# 在 VPS 上以 sudo 身份运行

set -e

echo "=== 创建 SWAP ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "=== 安装基础环境 ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip sqlite3 nginx build-essential python3

echo "=== 安装 Node.js 20.x ==="
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "=== 安装 PM2 ==="
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

echo "=== 创建项目目录 ==="
PROJECT_DIR=/home/$USER/stock_project
mkdir -p "$PROJECT_DIR"
echo "项目目录: $PROJECT_DIR"

echo "=== 配置 Nginx ==="
sudo tee /etc/nginx/sites-available/stock > /dev/null << 'NGINX'
server {
    listen 80;
    server_name 107.175.44.146;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/stock /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "=== 配置 PM2 自启 ==="
pm2 startup

echo "=== 配置 UFW ==="
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "=== 完成 ==="
echo "node: $(node -v)"
echo "npm: $(npm -v)"
echo "pm2: $(pm2 -v)"
echo "项目目录: $PROJECT_DIR"
echo "下一步: scp 上传代码到 VPS，然后 npm install && pm2 start"
