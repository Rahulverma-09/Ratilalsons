from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from datetime import datetime
from bson import ObjectId
from app.database import sites_collection as sites_collection_dep, tasks_collection as tasks_collection_dep
from app.database.schemas.sites_schema import SiteModel, SiteCreateModel, SiteUpdateModel
from app.dependencies import get_current_user, admin_required

site_router = APIRouter(
    prefix="/api/sites",
    tags=["Sites"]
)

def obj_id_to_str(doc):
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc["site_id"] = doc["id"]
    doc.setdefault("generator_ids", [])
    doc.setdefault("assigned_employee_id", None)
    doc.setdefault("status", "Inactive")
    doc["last_updated"] = doc.pop("lastUpdated", None)
    doc["site_name"] = doc.get("site_name")
    return doc

def find_site_by_employee(employee_id, sites_collection, exclude_site=None):
    query = {"assigned_employee_id": employee_id}
    if exclude_site:
        query["_id"] = {"$ne": ObjectId(exclude_site)}
    return sites_collection.find_one(query)

def get_site_name(site_id, sites_collection):
    if site_id and ObjectId.is_valid(site_id):
        site = sites_collection.find_one({"_id": ObjectId(site_id)})
        if site:
            return site.get("site_name") or site.get("name") or "Unnamed Site"
    return None

@site_router.post(
    "/",
    response_model=SiteModel,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user), Depends(admin_required)],
    summary="Create a site",
    description="Admin only. Create a new site in the system."
)
async def create_site(site: SiteCreateModel, sites_collection=Depends(sites_collection_dep)):
    doc = site.dict(exclude_unset=True)
    doc.setdefault("generator_ids", [])
    doc.setdefault("assigned_employee_id", None)
    doc.setdefault("status", "Inactive")
    emp_id = doc.get("assigned_employee_id")
    if emp_id:
        assigned = find_site_by_employee(emp_id, sites_collection)
        if assigned:
            raise HTTPException(status_code=400, detail="Employee already assigned to another site.")
    doc["lastUpdated"] = datetime.utcnow().isoformat()
    result = sites_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return obj_id_to_str(doc)

@site_router.get(
    "/",
    response_model=List[SiteModel],
    dependencies=[Depends(get_current_user), Depends(admin_required)],
    summary="Get all sites",
    description="Admin only. Retrieve all sites."
)
async def get_all_sites(sites_collection=Depends(sites_collection_dep)):
    return [obj_id_to_str(site) for site in sites_collection.find()]

@site_router.get(
    "/{site_id}",
    response_model=SiteModel,
    dependencies=[Depends(get_current_user)],
    summary="Get site by ID",
    description="Get details of a specific site by site ID (not admin-protected)."
)
async def get_site(site_id: str, sites_collection=Depends(sites_collection_dep)):
    if not ObjectId.is_valid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    doc = sites_collection.find_one({"_id": ObjectId(site_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Site not found")
    return obj_id_to_str(doc)

@site_router.put(
    "/{site_id}",
    response_model=SiteModel,
    dependencies=[Depends(get_current_user), Depends(admin_required)],
    summary="Update site",
    description="Admin only. Update details of a site."
)
async def update_site(site_id: str, update: SiteUpdateModel, sites_collection=Depends(sites_collection_dep)):
    if not ObjectId.is_valid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    old = sites_collection.find_one({"_id": ObjectId(site_id)})
    if not old:
        raise HTTPException(status_code=404, detail="Site not found")
    new_data = update.dict(exclude_unset=True)
    new_data["lastUpdated"] = datetime.utcnow().isoformat()
    new_data.setdefault("generator_ids", old.get("generator_ids", []))
    new_data.setdefault("assigned_employee_id", old.get("assigned_employee_id"))
    new_data.setdefault("status", old.get("status", "Inactive"))
    emp_id = new_data.get("assigned_employee_id")
    if emp_id:
        assigned = find_site_by_employee(emp_id, sites_collection, exclude_site=site_id)
        if assigned:
            raise HTTPException(status_code=400, detail="Employee already assigned to another site.")
    sites_collection.update_one({"_id": ObjectId(site_id)}, {"$set": new_data})
    updated = sites_collection.find_one({"_id": ObjectId(site_id)})
    return obj_id_to_str(updated)

@site_router.delete(
    "/{site_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_user), Depends(admin_required)],
    summary="Delete site",
    description="Admin only. Delete a site from the system."
)
async def delete_site(site_id: str, sites_collection=Depends(sites_collection_dep)):
    if not ObjectId.is_valid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    res = sites_collection.delete_one({"_id": ObjectId(site_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Site not found")
    return None

@site_router.post(
    "/{site_id}/assign-employee",
    response_model=SiteModel,
    dependencies=[Depends(get_current_user), Depends(admin_required)],
    summary="Assign employee to site",
    description="Admin only. Assign an employee to a site."
)
async def assign_employee_to_site(
    site_id: str,
    employee_id: str,
    sites_collection=Depends(sites_collection_dep),
):
    if not ObjectId.is_valid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    old = sites_collection.find_one({"_id": ObjectId(site_id)})
    if not old:
        raise HTTPException(status_code=404, detail="Site not found")
    assigned = find_site_by_employee(employee_id, sites_collection, exclude_site=site_id)
    if assigned:
        raise HTTPException(status_code=400, detail="Employee already assigned to another site.")
    update_fields = {
        "assigned_employee_id": employee_id,
        "lastUpdated": datetime.utcnow().isoformat()
    }
    sites_collection.update_one({"_id": ObjectId(site_id)}, {"$set": update_fields})
    updated = sites_collection.find_one({"_id": ObjectId(site_id)})
    return obj_id_to_str(updated)

@site_router.get(
    "/tasks/mytasks",
    response_model=List[dict],
    dependencies=[Depends(get_current_user)],
    summary="Get my assigned tasks",
    description="Get all tasks assigned to the current authenticated user (includes site name join)."
)
async def get_my_tasks(
    tasks_collection=Depends(tasks_collection_dep),
    sites_collection=Depends(sites_collection_dep),
    current_user=Depends(get_current_user)
):
    user_tasks = list(tasks_collection.find({"assigned_to": current_user["user_id"]}))
    enhanced_tasks = []
    for task in user_tasks:
        task_out = dict(task)
        task_out["id"] = str(task_out.pop("_id"))
        # Look up site_name via site_id join
        task_out["site_name"] = get_site_name(task_out.get("linked_id"), sites_collection)
        enhanced_tasks.append(task_out)
    return enhanced_tasks
