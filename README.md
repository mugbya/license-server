# License Server - 通用授权管理系统

<!-- 截图预留位置 -->
<!-- ![授权管理界面] -->

一个通用的软件授权管理系统，适用于任何需要许可证管理的软件项目。支持多种授权类型、机器绑定、使用统计、软件使用、项目隔离等功能。

## 功能特性

- **多种授权类型**：年度授权、永久授权、自定义授权、试用授权
- **机器绑定**：授权码与机器码绑定，支持激活/验证
- **JWT 授权码**：使用 RSA 签名确保授权码不可伪造
- **使用统计**：记录并统计客户端使用上报数据
- **项目管理**：支持多项目隔离管理
- **日志记录**：完整的请求日志，便于问题排查
- **通用设计**：适用于任何软件项目的授权管理

## 系统要求

- Python 3.9+
- SQLite 3

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成 RSA 密钥（重要）

**运行 `generate_keys.py` 自动生成密钥并创建 `private.py`**：

```bash
python generate_keys.py
```

脚本会自动：
- 生成 RSA 2048 位密钥对
- 在 `backend/private.py` 中创建 JWT_SECRET、默认管理员账号密码和私钥配置
- 输出公钥供客户端嵌入使用

**重要：请修改 `backend/private.py` 中的以下配置：**
- `JWT_SECRET`: 生产环境请改为随机字符串
- `DEFAULT_ADMIN_PASSWORD`: 首次登录后请修改

### 3. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python main.py
```

服务启动后访问 `http://localhost:8080`

### 4. 登录管理后台

默认账号：`admin` / `admin123`（首次登录后请修改）

## API 接口

### 授权管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/license/create_key` | POST | 创建授权码 |
| `/api/license/activate` | POST | 激活授权 |
| `/api/license/verify` | POST | 验证授权 |
| `/api/license/decode` | POST | 解码授权码 |
| `/api/license/revoke` | POST | 撤销授权 |
| `/api/license/keys` | GET | 授权码列表 |
| `/api/license/stats` | GET | 使用统计 |
| `/api/license/trial` | GET | 获取试用授权 |

### 管理员

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/change_password` | POST | 修改密码 |

### 项目管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET/POST | 项目列表/创建 |
| `/api/projects/{id}` | PUT/DELETE | 更新/删除项目 |

## 部署方式

### Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建
docker-compose up -d --build
```

### Systemd + Gunicorn 部署（腾讯云轻量服务器推荐）

适用于 2核2G 服务器，使用 systemd 管理进程。

**目录结构**：
```
/opt/license-server/
├── backend/
│   ├── main.py
│   ├── gunicorn.conf.py
│   ├── logs/
│   └── data/
└── frontend/
```

**快速部署**：
```bash
# 上传代码后，进入 deploy/systemd 目录
cd deploy/systemd
chmod +x setup.sh manage.sh
sudo ./setup.sh
```

**管理命令**：
```bash
cd /opt/license-server/deploy/systemd
sudo ./manage.sh status   # 查看状态
sudo ./manage.sh logs     # 查看日志
sudo ./manage.sh restart  # 重启服务
sudo ./manage.sh stop     # 停止服务
```



---



## Nginx 反向代理部署

使用 Nginx 作为前端静态文件和后端 API 的统一入口。

### 安装 Nginx

```bash
sudo apt install nginx
```

### 部署配置

```bash
# 复制 Nginx 配置
sudo cp deploy/nginx/license-server.conf /etc/nginx/sites-available/license-server

# 启用站点
sudo ln -s /etc/nginx/sites-available/license-server /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 前端构建

```bash
cd /opt/license-server/frontend
npm install
npm run build
```

### 访问方式

- HTTP: `http://服务器IP/`
- API: `http://服务器IP/api/`

### HTTPS 配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期已配置
```
## GitHub 自动部署

代码推送到 main 分支时自动部署到服务器。

### 1. 配置 GitHub Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `SERVER_HOST` | 服务器 IP | `123.45.67.89` |
| `SERVER_USER` | SSH 用户名 | `ubuntu` |
| `SERVER_PASSWORD` | SSH 密码或密钥 | `your-password` |
| `SERVER_PORT` | SSH 端口 | `22` |

### 2. 服务器准备

```bash
# 安装基础软件 (CentOS/Rocky)
sudo yum install -y git

# 安装 Node.js 18.x (用于构建前端)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
node --version  # 确认版本

# 确保有 /opt/license-server 目录
sudo mkdir -p /opt/license-server

# 初始化 git 仓库（如果还没有）
cd /opt/license-server
git init
git remote add origin https://github.com/你的用户名/license-server.git
git pull origin main

# 手动运行一次部署脚本
cd deploy/systemd
chmod +x setup.sh manage.sh
sudo ./setup.sh
```

### 3. 推送代码自动部署

```bash
git add .
git commit -m "update"
git push origin main
```

推送后访问 GitHub Actions 页面查看部署进度。

### 4. 手动触发部署

在 GitHub 仓库 Actions 页面点击 "Deploy to Server" → "Run workflow"

## 授权码格式

### 生成时同时产生两个码

| 名称 | 格式 | 用途 | 发送方式 |
|------|------|------|----------|
| **license_key**（许可证） | `GLY-XXXX-XXXX-XXXX-XXXX` | 客户激活用 | 邮件/短信等外部渠道 |
| **auth_code**（授权码） | `GLY-{header}.{payload}.{signature}` | 客户端本地验签 | 激活时返回给客户端 |

### license_key 格式
```
GLY-XXXX-XXXX-XXXX-XXXX
```
- `GLY`: 年度授权
- `GLT`: 试用授权
- `GLC`: 自定义授权
- `GLP`: 永久授权

### auth_code 格式 (JWT RS256)
```
GLY-eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3MDk4MzIwMDAsImp0aSI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTUxMjM0NTY3ODkwIn0.SIGNATURE
```
包含过期时间、JTI (唯一标识)、激活时间。

### 授权验证完整流程

```
1. 服务端生成 → license_key + auth_code（同时生成）

2. 服务端把 license_key 发给客户（邮件/短信）

3. 客户调用 /api/license/activate(license_key, machine_code)

4. 服务端返回 auth_code 给客户端

5. 客户端用公钥解码 auth_code，检查 exp 是否过期
```

## 使用流程

```
1. 登录管理后台
2. 项目管理 → 创建项目 (如 "我的软件A")
3. 在顶部切换到目标项目
4. 生成授权码 → 选择授权类型 → 系统同时生成 license_key 和 auth_code
5. 将 license_key 发送给客户（邮件/短信）
6. 客户使用 license_key 激活软件，服务端返回 auth_code
7. 客户端本地用公钥验签 auth_code，检查过期时间
```

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                          │
│                   http://服务器IP/                        │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (端口 80)                    │
│  ┌───────────────────┬─────────────────────────────────┐ │
│  │   静态文件服务     │        API 代理                  │ │
│  │   /frontend/dist  │        /api/* → :8080          │ │
│  └───────────────────┴─────────────────────────────────┘ │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Gunicorn + UvicornWorker (端口 8080)          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    FastAPI 后端                      │   │
│  │   /api/license/*  /api/admin/*  /api/projects/*   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLite 数据库                           │
│                   backend/.license_server.db               │
└─────────────────────────────────────────────────────────────┘
```

### 访问流程

| 访问路径 | 服务 | 说明 |
|---------|------|------|
| `http://服务器IP/` | Nginx | 前端管理页面 |
| `http://服务器IP/api/*` | Nginx → Gunicorn | 后端 API |

### 端口配置

| 组件 | 默认端口 | 配置位置 |
|------|---------|----------|
| Nginx | 80 | `/etc/nginx/conf.d/license-server.conf` |
| Gunicorn | 8080 | `backend/config.py` |

### 重启服务

```bash
# 重启后端
sudo systemctl restart license-server

# 重载 Nginx
sudo systemctl reload nginx
```

## 目录结构

```
license-server/
├── .github/                      # GitHub 配置
│   └── workflows/
│       └── deploy.yml            # 自动部署工作流
├── backend/                     # 后端目录
│   ├── main.py                   # FastAPI 入口
│   ├── config.py                 # 配置文件
│   ├── database.py               # 数据库操作
│   ├── models.py                 # 数据模型
│   ├── private.py                # ⚠️ 敏感配置 (由 generate_keys.py 自动生成，不提交到 git)
│   ├── requirements.txt          # Python 依赖
│   ├── gunicorn.conf.py          # Gunicorn 配置
│   └── routers/                  # API 路由
│       ├── admin.py              # 管理员接口
│       ├── license.py            # 授权接口
│       └── projects.py           # 项目接口
├── frontend/                     # 前端目录
│   ├── src/                      # React 源码
│   │   ├── pages/                # React 页面
│   │   └── ...
│   ├── index.html
│   ├── package.json
│   └── ...
├── deploy/                       # 部署配置
│   ├── systemd/                  # Systemd 部署
│   │   ├── setup.sh              # 安装脚本
│   │   └── manage.sh             # 管理脚本
│   └── nginx/                    # Nginx 配置
│       ├── license-server.conf   # HTTP 配置
│       └── license-server-ssl.conf # HTTPS 配置
├── generate_keys.py              # RSA 密钥生成脚本
├── docker-compose.yml            # Docker 部署配置
├── README.md
└── README_EN.md
```

## 配置说明

### 授权默认配置 (config.py)

```python
YEAR_LICENSE_DAYS = 365      # 年度授权天数
TRIAL_LICENSE_UNIT = "minute" # 试用时间单位: day/hour/minute
TRIAL_LICENSE_VALUE = 3       # 试用时间值
```

### CORS 配置 (main.py)

如需限制浏览器访问来源，修改 `allow_origins`：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://你的服务器IP:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 安全说明

- **必须创建 `private.py`** 并配置敏感信息
- `private.py` 已加入 `.gitignore`，请勿提交到版本控制
- 生产环境请修改默认管理员密码和 JWT secret
- 使用 `generate_keys.py` 生成新的 RSA 密钥对
- 建议使用 HTTPS 访问生产服务


## 许可证

Apache License 2.0
