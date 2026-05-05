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


class CreateProjectRequest(BaseModel):
    name: str
    code: str


class UpdateProjectRequest(BaseModel):
    name: str
    code: str
    disabled: bool