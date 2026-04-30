# License Server - 通用授权管理系统

<!-- 截图预留位置 -->
<!-- ![授权管理界面] -->

一个通用的软件授权管理系统，适用于任何需要许可证管理的软件项目。支持多种授权类型、机器绑定、使用统计、项目隔离等功能。

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

### 2. 配置 private.py（重要）

**必须创建 `private.py` 文件**，复制以下内容并修改相应值：

```python
# private.py - 敏感配置 (不提交到 git)

# JWT secret (生产环境请修改)
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

# 默认管理员账号密码 (首次登录后请修改)
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"

# RSA 私钥 (用于授权码签名)
# 运行 generate_keys.py 生成新的密钥对
LICENSE_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
在此粘贴你的私钥
-----END RSA PRIVATE KEY-----"""
```

### 3. 生成 RSA 密钥（重要）

`generate_keys.py` 用于生成 RSA 密钥对：
- **私钥**：保存在 `private.py` 中，用于服务器签名授权码
- **公钥**：嵌入到客户端软件中，用于验证授权码

运行生成脚本：
```bash
python generate_keys.py
```

将输出的私钥粘贴到 `private.py`，公钥嵌入到客户端代码中。

### 4. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python main.py
```

服务启动后访问 `http://localhost:8080`

### 5. 启动前端服务（开发模式）

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器启动后访问 `http://localhost:9527`

> 生产环境可使用 `npm run build` 构建后部署

### 6. 登录管理后台

<!-- 截图预留位置 -->
<!-- ![登录界面] -->

默认账号：`admin` / `admin123`

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
# 确保 git 已安装
sudo apt install git

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

### 短格式 (license_key)
```
GLY-XXXX-XXXX-XXXX-XXXX
```
- `GLY`: 年度授权
- `GLT`: 试用授权
- `GLC`: 自定义授权
- `GLP`: 永久授权

### JWT 格式 (auth_code)
```
GLY-eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3MDk4MzIwMDAsImp0aSI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTUxMjM0NTY3ODkwIn0.SIGNATURE
```
包含过期时间、JTI (唯一标识)、激活时间。

## 使用流程

```
1. 登录管理后台
2. 项目管理 → 创建项目 (如 "我的软件A")
3. 在顶部切换到目标项目
4. 生成授权码 → 选择授权类型
5. 将授权码发送给客户
6. 客户使用授权码激活软件
```

## 目录结构

```
license-server/
├── backend/              # 后端目录
│   ├── main.py           # FastAPI 入口
│   ├── config.py        # 配置文件
│   ├── database.py      # 数据库操作
│   ├── models.py        # 数据模型
│   ├── private.py        # ⚠️ 敏感配置 (需手动创建，不提交到 git)
│   ├── requirements.txt  # Python 依赖
│   └── routers/          # API 路由
│       ├── admin.py      # 管理员接口
│       ├── license.py    # 授权接口
│       └── projects.py   # 项目接口
├── frontend/             # 前端目录
│   ├── src/              # React 源码
│   │   └── pages/        # React 页面
│   └── ...
├── generate_keys.py      # RSA 密钥生成脚本
└── logs/                # 日志目录
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
