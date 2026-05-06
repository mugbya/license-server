from fastapi import APIRouter, HTTPException, Request, Header
from models import (
    ActivateLicenseRequest,
    VerifyLicenseRequest,
    CreateLicenseKeyRequest,
    BatchReportRequest
)
from pydantic import BaseModel
from dependencies import verify_token
import database as db
import logging

router = APIRouter()
logger = logging.getLogger("license_server")

router = APIRouter()

class DecodeLicenseRequest(BaseModel):
    license_code: str


@router.post("/activate")
async def activate(request: Request, req: ActivateLicenseRequest, machine_code: str):
    """Activate a license key using the short license code.

    Customer provides the short license code (GLY-XXXX-XXXX-XXXX-XXXX) received via email.
    Server returns the auth_code which is RSA encrypted for client local verification.
    """
    client_ip = request.client.host if request.client else None

    result = await db.activate_license(req.license_key, machine_code)
    if result.get("success"):
        await db.log_usage(machine_code, "activate", req.license_key, client_ip)
        return {
            "success": True,
            "data": {
                "license_key": result.get("license_key"),  # Short format for display
                "auth_code": result.get("auth_code"),  # RSA encrypted for client verification
                "license_type": result.get("license_type"),
                "activated_at": result.get("activated_at"),
                "expires_at": result.get("expires_at")
            }
        }
    await db.log_usage(machine_code, "reject", req.license_key, client_ip)
    raise HTTPException(status_code=400, detail=result.get("error", "Activation failed"))


@router.post("/verify")
async def verify(request: Request, req: VerifyLicenseRequest, machine_code: str):
    """Verify license status and get auth code for client"""
    client_ip = request.client.host if request.client else None

    result = await db.verify_license(machine_code, req.license_key)
    logger.info(f"Verify license: key={req.license_key}, machine={machine_code}, result={result}")
    await db.log_usage(machine_code, "verify", req.license_key, client_ip)

    if result.get("valid"):
        return {"success": True, "data": result}
    return {"success": False, "error": result.get("error", "Verification failed"), "data": None}


@router.post("/report")
async def report_usage(req: BatchReportRequest):
    """Receive batch usage reports from client"""
    reports = [r.model_dump() for r in req.reports]
    result = await db.save_usage_reports(reports)
    return {"success": True, "count": result.get("count", 0)}


@router.get("/stats")
async def get_stats(project: str = None, authorization: str = Header(None)):
    """Get usage statistics (admin only)"""
    await verify_token(authorization)
    stats = await db.get_usage_stats(project)
    return {"success": True, "data": stats}


@router.post("/create_key")
async def create_key(req: CreateLicenseKeyRequest, authorization: str = Header(None)):
    """Create a new license key (admin only)."""
    await verify_token(authorization)
    result = await db.create_license_key(req.license_type, req.project, req.expires_at)
    if result.get("success"):
        return {
            "success": True,
            "license_key": result.get("license_key"),
            "auth_code": result.get("auth_code"),
            "expires_at": result.get("expires_at")
        }
    raise HTTPException(status_code=400, detail=result.get("error", "Failed to create key"))


@router.post("/revoke")
async def revoke(license_key: str, authorization: str = Header(None)):
    """Revoke a license key by short license code"""
    await verify_token(authorization)
    result = await db.revoke_license(license_key)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail="Failed to revoke key")


@router.get("/keys")
async def list_keys(project: str = None, authorization: str = Header(None)):
    """List all license keys (admin only)"""
    await verify_token(authorization)
    keys = await db.get_all_license_keys(project)
    return {"success": True, "data": keys}


@router.get("/keys/stats")
async def get_keys_stats(project: str = None, authorization: str = Header(None)):
    """Get license key statistics (admin only)"""
    await verify_token(authorization)
    stats = await db.get_license_key_stats(project)
    return {"success": True, "data": stats}


@router.get("/usage/detail")
async def get_usage_detail(project: str = None, authorization: str = Header(None)):
    """Get usage detail records (admin only)"""
    await verify_token(authorization)
    records = await db.get_usage_detail_records(project)
    return {"success": True, "data": records}


@router.post("/decode")
async def decode_license(req: DecodeLicenseRequest, authorization: str = Header(None)):
    """Decode auth code to get exp/jti/start_at (admin only)."""
    await verify_token(authorization)
    result = db.decode_auth_code(req.license_code)
    if result:
        if result["exp"] == 0:
            return {"success": True, "data": {"exp": 0, "is_permanent": True}}
        return {"success": True, "data": {"exp": result["exp"], "start_at": result["start_at"], "is_permanent": False}}
    return {"success": False, "error": "无效的授权码"}


@router.delete("/usage/record/{machine_code}")
async def delete_usage_record(machine_code: str, authorization: str = Header(None)):
    """Delete usage record by machine code (admin only)"""
    await verify_token(authorization)
    result = await db.delete_usage_record(machine_code)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "删除失败"))


@router.delete("/usage/detail/{id}")
async def delete_usage_detail(id: int, authorization: str = Header(None)):
    """Delete usage detail record by id (admin only)"""
    await verify_token(authorization)
    result = await db.delete_usage_detail(id)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "删除失败"))


@router.post("/trial")
async def get_trial(request: Request, machine_code: str):
    """Get or create trial license for a machine code (no auth required).

    Client calls this on first startup to get a trial license.
    Server generates short license key, auto-activates with machine code,
    and returns auth_code for client local verification.
    """
    client_ip = request.client.host if request.client else None

    # Check if machine already has a trial license
    existing_trial = await db.get_trial_by_machine_code(machine_code)
    if existing_trial:
        # Generate auth code for existing trial
        await db.log_usage(machine_code, "trial_reuse", existing_trial["license_key"], client_ip)
        auth_code = db.encode_auth_code(
            existing_trial["license_key"],
            existing_trial["license_type"],
            existing_trial["expires_at"],
            existing_trial["activated_at"]
        )
        return {
            "success": True,
            "data": {
                "license_key": existing_trial["license_key"],  # Short format for display
                "auth_code": auth_code,  # RSA encrypted for client verification
                "license_type": existing_trial["license_type"],
                "activated_at": existing_trial["activated_at"],
                "expires_at": existing_trial["expires_at"],
                "is_existing": True
            }
        }

    # Create new trial license
    # Step 1: Create short license key in database
    result = await db.create_license_key("trial", "zupu")

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to create trial license"))

    trial_key = result.get("license_key")

    # Step 2: Activate with machine code
    activate_result = await db.activate_license(trial_key, machine_code)
    if not activate_result.get("success"):
        raise HTTPException(status_code=500, detail="Failed to activate trial license")

    await db.log_usage(machine_code, "trial_create", trial_key, client_ip)

    return {
        "success": True,
        "data": {
            "license_key": trial_key,  # Short format for display
            "auth_code": activate_result.get("auth_code"),  # RSA encrypted for client verification
            "license_type": "trial",
            "activated_at": activate_result.get("activated_at"),
            "expires_at": activate_result.get("expires_at"),
            "is_existing": False
        }
    }
