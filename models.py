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