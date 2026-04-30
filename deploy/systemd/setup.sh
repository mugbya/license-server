#!/bin/bash
# License Server systemd 部署脚本
# 适用于腾讯云轻量服务器 (2核2G)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_USER="www-data"
SERVICE_NAME="license-server"

echo "===== License Server 部署脚本 ====="
echo "项目目录: $APP_DIR"

# 1. 创建应用目录
echo "[1/6] 创建应用目录..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $APP_DIR/backend/logs
sudo mkdir -p $APP_DIR/backend/data

# 2. 复制代码（排除敏感文件）
echo "[2/6] 复制代码..."
sudo cp -r backend/* $APP_DIR/backend/
sudo cp -r frontend/* $APP_DIR/frontend/ 2>/dev/null || true

# 3. 创建虚拟环境
echo "[3/6] 创建虚拟环境..."
cd $APP_DIR/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 4. 设置权限
echo "[4/6] 设置权限..."
sudo useradd -r -s /bin/false $SERVICE_USER 2>/dev/null || true
sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
sudo chmod -R 755 $APP_DIR

# 5. 安装 systemd 服务
echo "[5/6] 安装 systemd 服务..."
sudo cp deploy/systemd/$SERVICE_NAME.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

# 6. 启动服务
echo "[6/6] 启动服务..."
sudo systemctl start $SERVICE_NAME

# 检查状态
if systemctl is-active --quiet $SERVICE_NAME; then
    echo ""
    echo "===== 部署成功 ====="
    echo "服务状态: 运行中"
    echo "访问地址: http://localhost:8080"
    echo ""
    echo "常用命令:"
    echo "  systemctl status $SERVICE_NAME  # 查看状态"
    echo "  systemctl restart $SERVICE_NAME  # 重启服务"
    echo "  systemctl stop $SERVICE_NAME     # 停止服务"
    echo "  journalctl -u $SERVICE_NAME -f   # 查看日志"
else
    echo "===== 部署失败 ====="
    echo "请检查: journalctl -u $SERVICE_NAME"
    exit 1
fi
