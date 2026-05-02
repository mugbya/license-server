#!/usr/bin/env python3
"""Generate RSA keys and create private.py configuration file"""
import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

print("=" * 60)
print("License Server 配置生成器")
print("=" * 60)

# Generate RSA private key (2048 bits)
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)

# Generate public key
public_key = private_key.public_key()

# Serialize private key to PEM format
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
)

# Serialize public key to PEM format
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

private_pem_str = private_pem.decode()
public_pem_str = public_pem.decode()

# Create private.py content
private_py_content = f'''# Private configuration - DO NOT commit to git
# 请修改以下配置值为你的实际值

# JWT secret (生产环境请修改为随机字符串)
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

# 默认管理员账号密码 (首次登录后请修改)
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"

# RSA 私钥 (自动生成)
LICENSE_PRIVATE_KEY = """{private_pem_str}"""

# RSA 公钥 (自动生成，提供给客户端软件使用)
LICENSE_PUBLIC_KEY = """{public_pem_str}"""
'''

# Create backend/private.py
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
private_py_path = os.path.join(backend_dir, "private.py")

# Backup existing file if exists
if os.path.exists(private_py_path):
    backup_path = private_py_path + ".bak"
    print(f"检测到已存在的 private.py，备份到: {backup_path}")
    os.rename(private_py_path, backup_path)

# Write new private.py
with open(private_py_path, 'w') as f:
    f.write(private_py_content)

print(f"\n已创建: {private_py_path}")

print("\n" + "=" * 60)
print("公钥 (嵌入到客户端代码中用于验证授权码):")
print("=" * 60)
print(public_pem_str)

print("=" * 60)
print("公钥 (单行格式，便于复制):")
print("=" * 60)
print(repr(public_pem_str))

print("\n" + "=" * 60)
print("下一步操作:")
print("=" * 60)
print("1. 检查并修改 backend/private.py 中的配置:")
print("   - JWT_SECRET (生产环境必改)")
print("   - DEFAULT_ADMIN_PASSWORD (首次登录后必改)")
print("")
print("2. 公钥已保存到 backend/private.py 中的 LICENSE_PUBLIC_KEY")
print("   客户端软件直接使用该公钥验证授权码")
print("")
print("3. 启动服务:")
print("   cd backend")
print("   python -m venv .venv")
print("   source .venv/bin/activate")
print("   pip install -r requirements.txt")
print("   gunicorn -c gunicorn.conf.py main:app")
print("")
print("=" * 60)
