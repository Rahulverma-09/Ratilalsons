from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.database.schemas.task_schema import TaskModel, TaskStatusUpdate, TaskUpdate, TaskSchema
from app.database import tasks_collection, employees_collection, sites_collection
from ..database import get_database
from datetime import datetime, date
from typing import List, Optional
from app.services.hierarchy_helper import HierarchyHelper
from app.dependencies import get_current_user, admin_required
import logging
from bson import ObjectId
from pydantic import ValidationError

logger = logging.getLogger(__name__)
task_router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

@task_router.get("/test-auth", response_model=dict)
async def test_auth(current_user: dict = Depends(get_current_user)):
    """
    Test endpoint to verify authentication is working.
    """
    return {
        "message": "Authentication successful",
        "user_id": current_user.get("user_id"),
        "username": current_user.get("username"),
        "roles": current_user.get("roles", []),
        "role_ids": current_user.get("role_ids", [])
    }

def ensure_datetime(d):
    if isinstance(d, date) and not isinstance(d, datetime):
        return datetime.combine(d, datetime.min.time())
    return d

def ensure_datetime_recursive(obj):
    if isinstance(obj, dict):
        return {k: ensure_datetime_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [ensure_datetime_recursive(item) for item in obj]
    else:
        return ensure_datetime(obj)

def generate_task_id(tasks_coll):
    last_task = tasks_coll.find_one(
        {"id": {"$regex": "^tsk-\\d+$"}},
        sort=[("created_at", -1)]
    )
    if last_task and "id" in last_task:
        try:
            last_num = int(last_task["id"].split("-")[1])
            new_num = last_num + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    return f"tsk-{new_num:02d}"

def get_employee_name(user_code):
    emp = employees_collection.find_one({"user_id": user_code})
    if emp:
        return emp.get("full_name") or emp.get("name") or emp.get("username") or emp.get("email") or str(user_code)
    return str(user_code)

# ---- Helper receives sites_coll (collection object)
def get_site_name(linked_id, sites_coll):
    if linked_id and ObjectId.is_valid(str(linked_id)):  # ensure string for ObjectId
        site = sites_coll.find_one({"_id": ObjectId(str(linked_id))})
        if site:
            return site.get("site_name") or site.get("name") or "Unnamed Site"
    return None

def format_task_out(task, sites_coll):
    out = dict(task)
    # Remove MongoDB ObjectId from response
    if "_id" in out:
        del out["_id"]
    
    # Add site name for display purposes
    out["site_name"] = get_site_name(task.get("linked_id"), sites_coll)
    
    # Handle date formatting
    if isinstance(out.get("assigned_date"), datetime):
        out["assigned_date"] = out["assigned_date"].date()
    elif isinstance(out.get("assigned_date"), str):
        try:
            out["assigned_date"] = datetime.fromisoformat(out["assigned_date"]).date()
        except:
            pass
    
    if out.get("approved_at") and isinstance(out["approved_at"], datetime):
        out["approved_at"] = out["approved_at"]
    
    # Ensure all schema fields are present with defaults
    schema_defaults = {
        "description": None,
        "priority": None,
        "timeSpent": None,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "remarks": None,
        # Required fields with proper defaults
        "assigned_at": "General Site",  # Default site name
        "assigned_by": "System Admin"   # Default assignor
    }
    
    for field, default_value in schema_defaults.items():
        if field not in out or out[field] is None:
            out[field] = default_value
    
    return out

# -- ADMIN ROUTES: Only admins --

@task_router.post("/", response_model=TaskModel, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user), Depends(admin_required)])
async def create_task(
    task: TaskModel,
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    try:
        # Validate required fields from schema
        if not task.title:
            raise HTTPException(status_code=400, detail="Task title is required")
        if not task.assigned_to:
            raise HTTPException(status_code=400, detail="assigned_to is required")
        if not task.assigned_at:
            raise HTTPException(status_code=400, detail="assigned_at (site name) is required")
        if not task.assigned_by:
            raise HTTPException(status_code=400, detail="assigned_by is required")
        
        # Verify assigned employee exists
        assigned_to_code = task.assigned_to
        emp_name = get_employee_name(assigned_to_code)
        if not emp_name:
            raise HTTPException(status_code=400, detail=f"Employee with ID {assigned_to_code} not found")

        # Prepare task document
        task_dict = task.dict(exclude_unset=True)
        task_dict = ensure_datetime_recursive(task_dict)
        
        # Set system fields
        task_dict["assigned_to_name"] = emp_name
        task_dict["created_at"] = datetime.utcnow()
        task_dict["id"] = generate_task_id(tasks_coll)
        
        # Set assigned_date to current date if not provided
        if not task_dict.get("assigned_date"):
            task_dict["assigned_date"] = date.today()
        
        # Ensure status has default value
        if not task_dict.get("status"):
            task_dict["status"] = "pending"
        
        # Insert task
        result = tasks_coll.insert_one(task_dict)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create task")
        
        # Retrieve and return created task
        created_task = tasks_coll.find_one({"id": task_dict["id"]})
        return format_task_out(created_task, sites_coll)
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while creating task")

@task_router.put("/{task_id}", response_model=TaskModel, dependencies=[Depends(get_current_user), Depends(admin_required)])
async def update_task_admin(
    task_id: str,
    update: TaskModel,
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """Update a task completely (admin only). All fields can be updated."""
    try:
        # Find existing task
        task = tasks_coll.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Validate assigned_to if being updated
        if update.assigned_to:
            emp_name = get_employee_name(update.assigned_to)
            if not emp_name:
                raise HTTPException(status_code=400, detail=f"Employee with ID {update.assigned_to} not found")

        # Prepare update document
        update_dict = update.dict(exclude_unset=True)
        update_dict = ensure_datetime_recursive(update_dict)
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update assigned_to_name if assigned_to changed
        if "assigned_to" in update_dict:
            update_dict["assigned_to_name"] = get_employee_name(update_dict["assigned_to"])
        
        # Don't allow updating system fields via this route
        system_fields = ["id", "created_at"]
        for field in system_fields:
            update_dict.pop(field, None)
        
        # Update task
        result = tasks_coll.update_one({"id": task_id}, {"$set": update_dict})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Return updated task
        updated_task = tasks_coll.find_one({"id": task_id})
        return format_task_out(updated_task, sites_coll)
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating task")

@task_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user), Depends(admin_required)])
async def delete_task(task_id: str, tasks_coll=Depends(tasks_collection)):
    """
    Delete a task by its ID. Only for admin users.
    """
    res = tasks_coll.delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return None

@task_router.get("/all", response_model=List[TaskModel], dependencies=[Depends(get_current_user), Depends(admin_required)])
async def list_tasks_admin(
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user ID"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by task priority"),
    assigned_at: Optional[str] = Query(None, description="Filter by site/location"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Limit number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    List all tasks with optional filtering. Admin access required.
    Supports filtering by assignee, status, priority, and location with pagination.
    """
    try:
        # Build query
        query = {}
        
        if status:
            query["status"] = status
        if assigned_to:
            query["assigned_to"] = assigned_to
        if priority:
            query["priority"] = priority
        if assigned_at:
            query["assigned_at"] = assigned_at
        
        # Execute query with pagination
        cursor = tasks_coll.find(query).sort("created_at", -1)
        
        if offset:
            cursor = cursor.skip(offset)
        if limit:
            cursor = cursor.limit(limit)
        
        tasks = list(cursor)
        result = [format_task_out(t, sites_coll) for t in tasks]
        
        # Get total count for pagination info
        total_count = tasks_coll.count_documents(query)
        
        logger.info(f"Retrieved {len(result)} tasks (filtered: {len(query)} filters, total available: {total_count})")
        
        # Add pagination metadata to response headers would be ideal,
        # but since we need to return List[TaskModel], we'll just return the tasks
        return result
        
    except Exception as e:
        logger.error(f"Error listing tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while listing tasks")

@task_router.get("/", response_model=List[TaskModel], dependencies=[Depends(get_current_user)])
def list_accessible_tasks(
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user ID"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by task priority"),
    assigned_at: Optional[str] = Query(None, description="Filter by site/location"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Limit number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    List tasks accessible to current user (own tasks + subordinate tasks for managers/HR).
    No admin requirement - uses hierarchy permissions.
    """
    try:
        user_id = current_user.get("user_id")
        
        # Use sync check for admin/HR status by checking roles directly
        user_roles = current_user.get("roles", [])
        role_ids = current_user.get("role_ids", [])
        is_admin = "admin" in user_roles or "Admin" in user_roles or any("admin" in str(role).lower() for role in role_ids)
        is_hr = "hr" in user_roles or "HR" in user_roles or any("hr" in str(role).lower() for role in role_ids)
        # Build base query - simplified approach
        if is_admin or is_hr:
            # Admins and HR can see all tasks
            query = {}
        else:
            # Regular users can see tasks assigned to them or created by them
            query = {
                "$or": [
                    {"assigned_to": user_id},
                    {"assigned_by": user_id}
                ]
            }
        
        # Apply filters
        if status:
            query["status"] = status
        if assigned_to:
            query["assigned_to"] = assigned_to
        if priority:
            query["priority"] = priority
        if assigned_at:
            query["assigned_at"] = assigned_at
        
        # Execute query with pagination
        cursor = tasks_coll.find(query).sort("created_at", -1)
        
        if offset:
            cursor = cursor.skip(offset)
        if limit:
            cursor = cursor.limit(limit)
        
        tasks = list(cursor)
        
        # Simply return tasks for the user - no complex hierarchy checks for now
        result = [format_task_out(t, sites_coll) for t in tasks]
        
        logger.info(f"Retrieved {len(result)} accessible tasks for user {user_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error listing accessible tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while listing tasks")

# -- PUBLIC ROUTES: Any authenticated user --

@task_router.get("/assign/{task_id}", response_model=TaskModel, dependencies=[Depends(get_current_user)])
async def get_task(task_id: str, tasks_coll=Depends(tasks_collection), sites_coll=Depends(sites_collection)):
    """
    Get details for a single task by its ID. All logged-in users may access if permitted.
    """
    t = tasks_coll.find_one({"id": task_id})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return format_task_out(t, sites_coll)

@task_router.get("/assigned", response_model=List[TaskModel], dependencies=[Depends(get_current_user)])
async def get_assigned_tasks(userId: str = Query(...), tasks_coll=Depends(tasks_collection), sites_coll=Depends(sites_collection)):
    """
    Get all tasks assigned to a given user ID.
    """
    tasks = list(tasks_coll.find({"assigned_to": userId}))
    return [format_task_out(t, sites_coll) for t in tasks]

@task_router.patch("/{task_id}", response_model=TaskModel, dependencies=[Depends(get_current_user)])
async def update_task_partial(
    task_id: str,
    update: TaskUpdate, 
    current_user: dict = Depends(get_current_user), 
    tasks_coll=Depends(tasks_collection), 
    sites_coll=Depends(sites_collection)
):
    """
    Partially update task details (status, description, priority, timeSpent, etc.). 
    Access checks apply - users can update tasks assigned to them or their subordinates.
    """
    try:
        # Find task
        task = tasks_coll.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Permission checks
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        task_assignee_code = task.get("assigned_to")
        task_assigned_by = task.get("assigned_by")
        
        if not is_admin:
            can_update = (
                user_id == task_assignee_code or  # Assigned user can update
                user_id == task_assigned_by or    # Task creator can update
                (task_assignee_code and await HierarchyHelper.can_access_resource(user_id, task_assignee_code))
            )
            if not can_update:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You don't have permission to update this task"
                )
        
        # Prepare update document
        update_dict = update.dict(exclude_unset=True)
        update_dict = ensure_datetime_recursive(update_dict)
        update_dict["updated_at"] = datetime.utcnow()
        
        # Handle status changes
        if update_dict.get("status"):
            if update_dict["status"] == "approved":
                update_dict["approved_at"] = datetime.utcnow()
                update_dict["approved_by"] = user_id
            elif update_dict["status"] == "completed":
                update_dict["completed_at"] = datetime.utcnow()
                update_dict["completed_by"] = user_id
        
        # Apply update
        result = tasks_coll.update_one({"id": task_id}, {"$set": update_dict})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found or not updated")
        
        # Return updated task
        updated_task = tasks_coll.find_one({"id": task_id})
        return format_task_out(updated_task, sites_coll)
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating task")

@task_router.patch("/{task_id}/status", response_model=TaskModel, dependencies=[Depends(get_current_user)])
async def update_task_status(
    task_id: str,
    status_update: TaskStatusUpdate,
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Update only the status of a task with optional approval and remarks.
    """
    try:
        # Find task
        task = tasks_coll.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Permission checks
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        task_assignee_code = task.get("assigned_to")
        task_assigned_by = task.get("assigned_by")
        
        if not is_admin:
            can_update = (
                user_id == task_assignee_code or
                user_id == task_assigned_by or
                (task_assignee_code and await HierarchyHelper.can_access_resource(user_id, task_assignee_code))
            )
            if not can_update:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You don't have permission to update this task status"
                )
        
        # Prepare status update
        update_dict = {
            "status": status_update.status,
            "updated_at": datetime.utcnow()
        }
        
        # Handle optional fields
        if status_update.remarks:
            update_dict["remarks"] = status_update.remarks
        
        if status_update.approved_by:
            update_dict["approved_by"] = status_update.approved_by
            update_dict["approved_at"] = datetime.utcnow()
        
        # Handle specific status changes
        if status_update.status == "approved":
            update_dict["approved_at"] = datetime.utcnow()
            update_dict["approved_by"] = status_update.approved_by or user_id
        elif status_update.status == "completed":
            update_dict["completed_at"] = datetime.utcnow()
            update_dict["completed_by"] = user_id
        
        # Apply update
        result = tasks_coll.update_one({"id": task_id}, {"$set": update_dict})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Return updated task
        updated_task = tasks_coll.find_one({"id": task_id})
        return format_task_out(updated_task, sites_coll)
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating task status {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating task status")

# Additional utility routes for better task management

@task_router.get("/priority/{priority_level}", response_model=List[TaskModel])
async def get_tasks_by_priority(
    priority_level: str,
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Get tasks filtered by priority level.
    """
    try:
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        # Build query based on user permissions
        if is_admin:
            query = {"priority": priority_level}
        else:
            # Non-admin users can only see their own tasks or tasks they can access
            query = {
                "priority": priority_level,
                "$or": [
                    {"assigned_to": user_id},
                    {"assigned_by": user_id}
                ]
            }
        
        tasks = list(tasks_coll.find(query))
        
        # Additional permission filtering for non-admin users
        if not is_admin:
            filtered_tasks = []
            for task in tasks:
                task_assignee = task.get("assigned_to")
                if (task_assignee == user_id or 
                    task.get("assigned_by") == user_id or
                    (task_assignee and await HierarchyHelper.can_access_resource(user_id, task_assignee))):
                    filtered_tasks.append(task)
            tasks = filtered_tasks
        
        result = [format_task_out(t, sites_coll) for t in tasks]
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving tasks by priority {priority_level}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving tasks")

@task_router.get("/statistics", response_model=dict)
async def get_task_statistics(
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection)
):
    """
    Get task statistics for the current user or all tasks if admin.
    """
    try:
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        
        # Build base query
        base_query = {} if is_admin else {"assigned_to": user_id}
        
        # Get task counts by status
        pipeline = [
            {"$match": base_query},
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        status_counts = {}
        for result in tasks_coll.aggregate(pipeline):
            status_counts[result["_id"]] = result["count"]
        
        # Get priority counts
        priority_pipeline = [
            {"$match": base_query},
            {
                "$group": {
                    "_id": "$priority",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        priority_counts = {}
        for result in tasks_coll.aggregate(priority_pipeline):
            priority_counts[result["_id"] or "unassigned"] = result["count"]
        
        # Get total tasks
        total_tasks = tasks_coll.count_documents(base_query)
        
        # Calculate averages for timeSpent (if available)
        time_pipeline = [
            {"$match": {**base_query, "timeSpent": {"$exists": True, "$ne": None}}},
            {
                "$group": {
                    "_id": None,
                    "avgTime": {"$avg": "$timeSpent"},
                    "totalTime": {"$sum": "$timeSpent"}
                }
            }
        ]
        
        time_stats = list(tasks_coll.aggregate(time_pipeline))
        avg_time = time_stats[0]["avgTime"] if time_stats else 0
        total_time = time_stats[0]["totalTime"] if time_stats else 0
        
        return {
            "total_tasks": total_tasks,
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "time_statistics": {
                "average_time_spent": round(avg_time, 2) if avg_time else 0,
                "total_time_spent": round(total_time, 2) if total_time else 0
            },
            "user_scope": "all_tasks" if is_admin else "my_tasks"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving task statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving statistics")

@task_router.get("/mytasks", response_model=List[TaskModel])
async def get_my_tasks(
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Retrieve all tasks assigned to the current user.
    """
    try:
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        query = {"assigned_to": user_id}
        tasks = list(tasks_coll.find(query))
        result = [format_task_out(t, sites_coll) for t in tasks]
        
        logger.info(f"Retrieved {len(result)} tasks for user {user_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving tasks for user {current_user.get('user_id', 'unknown')}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving tasks")

@task_router.get("/my-tasks", response_model=List[TaskModel])
async def get_my_tasks_hyphen(
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Retrieve all tasks assigned to the current user (hyphenated endpoint).
    """
    try:
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
            
        query = {"assigned_to": user_id}
        tasks = list(tasks_coll.find(query))
        result = [format_task_out(t, sites_coll) for t in tasks]
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving tasks for user {current_user.get('user_id', 'unknown')}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving tasks")

@task_router.post("/{task_id}/updates", response_model=TaskModel)
async def add_task_update(
    task_id: str, 
    update: dict, 
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Add an update to a task. This could be a comment, status change, etc.
    """
    try:
        # Find task
        task = tasks_coll.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Permission checks
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        task_assignee_code = task.get("assigned_to")
        task_assigned_by = task.get("assigned_by")
        
        if not is_admin:
            can_update = (
                user_id == task_assignee_code or
                user_id == task_assigned_by or
                (task_assignee_code and await HierarchyHelper.can_access_resource(user_id, task_assignee_code))
            )
            if not can_update:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You don't have permission to update this task"
                )
        
        # Prepare update with metadata
        update_data = dict(update)
        update_data["updated_at"] = datetime.utcnow()
        update_data["updated_by"] = user_id
        
        # Apply update
        updated_task = tasks_coll.find_one_and_update(
            {"id": task_id},
            {"$set": update_data},
            return_document=True
        )
        
        if not updated_task:
            raise HTTPException(status_code=404, detail="Task not found or not updated")

        return format_task_out(updated_task, sites_coll)
        
    except Exception as e:
        logger.error(f"Error adding update to task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating task")

@task_router.get("/raw", response_model=List[TaskModel])
async def get_raw_tasks(
    current_user: dict = Depends(get_current_user),
    tasks_coll=Depends(tasks_collection),
    sites_coll=Depends(sites_collection)
):
    """
    Fetch all tasks without filtering, intended for admin/HR overview.
    """
    try:
        # Authorization check: admin or HR only
        user_id = current_user.get("user_id")
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        user_roles = current_user.get("roles", [])
        
        if not is_admin and "hr" not in user_roles:
            raise HTTPException(
                status_code=403, 
                detail="Access denied: Admin or HR role required to access all tasks"
            )

        # Fetch all tasks
        tasks = list(tasks_coll.find({}))
        result = [format_task_out(task, sites_coll) for task in tasks]
        
        logger.info(f"Retrieved {len(result)} raw tasks for admin/HR user {user_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving raw tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving tasks")

