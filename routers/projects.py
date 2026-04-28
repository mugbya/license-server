from fastapi import APIRouter, HTTPException
from models import CreateProjectRequest, UpdateProjectRequest
import database as db

router = APIRouter()


@router.get("/")
async def list_projects():
    """Get all projects"""
    projects = await db.get_all_projects()
    return {"success": True, "data": projects}


@router.get("/{project_id}")
async def get_project(project_id: int):
    """Get project by ID"""
    project = await db.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"success": True, "data": project}


@router.post("/")
async def create_project(req: CreateProjectRequest):
    """Create a new project"""
    result = await db.create_project(req.name, req.code)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "创建失败"))


@router.put("/{project_id}")
async def update_project(project_id: int, req: UpdateProjectRequest):
    """Update a project"""
    result = await db.update_project(project_id, req.name, req.code, req.disabled)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "更新失败"))


@router.delete("/{project_id}")
async def delete_project(project_id: int):
    """Delete a project"""
    result = await db.delete_project(project_id)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "删除失败"))
