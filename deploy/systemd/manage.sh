#!/bin/bash
# License Server 管理脚本

SERVICE_NAME="license-server"

case "$1" in
    start)
        sudo systemctl start $SERVICE_NAME
        echo "服务已启动"
        ;;
    stop)
        sudo systemctl stop $SERVICE_NAME
        echo "服务已停止"
        ;;
    restart)
        sudo systemctl restart $SERVICE_NAME
        echo "服务已重启"
        ;;
    status)
        sudo systemctl status $SERVICE_NAME
        ;;
    logs)
        sudo journalctl -u $SERVICE_NAME -f --lines=100
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
