from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UsageReport(BaseModel):
    app_version: str
    os_name: str
    os_version: str
    public_ip: str
    country: str
    region: str
    city: str
    report_date: str
    project: str  # 项目编码


class BatchReportRequest(BaseModel):
    reports: List[UsageReport]


# Request models
class ActivateLicenseRequest(BaseModel):
    license_key: str


class VerifyLicenseRequest(BaseModel):
    license_key: str


class CreateLicenseKeyRequest(BaseModel):
    license_key: str
    license_type: str  # 'year' | 'permanent'
    project: str = "zupu"  # 项目标识，如 'zupu'
    expires_at: Optional[str] = None  # 自定义到期时间，格式: 'YYYY-MM-DD HH:MM:SS'，为空则按 license_type 自动计算


class CreateProjectRequest(BaseModel):
    name: str
    code: str


class UpdateProjectRequest(BaseModel):
    name: str
    code: str
    disabled: bool