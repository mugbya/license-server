from fastapi import APIRouter, HTTPException, Request
from models import (
    ActivateLicenseRequest,
    VerifyLicenseRequest,
    CreateLicenseKeyRequest,
    BatchReportRequest
)
import database as db

router = APIRouter()


@router.post("/activate")
async def activate(request: Request, req: ActivateLicenseRequest, machine_code: str):
    """Activate a license key"""
    client_ip = request.client.host if request.client else None

    result = await db.activate_license(req.license_key, machine_code)
    if result.get("success"):
        await db.log_usage(machine_code, "activate", req.license_key, client_ip)
        return {"success": True, "data": result}
    await db.log_usage(machine_code, "reject", req.license_key, client_ip)
    raise HTTPException(status_code=400, detail=result.get("error", "Activation failed"))


@router.post("/verify")
async def verify(request: Request, req: VerifyLicenseRequest, machine_code: str):
    """Verify license status"""
    client_ip = request.client.host if request.client else None

    result = await db.verify_license(machine_code, req.license_key)
    await db.log_usage(machine_code, "verify", req.license_key, client_ip)

    if result.get("valid"):
        return {"success": True, "data": result}
    raise HTTPException(status_code=403, detail=result.get("error", "Verification failed"))


@router.post("/report")
async def report_usage(req: BatchReportRequest):
    """Receive batch usage reports from client"""
    # Convert Pydantic models to dicts for database
    reports = [r.model_dump() for r in req.reports]
    result = await db.save_usage_reports(reports)
    return {"success": True, "count": result.get("count", 0)}


@router.get("/stats")
async def get_stats(project: str = None):
    """Get usage statistics (admin only)"""
    stats = await db.get_usage_stats(project)
    return {"success": True, "data": stats}


@router.post("/create_key")
async def create_key(req: CreateLicenseKeyRequest):
    """Create a new license key (admin only - should be protected in production)"""
    # Generate key on backend if not provided
    # license_key = req.license_key
    # if not license_key:
    license_key = db.generate_license_key(req.license_type)

    result = await db.create_license_key(license_key, req.license_type, req.project, req.expires_at)
    if result.get("success"):
        return {
            "success": True,
            "license_key": license_key,  # 返回原始key
            "encoded_key": result.get("encoded_key"),  # 返回加密后的key
            "expires_at": result.get("expires_at")
        }
    raise HTTPException(status_code=400, detail=result.get("error", "Failed to create key"))


@router.post("/revoke")
async def revoke(license_key: str):
    """Revoke a license key"""
    result = await db.revoke_license(license_key)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail="Failed to revoke key")


@router.get("/keys")
async def list_keys(project: str = None):
    """List all license keys (admin only)"""
    keys = await db.get_all_license_keys(project)
    return {"success": True, "data": keys}


@router.get("/keys/stats")
async def get_keys_stats(project: str = None):
    """Get license key statistics (admin only)"""
    stats = await db.get_license_key_stats(project)
    return {"success": True, "data": stats}


@router.post("/trial")
async def get_trial(request: Request, machine_code: str):
    """Get or create trial license for a machine code (no auth required)"""
    client_ip = request.client.host if request.client else None

    # Check if machine already has a trial license
    existing_trial = await db.get_trial_by_machine_code(machine_code)
    if existing_trial:
        # Return existing trial license
        await db.log_usage(machine_code, "trial_reuse", existing_trial["license_key"], client_ip)
        return {
            "success": True,
            "data": {
                "license_key": existing_trial["license_key"],
                "license_type": existing_trial["license_type"],
                "expires_at": existing_trial["expires_at"],
                "is_existing": True
            }
        }

    # Create new trial license for this machine
    trial_key = db.generate_license_key("trial")
    result = await db.create_license_key(trial_key, "trial", "zupu")

    if result.get("success"):
        await db.log_usage(machine_code, "trial_create", trial_key, client_ip)
        return {
            "success": True,
            "data": {
                "license_key": result.get("encoded_key", trial_key),
                "license_type": "trial",
                "expires_at": result.get("expires_at"),
                "is_existing": False
            }
        }

    raise HTTPException(status_code=500, detail=result.get("error", "Failed to create trial license"))