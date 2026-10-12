from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UsageReport(BaseModel):
    machine_code: str  # 机器码
    project: str  # 项目编码
    public_ip: str
    country: str
    region: str
    city: str
    app_version: str = ""
    os_name: str = ""
    os_version: str = ""


class BatchReportRequest(BaseModel):
    reports: List[UsageReport]


# Request models
class ActivateLicenseRequest(BaseModel):
    license_key: str


class VerifyLicenseRequest(BaseModel):
    license_key: str


class CreateLicenseKeyRequest(BaseModel):
    # license_key: Optional[str] = None  # 不传则由后端自动生成
    license_type: str  # 'year' | 'permanent' | 'trial' | 'custom'
    project: str = "zupu"  # 项目标识，如 'zupu'
    expires_at: Optional[str] = None  # 自定义到期时间，格式: 'YYYY-MM-DD HH:MM:SS'，为空则按 license_type 自动计算


class CreateOfflineRequest(BaseModel):
    """离线授权（网络隔绝环境）：按客户端导出的申请文件签发授权包"""
    license_type: str
    project: str = "zupu"
    machine_code: str  # 客户端「导出申请文件」里的机器码
    expires_at: Optional[str] = None  # 自定义到期时间，为空则按 license_type 自动计算


class CreateProjectRequest(BaseModel):
    name: str
    code: str


class UpdateProjectRequest(BaseModel):
    name: str
    code: str
    disabled: bool