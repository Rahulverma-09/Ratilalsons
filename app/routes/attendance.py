from fastapi import APIRouter, HTTPException, Depends, Query, Body, Path, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId
import logging

# Import authentication and database dependencies
from app.dependencies import get_current_user
from app.database import get_database
from app.database.schemas.hr_staff_schema import AttendanceModel, AttendanceReportModel, AttendanceAlertModel

# Set up logger
logger = logging.getLogger(__name__)

# Create router
attendance_router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance Management"]
)

# Create HR router for HR-specific endpoints
hr_router = APIRouter(
    prefix="/api/hr",
    tags=["HR Management"]
)

# Helper function to convert MongoDB ObjectId to string
def convert_objectid_to_str(data):
    """Convert MongoDB document to JSON-serializable dictionary."""
    if isinstance(data, dict):
        for key in list(data.keys()):
            if isinstance(data[key], ObjectId):
                data[key] = str(data[key])
            elif isinstance(data[key], (dict, list)):
                data[key] = convert_objectid_to_str(data[key])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            data[i] = convert_objectid_to_str(item)
    return data

# Helper function to check HR/Admin permissions
def has_hr_admin_permission(user_data: dict) -> bool:
    """Check if user has HR or admin permissions"""
    if not user_data:
        logger.warning(f"No user data provided for permission check")
        return False
    
    # Extract roles from user data
    user_roles = []
    
    # Check role field (string)
    if user_data.get('role'):
        user_roles.append(str(user_data['role']).lower())
    
    # Check roles array
    if user_data.get('roles') and isinstance(user_data['roles'], list):
        user_roles.extend([str(r).lower() for r in user_data['roles']])
    
    # Check role_names array
    if user_data.get('role_names') and isinstance(user_data['role_names'], list):
        user_roles.extend([str(r).lower() for r in user_data['role_names']])
    
    # Define authorized roles
    authorized_roles = ['admin', 'administrator', 'hr', 'hr_admin', 'hr_manager', 'human_resources']
    
    # Log for debugging
    logger.info(f"Permission check for user: {user_data.get('username', 'unknown')}")
    logger.info(f"User roles found: {user_roles}")
    logger.info(f"Authorized roles: {authorized_roles}")
    
    # Check if any role matches authorized roles
    has_permission = any(role in authorized_roles for role in user_roles)
    logger.info(f"Permission result: {has_permission}")
    
    return has_permission

# Helper function to get user ID from user data
def get_user_id(user_data: dict) -> str:
    """Extract user ID from user data"""
    return user_data.get('user_id') or user_data.get('id') or str(user_data.get('_id', ''))

# =================== DIAGNOSTIC ROUTES ===================

@attendance_router.get("/debug/user-permissions", status_code=200)
async def debug_user_permissions(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check user permissions and role data"""
    try:
        has_permission = has_hr_admin_permission(current_user)
        
        return {
            "success": True,
            "user_data": {
                "username": current_user.get("username"),
                "user_id": current_user.get("user_id"),
                "role": current_user.get("role"),
                "roles": current_user.get("roles"),
                "role_names": current_user.get("role_names"),
            },
            "has_hr_admin_permission": has_permission
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "user_data": current_user
        }

# Helper function to validate date format
def validate_date_format(date_str: str) -> bool:
    """Validate if date string is in YYYY-MM-DD format"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False

# =================== EMPLOYEE ATTENDANCE ROUTES ===================

@attendance_router.get("/dashboard", status_code=200)
async def employee_attendance_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """Get employee attendance dashboard with current status and recent records"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Get today's date
        today = datetime.now().date()
        today_str = today.strftime("%Y-%m-%d")
        
        # Find today's attendance record
        today_record = db.attendance.find_one({
            "employee_id": user_id,
            "attendance_date": today_str
        })
        
        # Get recent attendance records (last 7 days)
        week_ago = (today - timedelta(days=6)).strftime("%Y-%m-%d")
        recent_records = list(
            db.attendance.find({
                "employee_id": user_id,
                "attendance_date": {
                    "$gte": week_ago,
                    "$lte": today_str
                }
            }).sort("attendance_date", -1)
        )
        
        # Calculate current working time if checked in
        current_working_time = None
        if today_record and today_record.get("checkin_time") and not today_record.get("checkout_time"):
            now = datetime.now()
            time_diff = now - today_record["checkin_time"]
            current_working_time = int(time_diff.total_seconds() / 60)
        
        # Calculate weekly stats
        total_days = len(recent_records)
        present_days = len([r for r in recent_records if r.get("status") == "present"])
        late_days = len([r for r in recent_records if r.get("status") == "late"])
        total_working_hours = sum([r.get("total_working_minutes", 0) for r in recent_records]) / 60
        total_overtime_hours = sum([r.get("overtime_minutes", 0) for r in recent_records]) / 60
        
        return {
            "success": True,
            "data": {
                "today": {
                    "date": today_str,
                    "has_checkedin": bool(today_record and today_record.get("checkin_time")),
                    "has_checkedout": bool(today_record and today_record.get("checkout_time")),
                    "checkin_time": today_record.get("checkin_time") if today_record else None,
                    "checkout_time": today_record.get("checkout_time") if today_record else None,
                    "current_working_minutes": current_working_time,
                    "status": today_record.get("status") if today_record else "not_started",
                    "location": today_record.get("location") if today_record else None,
                    "source": today_record.get("source") if today_record else None
                },
                "weekly_stats": {
                    "total_days": total_days,
                    "present_days": present_days,
                    "late_days": late_days,
                    "attendance_percentage": round((present_days / 7) * 100, 1) if total_days > 0 else 0,
                    "total_working_hours": round(total_working_hours, 2),
                    "total_overtime_hours": round(total_overtime_hours, 2),
                    "average_daily_hours": round(total_working_hours / max(present_days, 1), 2)
                },
                "recent_records": convert_objectid_to_str(recent_records)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employee dashboard: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.post("/checkin", status_code=201)
async def employee_checkin(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Employee check-in attendance"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Current date and time
        now = datetime.now()
        today = now.date()
        today_str = today.strftime("%Y-%m-%d")
        
        # Check if already checked in today
        existing_attendance = db.attendance.find_one({
            "employee_id": user_id,
            "attendance_date": today_str
        })
        
        if existing_attendance and existing_attendance.get("checkin_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked in today"
            )
        
        # Extract and validate location data
        location = data.get("location", {})
        
        # Determine source and device information
        source = data.get("source", "manual")  # manual, biometric, mobile_app, web_dashboard
        device_info = {
            "device_id": data.get("device_id", "web_browser"),
            "device_type": data.get("device_type", "web"),  # web, mobile, biometric, card_reader
            "browser_info": data.get("browser_info", ""),
            "ip_address": data.get("ip_address", ""),
            "user_agent": data.get("user_agent", "")
        }
        
        # Determine attendance status based on time
        checkin_hour = now.hour
        checkin_minute = now.minute
        
        # Default work start time (9:00 AM) - you can make this configurable
        work_start_hour = data.get("work_start_hour", 9)
        work_start_minute = data.get("work_start_minute", 0)
        late_threshold_minutes = data.get("late_threshold", 15)  # 15 minutes grace period
        
        # Calculate if late
        checkin_minutes_total = (checkin_hour * 60) + checkin_minute
        work_start_minutes_total = (work_start_hour * 60) + work_start_minute
        
        status = "present"
        if checkin_minutes_total > (work_start_minutes_total + late_threshold_minutes):
            status = "late"
        
        # Create comprehensive attendance record
        attendance_data = {
            "employee_id": user_id,
            "attendance_date": today_str,
            "checkin_time": now,
            "checkin_timezone": data.get("timezone", "UTC"),
            "status": status,
            "location": {
                "latitude": location.get("latitude"),
                "longitude": location.get("longitude"),
                "address": location.get("address", ""),
                "accuracy": location.get("accuracy"),
                "timestamp": location.get("timestamp", now.isoformat())
            },
            "source": source,
            "device_info": device_info,
            "biometric_id": data.get("biometric_id"),
            "is_manual": source in ["manual", "web_dashboard"],
            "created_by": user_id,
            "last_modified": now,
            "notes": data.get("notes", ""),
            "shift_type": data.get("shift_type", "day"),  # day, night, evening
            "work_from_home": data.get("work_from_home", False),
            "overtime_approved": data.get("overtime_approved", False)
        }
        
        # Insert or update attendance record
        if existing_attendance:
            # Update existing record with check-in data
            db.attendance.update_one(
                {"_id": existing_attendance["_id"]},
                {"$set": attendance_data}
            )
            attendance_data["_id"] = existing_attendance["_id"]
        else:
            # Create new attendance record
            result = db.attendance.insert_one(attendance_data)
            attendance_data["_id"] = result.inserted_id
        
        logger.info(f"Employee {user_id} checked in successfully")
        
        return {
            "success": True,
            "message": "Check-in successful",
            "data": convert_objectid_to_str(attendance_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in employee check-in: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.post("/checkout", status_code=200)
async def employee_checkout(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Employee check-out attendance"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Current date and time
        now = datetime.now()
        today = now.date()
        today_str = today.strftime("%Y-%m-%d")
        
        # Find today's attendance record
        attendance_record = db.attendance.find_one({
            "employee_id": user_id,
            "attendance_date": today_str
        })
        
        if not attendance_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No check-in record found for today"
            )
        
        if attendance_record.get("checkout_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out today"
            )
        
        # Calculate comprehensive working time and overtime
        checkin_time = attendance_record.get("checkin_time")
        working_minutes = 0
        overtime_minutes = 0
        break_minutes = data.get("break_minutes", 0)  # Manual break time input
        
        if checkin_time:
            # Calculate total time difference
            time_diff = now - checkin_time
            total_minutes = int(time_diff.total_seconds() / 60)
            
            # Subtract break time from working minutes
            working_minutes = max(0, total_minutes - break_minutes)
            
            # Get standard working hours (configurable per employee/shift)
            standard_minutes = data.get("standard_work_minutes", 480)  # Default 8 hours
            minimum_work_minutes = data.get("minimum_work_minutes", 240)  # Default 4 hours for half day
            
            # Calculate overtime
            if working_minutes > standard_minutes:
                overtime_minutes = working_minutes - standard_minutes
            
            # Determine if it's a half day based on working time
            if working_minutes < minimum_work_minutes:
                # Update status to half day if worked less than minimum
                db.attendance.update_one(
                    {"_id": attendance_record["_id"]},
                    {"$set": {"status": "half_day"}}
                )
        
        # Extract comprehensive location and device data for checkout
        location = data.get("location", {})
        checkout_location = {
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "address": location.get("address", ""),
            "accuracy": location.get("accuracy"),
            "timestamp": location.get("timestamp", now.isoformat())
        }
        
        # Get checkout device information
        checkout_device = {
            "device_id": data.get("device_id", "web_browser"),
            "device_type": data.get("device_type", "web"),
            "browser_info": data.get("browser_info", ""),
            "ip_address": data.get("ip_address", ""),
            "user_agent": data.get("user_agent", "")
        }
        
        # Calculate productivity metrics
        productivity_score = data.get("productivity_score")  # Optional self-assessment
        tasks_completed = data.get("tasks_completed", 0)
        
        # Update attendance record with comprehensive checkout data
        update_data = {
            "checkout_time": now,
            "checkout_timezone": data.get("timezone", "UTC"),
            "total_working_minutes": working_minutes,
            "working_hours": round(working_minutes / 60, 2),
            "overtime_minutes": overtime_minutes,
            "overtime_hours": round(overtime_minutes / 60, 2),
            "break_minutes": break_minutes,
            "checkout_location": checkout_location,
            "checkout_device": checkout_device,
            "checkout_source": data.get("source", "manual"),
            "productivity_score": productivity_score,
            "tasks_completed": tasks_completed,
            "updated_by": user_id,
            "last_modified": now,
            "checkout_notes": data.get("notes", ""),
            "work_summary": data.get("work_summary", "")  # Optional work summary
        }
        
        db.attendance.update_one(
            {"_id": attendance_record["_id"]},
            {"$set": update_data}
        )
        
        # Get updated record
        updated_record = db.attendance.find_one({"_id": attendance_record["_id"]})
        
        logger.info(f"Employee {user_id} checked out successfully")
        
        return {
            "success": True,
            "message": "Check-out successful",
            "data": convert_objectid_to_str(updated_record),
            "working_hours": round(working_minutes / 60, 2),
            "overtime_hours": round(overtime_minutes / 60, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in employee check-out: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/my-records", status_code=200)
async def get_my_attendance_records(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(31, ge=1, le=100, description="Records per page"),
    current_user: dict = Depends(get_current_user)
):
    """Get employee's own attendance records"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Build query filter
        query_filter = {"employee_id": user_id}
        
        # Handle date filtering
        if start_date and end_date:
            if not validate_date_format(start_date) or not validate_date_format(end_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
            query_filter["attendance_date"] = {
                "$gte": start_date,
                "$lte": end_date
            }
        elif month and year:
            start_of_month = date(year, month, 1)
            if month == 12:
                end_of_month = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_of_month = date(year, month + 1, 1) - timedelta(days=1)
            
            query_filter["attendance_date"] = {
                "$gte": start_of_month.strftime("%Y-%m-%d"),
                "$lte": end_of_month.strftime("%Y-%m-%d")
            }
        
        # Get total count
        total_records = db.attendance.count_documents(query_filter)
        
        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_records + limit - 1) // limit
        
        # Get attendance records
        attendance_records = list(
            db.attendance.find(query_filter)
            .sort("attendance_date", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Convert to response format
        formatted_records = []
        for record in attendance_records:
            formatted_record = convert_objectid_to_str(record)
            formatted_records.append(formatted_record)
        
        return {
            "success": True,
            "data": formatted_records,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_records": total_records,
                "records_per_page": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employee attendance records: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.post("/manual-mark", status_code=201)
async def employee_manual_mark_attendance(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Employee manually mark full attendance (both checkin and checkout)"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Validate required fields
        required_fields = ["attendance_date", "checkin_time", "checkout_time"]
        for field in required_fields:
            if field not in data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )
        
        # Get database reference
        db = get_database()
        
        # Validate date format
        attendance_date = data["attendance_date"]
        if not validate_date_format(attendance_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Parse times
        try:
            checkin_dt = datetime.fromisoformat(data["checkin_time"])
            checkout_dt = datetime.fromisoformat(data["checkout_time"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            )
        
        # Validate checkout is after checkin
        if checkout_dt <= checkin_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Checkout time must be after checkin time"
            )
        
        # Calculate working time
        time_diff = checkout_dt - checkin_dt
        working_minutes = int(time_diff.total_seconds() / 60)
        break_minutes = data.get("break_minutes", 60)  # Default 1 hour break
        actual_working_minutes = max(0, working_minutes - break_minutes)
        
        # Calculate overtime
        standard_minutes = data.get("standard_work_minutes", 480)  # 8 hours
        overtime_minutes = max(0, actual_working_minutes - standard_minutes)
        
        # Determine status
        status = data.get("status", "present")
        if actual_working_minutes < 240:  # Less than 4 hours
            status = "half_day"
        
        # Check if record already exists
        existing_record = db.attendance.find_one({
            "employee_id": user_id,
            "attendance_date": attendance_date
        })
        
        # Prepare attendance data
        attendance_data = {
            "employee_id": user_id,
            "attendance_date": attendance_date,
            "checkin_time": checkin_dt,
            "checkout_time": checkout_dt,
            "checkin_timezone": data.get("timezone", "UTC"),
            "checkout_timezone": data.get("timezone", "UTC"),
            "status": status,
            "total_working_minutes": actual_working_minutes,
            "working_hours": round(actual_working_minutes / 60, 2),
            "overtime_minutes": overtime_minutes,
            "overtime_hours": round(overtime_minutes / 60, 2),
            "break_minutes": break_minutes,
            "location": data.get("location", {}),
            "source": "manual_entry",
            "is_manual": True,
            "created_by": user_id,
            "updated_by": user_id,
            "last_modified": datetime.now(),
            "notes": data.get("notes", "Manually entered by employee"),
            "work_summary": data.get("work_summary", ""),
            "tasks_completed": data.get("tasks_completed", 0),
            "reason_for_manual_entry": data.get("reason", "")
        }
        
        if existing_record:
            # Update existing record
            db.attendance.update_one(
                {"_id": existing_record["_id"]},
                {"$set": attendance_data}
            )
            updated_record = db.attendance.find_one({"_id": existing_record["_id"]})
            message = "Attendance record updated successfully"
        else:
            # Create new record
            result = db.attendance.insert_one(attendance_data)
            updated_record = db.attendance.find_one({"_id": result.inserted_id})
            message = "Attendance record created successfully"
        
        logger.info(f"Employee {user_id} manually marked attendance for {attendance_date}")
        
        return {
            "success": True,
            "message": message,
            "data": convert_objectid_to_str(updated_record)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in manual attendance entry: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/today-status", status_code=200)
async def get_today_attendance_status(
    current_user: dict = Depends(get_current_user)
):
    """Get today's attendance status for the employee"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Get today's date
        today = datetime.now().date()
        
        # Find today's attendance record
        today_record = db.attendance.find_one({
            "employee_id": user_id,
            "attendance_date": today.strftime("%Y-%m-%d")
        })
        
        if not today_record:
            return {
                "success": True,
                "data": {
                    "date": today.strftime("%Y-%m-%d"),
                    "has_checkedin": False,
                    "has_checkedout": False,
                    "status": "not_started"
                }
            }
        
        # Calculate working time if checked in
        working_time = None
        if today_record.get("checkin_time"):
            if today_record.get("checkout_time"):
                # Already checked out
                working_time = today_record.get("total_working_minutes", 0)
            else:
                # Still working
                now = datetime.now()
                time_diff = now - today_record["checkin_time"]
                working_time = int(time_diff.total_seconds() / 60)
        
        return {
            "success": True,
            "data": {
                "date": today.strftime("%Y-%m-%d"),
                "has_checkedin": bool(today_record.get("checkin_time")),
                "has_checkedout": bool(today_record.get("checkout_time")),
                "checkin_time": today_record.get("checkin_time"),
                "checkout_time": today_record.get("checkout_time"),
                "working_minutes": working_time,
                "working_hours": round(working_time / 60, 2) if working_time else None,
                "status": today_record.get("status", "unknown"),
                "location": today_record.get("location"),
                "record": convert_objectid_to_str(today_record)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting today's attendance status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# =================== HR/ADMIN ATTENDANCE ROUTES ===================

@attendance_router.post("/admin/mark-attendance", status_code=201)
async def admin_mark_attendance(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin manually mark employee attendance"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        # Validate required fields
        required_fields = ["employee_id", "attendance_date", "status"]
        for field in required_fields:
            if field not in data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )
        
        employee_id = data["employee_id"]
        attendance_date = data["attendance_date"]
        status_value = data["status"]
        
        # Validate date format
        if not validate_date_format(attendance_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Validate status
        valid_statuses = ["present", "absent", "leave", "late", "half_day"]
        if status_value not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Get database reference
        db = get_database()
        
        # Check if employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            employee = db.users.find_one({"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Get admin user ID
        admin_user_id = get_user_id(current_user)
        
        # Current time
        now = datetime.now()
        
        # Check if attendance already exists for this date
        existing_attendance = db.attendance.find_one({
            "employee_id": employee_id,
            "attendance_date": attendance_date
        })
        
        # Prepare attendance data
        attendance_data = {
            "employee_id": employee_id,
            "attendance_date": attendance_date,  # keep as string for MongoDB compatibility
            "status": status_value,
            "is_manual": True,
            "created_by": admin_user_id,
            "updated_by": admin_user_id,
            "last_modified": now,
            "notes": data.get("notes", "Manually marked by HR/Admin"),
            "source": "manual_hr"
        }
        
        # Add checkin/checkout times if provided
        if data.get("checkin_time"):
            try:
                checkin_dt = datetime.fromisoformat(data["checkin_time"])
                attendance_data["checkin_time"] = checkin_dt
                attendance_data["checkin_timezone"] = data.get("timezone", "UTC")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid checkin_time format. Use ISO format."
                )
        
        if data.get("checkout_time"):
            try:
                checkout_dt = datetime.fromisoformat(data["checkout_time"])
                attendance_data["checkout_time"] = checkout_dt
                attendance_data["checkout_timezone"] = data.get("timezone", "UTC")
                
                # Calculate working minutes if both times are provided
                if attendance_data.get("checkin_time"):
                    if checkout_dt <= attendance_data["checkin_time"]:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Checkout time must be after check-in time"
                        )
                    time_diff = checkout_dt - attendance_data["checkin_time"]
                    working_minutes = int(time_diff.total_seconds() / 60)
                    attendance_data["total_working_minutes"] = working_minutes
                    attendance_data["working_hours"] = round(working_minutes / 60, 2)
                    
                    # Calculate overtime (assuming 8 hours = 480 minutes standard)
                    standard_minutes = 480
                    if working_minutes > standard_minutes:
                        attendance_data["overtime_minutes"] = working_minutes - standard_minutes
                        attendance_data["overtime_hours"] = round((working_minutes - standard_minutes) / 60, 2)
                        
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid checkout_time format. Use ISO format."
                )
        
        # Add location if provided
        if data.get("location"):
            attendance_data["location"] = data["location"]
        
        if existing_attendance:
            # Update existing record
            db.attendance.update_one(
                {"_id": existing_attendance["_id"]},
                {"$set": attendance_data}
            )
            updated_record = db.attendance.find_one({"_id": existing_attendance["_id"]})
            message = "Attendance record updated successfully"
        else:
            # Create new record
            result = db.attendance.insert_one(attendance_data)
            updated_record = db.attendance.find_one({"_id": result.inserted_id})
            message = "Attendance record created successfully"
        
        logger.info(f"Admin {admin_user_id} marked attendance for employee {employee_id}")
        
        return {
            "success": True,
            "message": message,
            "data": convert_objectid_to_str(updated_record)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in admin mark attendance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.post("/admin/bulk-mark", status_code=201)
async def admin_bulk_mark_attendance(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin bulk mark attendance for multiple employees"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        # Validate required fields
        if "attendance_records" not in data or not isinstance(data["attendance_records"], list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="attendance_records field is required and must be a list"
            )
        
        # Get database reference
        db = get_database()
        admin_user_id = get_user_id(current_user)
        
        results = []
        errors = []
        
        for record_data in data["attendance_records"]:
            try:
                # Validate required fields for each record
                required_fields = ["employee_id", "attendance_date", "status"]
                for field in required_fields:
                    if field not in record_data:
                        raise ValueError(f"Missing required field: {field}")
                
                employee_id = record_data["employee_id"]
                attendance_date = record_data["attendance_date"]
                status_value = record_data["status"]
                
                # Validate date format
                if not validate_date_format(attendance_date):
                    raise ValueError("Invalid date format. Use YYYY-MM-DD")
                
                # Validate status
                valid_statuses = ["present", "absent", "leave", "late", "half_day"]
                if status_value not in valid_statuses:
                    raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
                
                # Check if employee exists
                employee = db.users.find_one({"user_id": employee_id})
                if not employee:
                    employee = db.users.find_one({"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None})
                if not employee:
                    raise ValueError(f"Employee {employee_id} not found")
                
                # Prepare attendance data
                attendance_record = {
                    "employee_id": employee_id,
                    "attendance_date": attendance_date,
                    "status": status_value,
                    "is_manual": True,
                    "source": "bulk_hr_entry",
                    "created_by": admin_user_id,
                    "updated_by": admin_user_id,
                    "last_modified": datetime.now(),
                    "notes": record_data.get("notes", "Bulk marked by HR/Admin")
                }
                
                # Add optional fields
                if record_data.get("checkin_time"):
                    attendance_record["checkin_time"] = datetime.fromisoformat(record_data["checkin_time"])
                
                if record_data.get("checkout_time"):
                    attendance_record["checkout_time"] = datetime.fromisoformat(record_data["checkout_time"])
                    
                    # Calculate working time if both times provided
                    if "checkin_time" in attendance_record:
                        time_diff = attendance_record["checkout_time"] - attendance_record["checkin_time"]
                        working_minutes = int(time_diff.total_seconds() / 60)
                        attendance_record["total_working_minutes"] = working_minutes
                        attendance_record["working_hours"] = round(working_minutes / 60, 2)
                        
                        # Calculate overtime
                        standard_minutes = 480
                        if working_minutes > standard_minutes:
                            overtime_minutes = working_minutes - standard_minutes
                            attendance_record["overtime_minutes"] = overtime_minutes
                            attendance_record["overtime_hours"] = round(overtime_minutes / 60, 2)
                
                if record_data.get("working_hours"):
                    working_hours = float(record_data["working_hours"])
                    attendance_record["working_hours"] = working_hours
                    attendance_record["total_working_minutes"] = int(working_hours * 60)
                
                # Check if record already exists
                existing_record = db.attendance.find_one({
                    "employee_id": employee_id,
                    "attendance_date": attendance_date
                })
                
                if existing_record:
                    # Update existing record
                    db.attendance.update_one(
                        {"_id": existing_record["_id"]},
                        {"$set": attendance_record}
                    )
                    updated_record = db.attendance.find_one({"_id": existing_record["_id"]})
                    action = "updated"
                else:
                    # Create new record
                    result = db.attendance.insert_one(attendance_record)
                    updated_record = db.attendance.find_one({"_id": result.inserted_id})
                    action = "created"
                
                results.append({
                    "employee_id": employee_id,
                    "attendance_date": attendance_date,
                    "action": action,
                    "status": "success",
                    "data": convert_objectid_to_str(updated_record)
                })
                
            except Exception as e:
                errors.append({
                    "employee_id": record_data.get("employee_id", "unknown"),
                    "attendance_date": record_data.get("attendance_date", "unknown"),
                    "error": str(e)
                })
        
        logger.info(f"Admin {admin_user_id} bulk marked attendance for {len(results)} records with {len(errors)} errors")
        
        return {
            "success": True,
            "message": f"Processed {len(data['attendance_records'])} records",
            "summary": {
                "total_processed": len(data["attendance_records"]),
                "successful": len(results),
                "failed": len(errors)
            },
            "results": results,
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk mark attendance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.put("/admin/update/{attendance_id}", status_code=200)
async def admin_update_attendance(
    attendance_id: str = Path(..., description="Attendance record ID"),
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin update existing attendance record
    
    Request Body Format:
    Direct format (recommended):
    {
        "status": "present",
        "checkin_time": "09:00 AM",
        "checkout_time": "05:30 PM",
        "notes": "Manual correction"
    }
    
    Nested format (from Swagger UI):
    {
        "additionalProp1": {
            "status": "present",
            "checkin_time": "09:00 AM"
        }
    }
    
    Both formats are supported. The function will automatically detect and handle the structure.
    """
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        # Validate attendance ID
        if not ObjectId.is_valid(attendance_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid attendance record ID"
            )
        
        # Get database reference
        db = get_database()
        
        # Find existing attendance record
        attendance_record = db.attendance.find_one({"_id": ObjectId(attendance_id)})
        if not attendance_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found"
            )
        
        # Get admin user ID
        admin_user_id = get_user_id(current_user)
        
        # Log incoming data for debugging
        logger.info(f"=== ATTENDANCE UPDATE DEBUG START ===")
        logger.info(f"Attendance ID: {attendance_id}")
        logger.info(f"Received update data: {data}")
        logger.info(f"Data keys: {list(data.keys())}")
        
        # Log each field in the data
        for key, value in data.items():
            logger.info(f"  {key}: {value} (type: {type(value)})")
        
        logger.info(f"Attendance record to update: {attendance_record}")
        logger.info(f"=== ATTENDANCE UPDATE DEBUG END ===")
        
        # Handle different request body structures
        # Check if data has nested structure (like from Swagger UI)
        actual_data = data
        if len(data) == 1 and any(key.startswith('additionalProp') for key in data.keys()):
            # Extract the actual data from the nested structure
            nested_key = next(key for key in data.keys() if key.startswith('additionalProp'))
            if isinstance(data[nested_key], dict):
                actual_data = data[nested_key]
                logger.info(f"Extracted nested data from {nested_key}: {actual_data}")
        
        # Prepare update data
        update_data = {
            "updated_by": admin_user_id,
            "last_modified": datetime.now()
        }
        
        # Update allowed fields  
        allowed_fields = [
            "status", "attendance_date", "date", "checkin_timezone", "checkout_timezone", 
            "location", "notes", "source", "biometric_id", "device_id", "is_manual", "working_hours"
        ]
        
        # Process non-time fields first
        for field in allowed_fields:
            if field in actual_data and actual_data[field] is not None:
                # Handle date field mapping
                if field == "date":
                    update_data["attendance_date"] = actual_data[field]
                elif field == "attendance_date":
                    update_data["attendance_date"] = actual_data[field]
                # Handle working hours directly if provided
                elif field == "working_hours":
                    try:
                        working_hours = float(actual_data[field]) if actual_data[field] else 0
                        update_data["total_working_minutes"] = int(working_hours * 60)
                        update_data["working_hours"] = working_hours
                        # Calculate overtime (8 hours = 480 minutes standard)
                        standard_minutes = 480
                        total_minutes = int(working_hours * 60)
                        if total_minutes > standard_minutes:
                            update_data["overtime_minutes"] = total_minutes - standard_minutes
                            update_data["overtime_hours"] = round((total_minutes - standard_minutes) / 60, 2)
                        else:
                            update_data["overtime_minutes"] = 0
                            update_data["overtime_hours"] = 0
                            
                        logger.info(f"Manual working hours set: {working_hours} hours")
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid working_hours value: {actual_data[field]}")
                else:
                    update_data[field] = actual_data[field]
                    
                logger.info(f"Processing field {field}: {actual_data.get(field)}")
        
        logger.info(f"=== TIME FIELD PROCESSING START ===")
        # Process time fields separately with specialized parsing
        
        # Validate status if provided
        if "status" in actual_data:
            valid_statuses = ["present", "absent", "leave", "late", "half_day"]
            if actual_data["status"] not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                )
            logger.info(f"Status validation passed: {actual_data['status']}")
        def parse_time_to_datetime(time_str, date_str=None):
            """Parse various time formats to datetime object"""
            if not time_str or time_str == '--:--':
                return None
                
            try:
                logger.info(f"Parsing time string: '{time_str}' (type: {type(time_str)})")
                
                # If already a datetime string with T or Z
                if 'T' in str(time_str) or 'Z' in str(time_str):
                    return datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
                
                # Get the date for this attendance record
                if not date_str:
                    date_str = actual_data.get("date") or actual_data.get("attendance_date") or attendance_record.get("attendance_date")
                
                # Ensure date_str is a string in YYYY-MM-DD format
                if date_str and not isinstance(date_str, str):
                    if hasattr(date_str, 'strftime'):
                        date_str = date_str.strftime("%Y-%m-%d")
                    else:
                        date_str = str(date_str)
                
                if not date_str:
                    # Use today's date as fallback
                    date_str = datetime.now().strftime("%Y-%m-%d")
                
                logger.info(f"Using date: {date_str} for time parsing")
                
                # Handle AM/PM format (e.g., "02:30 PM", "10:15 AM")
                time_str_clean = str(time_str).strip().upper()
                if 'AM' in time_str_clean or 'PM' in time_str_clean:
                    try:
                        # Parse 12-hour format with AM/PM
                        time_obj = datetime.strptime(f"{date_str} {time_str_clean}", "%Y-%m-%d %I:%M %p")
                        logger.info(f"Parsed AM/PM time: {time_obj}")
                        return time_obj
                    except ValueError as e:
                        logger.warning(f"Failed to parse AM/PM format: {e}")
                        # Try without space before AM/PM
                        try:
                            time_obj = datetime.strptime(f"{date_str} {time_str_clean.replace(' ', '')}", "%Y-%m-%d %I:%M%p")
                            logger.info(f"Parsed AM/PM time (no space): {time_obj}")
                            return time_obj
                        except ValueError:
                            pass
                
                # Handle 24-hour HH:MM format
                if ':' in str(time_str) and len(str(time_str).split(':')) >= 2:
                    time_parts = str(time_str).split(':')
                    hours = int(time_parts[0])
                    minutes = int(time_parts[1])
                    
                    # Validate hours and minutes
                    if 0 <= hours <= 23 and 0 <= minutes <= 59:
                        # Create datetime object
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        time_obj = date_obj.replace(hour=hours, minute=minutes, second=0, microsecond=0)
                        logger.info(f"Parsed 24-hour time: {time_obj}")
                        return time_obj
                
                logger.warning(f"Unable to parse time format: {time_str}")
                return None
                
            except Exception as e:
                logger.error(f"Error parsing time '{time_str}': {str(e)}")
                return None

        # Handle time updates and recalculate working time
        checkin_time = None
        checkout_time = None
        should_recalculate = False

        # Check for check-in time in various field names
        for checkin_field in ["checkin_time", "check_in_time", "check_in"]:
            if checkin_field in actual_data and actual_data[checkin_field]:
                logger.info(f"Processing check-in field '{checkin_field}': '{actual_data[checkin_field]}' (type: {type(actual_data[checkin_field])})")
                checkin_time = parse_time_to_datetime(actual_data[checkin_field])
                if checkin_time:
                    # Ensure we're storing a proper datetime object
                    if isinstance(checkin_time, datetime):
                        update_data["checkin_time"] = checkin_time
                        update_data["check_in_time"] = checkin_time  # Store in both formats
                        update_data["check_in"] = checkin_time  # Store in all formats
                        should_recalculate = True
                        logger.info(f"Successfully parsed and stored check-in time: {checkin_time}")
                    else:
                        logger.error(f"Parsed time is not a datetime object: {type(checkin_time)}")
                else:
                    logger.warning(f"Failed to parse check-in time: {actual_data[checkin_field]}")
                break

        # Check for check-out time in various field names  
        for checkout_field in ["checkout_time", "check_out_time", "check_out"]:
            if checkout_field in actual_data and actual_data[checkout_field]:
                logger.info(f"Processing check-out field '{checkout_field}': '{actual_data[checkout_field]}' (type: {type(actual_data[checkout_field])})")
                checkout_time = parse_time_to_datetime(actual_data[checkout_field])
                if checkout_time:
                    # Ensure we're storing a proper datetime object
                    if isinstance(checkout_time, datetime):
                        update_data["checkout_time"] = checkout_time
                        update_data["check_out_time"] = checkout_time  # Store in both formats
                        update_data["check_out"] = checkout_time  # Store in all formats
                        should_recalculate = True
                        logger.info(f"Successfully parsed and stored check-out time: {checkout_time}")
                    else:
                        logger.error(f"Parsed time is not a datetime object: {type(checkout_time)}")
                else:
                    logger.warning(f"Failed to parse check-out time: {actual_data[checkout_field]}")
                break

        # Get existing times if not provided in update
        if not checkin_time:
            checkin_time = attendance_record.get("checkin_time") or attendance_record.get("check_in_time")
        if not checkout_time:
            checkout_time = attendance_record.get("checkout_time") or attendance_record.get("check_out_time")

        # Recalculate working time if we have both times and should recalculate
        if should_recalculate and checkin_time and checkout_time:
            try:
                time_diff = checkout_time - checkin_time
                working_minutes = int(time_diff.total_seconds() / 60)
                working_hours = working_minutes / 60
                
                # Only update if not manually provided
                if "working_hours" not in actual_data:
                    update_data["total_working_minutes"] = working_minutes
                    update_data["working_hours"] = round(working_hours, 2)
                    
                    # Calculate overtime (8 hours = 480 minutes standard)
                    standard_minutes = 480
                    if working_minutes > standard_minutes:
                        overtime_minutes = working_minutes - standard_minutes
                        update_data["overtime_minutes"] = overtime_minutes
                        update_data["overtime_hours"] = round(overtime_minutes / 60, 2)
                    else:
                        update_data["overtime_minutes"] = 0
                        update_data["overtime_hours"] = 0
                        
                logger.info(f"Recalculated working time: {working_hours:.2f} hours ({working_minutes} minutes)")
                        
            except Exception as e:
                logger.error(f"Error calculating working time: {str(e)}")
                # Don't fail the update, just log the error
                pass
        
        logger.info(f"=== TIME FIELD PROCESSING END ===")
        
        # Update the record
        logger.info(f"=== DATABASE UPDATE DEBUG ===")
        logger.info(f"About to update attendance record {attendance_id} with data: {update_data}")
        logger.info(f"Update data keys: {list(update_data.keys())}")
        
        # Log each field being updated
        for key, value in update_data.items():
            logger.info(f"  UPDATE {key}: {value} (type: {type(value)})")
        
        result = db.attendance.update_one(
            {"_id": ObjectId(attendance_id)},
            {"$set": update_data}
        )
        logger.info(f"Update result: {result.modified_count} document(s) modified")
        logger.info(f"Update matched: {result.matched_count} document(s)")
        logger.info(f"=== DATABASE UPDATE COMPLETE ===")
        
        # Get updated record
        updated_record = db.attendance.find_one({"_id": ObjectId(attendance_id)})
        
        # Format the response to ensure all field mappings are included
        if updated_record:
            logger.info(f"Raw updated record from DB: {updated_record}")
            
            # Ensure all time fields are properly mapped for frontend compatibility
            checkin_time_field = updated_record.get("checkin_time") or updated_record.get("check_in_time") or updated_record.get("check_in")
            checkout_time_field = updated_record.get("checkout_time") or updated_record.get("check_out_time") or updated_record.get("check_out")
            
            logger.info(f"Extracted times - Check-in: {checkin_time_field}, Check-out: {checkout_time_field}")
            
            if checkin_time_field:
                updated_record["check_in"] = checkin_time_field
                updated_record["check_in_time"] = checkin_time_field
                updated_record["checkin_time"] = checkin_time_field
                
            if checkout_time_field:
                updated_record["check_out"] = checkout_time_field
                updated_record["check_out_time"] = checkout_time_field  
                updated_record["checkout_time"] = checkout_time_field
            
            # Ensure date field is mapped properly
            attendance_date = updated_record.get("attendance_date") or updated_record.get("date")
            if attendance_date:
                updated_record["date"] = attendance_date
                updated_record["attendance_date"] = attendance_date
            
            # Ensure working hours are properly calculated and mapped
            working_minutes = updated_record.get("total_working_minutes", 0)
            working_hours = updated_record.get("working_hours", 0)
            
            if not working_hours and working_minutes and working_minutes > 0:
                working_hours = working_minutes / 60
                updated_record["working_hours"] = round(working_hours, 2)
            elif working_hours:
                updated_record["working_hours"] = round(float(working_hours), 2)
                if not working_minutes:
                    updated_record["total_working_minutes"] = int(working_hours * 60)
        
        logger.info(f"Admin {admin_user_id} updated attendance record {attendance_id}")
        
        # Debug the final data being returned
        logger.info(f"=== RESPONSE DATA DEBUG ===")
        logger.info(f"Raw updated record from DB: {updated_record}")
        logger.info(f"Record keys: {list(updated_record.keys()) if updated_record else 'No record'}")
        
        # Convert ObjectId to string for JSON response
        response_data = convert_objectid_to_str(updated_record)
        logger.info(f"Response data after ObjectId conversion: {response_data}")
        
        # Log specific time fields in response
        if response_data:
            for time_field in ["checkin_time", "check_in_time", "check_in", "checkout_time", "check_out_time", "check_out"]:
                if time_field in response_data:
                    logger.info(f"  RESPONSE {time_field}: {response_data[time_field]}")
        
        logger.info(f"=== RESPONSE DATA DEBUG END ===")
        
        return {
            "success": True,
            "message": "Attendance record updated successfully",
            "data": response_data,
            "debug_info": {
                "original_request_structure": "nested" if len(data) == 1 and any(key.startswith('additionalProp') for key in data.keys()) else "direct",
                "processed_fields": list(update_data.keys()),
                "status_updated": "status" in actual_data,
                "new_status": actual_data.get("status") if "status" in actual_data else "unchanged"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in admin update attendance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/admin/all", status_code=200)
async def admin_get_all_attendance_records(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Records per page"),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin get all attendance records with filtering"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        # Get database reference
        db = get_database()
        
        # Build query filter
        query_filter = {}
        
        # Date filtering
        if start_date and end_date:
            if not validate_date_format(start_date) or not validate_date_format(end_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
            query_filter["attendance_date"] = {
                "$gte": start_date,
                "$lte": end_date
            }
        elif start_date:
            if not validate_date_format(start_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
            query_filter["attendance_date"] = {"$gte": start_date}
        elif end_date:
            if not validate_date_format(end_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
            query_filter["attendance_date"] = {"$lte": end_date}
        
        # Employee filtering
        if employee_id:
            query_filter["employee_id"] = employee_id
        
        # Status filtering
        if status:
            query_filter["status"] = status
        
        # Department filtering requires joining with users collection
        attendance_pipeline = [
            {"$match": query_filter},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"emp_id": "$employee_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$user_id", "$$emp_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$emp_id"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "employee"
                }
            },
            {"$unwind": {"path": "$employee", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "employee_name": {"$ifNull": ["$employee.full_name", {"$ifNull": ["$employee.name", "Unknown"]}]},
                    "employee_email": "$employee.email",
                    "employee_department": {"$ifNull": ["$employee.department", "Unassigned"]}
                }
            }
        ]
        
        if department:
            attendance_pipeline.append({
                "$match": {"employee.department": department}
            })
        
        # Add pagination
        attendance_pipeline.extend([
            {"$sort": {"attendance_date": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ])
        
        # Execute pipeline
        attendance_records = list(db.attendance.aggregate(attendance_pipeline))
        
        # Get total count for pagination
        count_pipeline = attendance_pipeline[:-2]  # Remove skip and limit
        count_pipeline.append({"$count": "total"})
        count_result = list(db.attendance.aggregate(count_pipeline))
        total_records = count_result[0]["total"] if count_result else 0
        
        # Format response
        formatted_records = []
        for record in attendance_records:
            employee_data = record.pop("employee", {})
            formatted_record = convert_objectid_to_str(record)
            
            # Add employee info
            formatted_record["employee_name"] = employee_data.get("full_name") or employee_data.get("name", "Unknown")
            formatted_record["employee_email"] = employee_data.get("email", "")
            formatted_record["employee_department"] = employee_data.get("department", "")
            
            # Ensure all time fields are properly mapped for frontend compatibility
            checkin_time = formatted_record.get("checkin_time") or formatted_record.get("check_in_time")
            checkout_time = formatted_record.get("checkout_time") or formatted_record.get("check_out_time")
            
            if checkin_time:
                formatted_record["check_in"] = checkin_time
                formatted_record["check_in_time"] = checkin_time
                formatted_record["checkin_time"] = checkin_time
                
            if checkout_time:
                formatted_record["check_out"] = checkout_time
                formatted_record["check_out_time"] = checkout_time  
                formatted_record["checkout_time"] = checkout_time
            
            # Ensure date field is mapped properly
            attendance_date = formatted_record.get("attendance_date") or formatted_record.get("date")
            if attendance_date:
                formatted_record["date"] = attendance_date
                formatted_record["attendance_date"] = attendance_date
            
            # Ensure working hours are calculated and mapped properly
            working_minutes = formatted_record.get("total_working_minutes", 0)
            if working_minutes and working_minutes > 0:
                working_hours = working_minutes / 60
                formatted_record["working_hours"] = round(working_hours, 2)
            else:
                # Try to calculate from times if available
                if checkin_time and checkout_time:
                    try:
                        if isinstance(checkin_time, str):
                            checkin_dt = datetime.fromisoformat(checkin_time.replace('Z', '+00:00'))
                        else:
                            checkin_dt = checkin_time
                            
                        if isinstance(checkout_time, str):
                            checkout_dt = datetime.fromisoformat(checkout_time.replace('Z', '+00:00'))
                        else:
                            checkout_dt = checkout_time
                            
                        time_diff = checkout_dt - checkin_dt
                        calculated_minutes = int(time_diff.total_seconds() / 60)
                        calculated_hours = calculated_minutes / 60
                        
                        formatted_record["working_hours"] = round(calculated_hours, 2)
                        formatted_record["total_working_minutes"] = calculated_minutes
                        
                        # Calculate overtime
                        standard_minutes = 480  # 8 hours
                        if calculated_minutes > standard_minutes:
                            overtime_minutes = calculated_minutes - standard_minutes
                            formatted_record["overtime_minutes"] = overtime_minutes
                            formatted_record["overtime_hours"] = round(overtime_minutes / 60, 2)
                        else:
                            formatted_record["overtime_minutes"] = 0
                            formatted_record["overtime_hours"] = 0
                            
                    except Exception as e:
                        logger.error(f"Error calculating working hours for record {formatted_record.get('_id')}: {str(e)}")
                        formatted_record["working_hours"] = 0
            
            formatted_records.append(formatted_record)
        
        # Calculate pagination
        total_pages = (total_records + limit - 1) // limit
        
        return {
            "success": True,
            "data": formatted_records,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_records": total_records,
                "records_per_page": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all attendance records: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/admin/employee/{employee_id}/records", status_code=200)
async def admin_get_employee_attendance(
    employee_id: str = Path(..., description="Employee ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(31, ge=1, le=100, description="Records per page"),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin get specific employee's attendance records"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        logger.info(f"Admin {current_user.get('username')} requesting attendance for employee: {employee_id}")
        logger.info(f"Query parameters: start_date={start_date}, end_date={end_date}, month={month}, year={year}")
        
        # Get database reference
        db = get_database()
        
        # Check if employee exists - try multiple ID field variations
        employee = None
        
        # Try finding employee by user_id first
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            # Try finding by _id if it's a valid ObjectId
            if ObjectId.is_valid(employee_id):
                employee = db.users.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            # Try finding by id field
            employee = db.users.find_one({"id": employee_id})
        if not employee:
            # Try finding by employee_id field
            employee = db.users.find_one({"employee_id": employee_id})
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee not found with ID: {employee_id}"
            )
        
        logger.info(f"Found employee: {employee.get('full_name')} with ID: {employee_id}")
        
        # Build query filter - try to match attendance records with multiple field variations
        query_conditions = [
            {"employee_id": employee_id},
            {"user_id": employee_id}
        ]
        
        # Add the employee's actual user_id if different from the parameter
        if employee.get("user_id") and employee.get("user_id") != employee_id:
            query_conditions.append({"employee_id": employee.get("user_id")})
            query_conditions.append({"user_id": employee.get("user_id")})
        
        # Add the employee's _id if different
        employee_object_id = str(employee.get("_id"))
        if employee_object_id != employee_id:
            query_conditions.append({"employee_id": employee_object_id})
            query_conditions.append({"user_id": employee_object_id})
        
        # Use $or query to match any of the possible field combinations
        query_filter = {"$or": query_conditions}
        
        logger.info(f"Query conditions for attendance lookup: {query_conditions}")
        
        # Handle date filtering (same logic as employee route)
        if start_date and end_date:
            if not validate_date_format(start_date) or not validate_date_format(end_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
            query_filter["attendance_date"] = {
                "$gte": start_date,
                "$lte": end_date
            }
        elif month and year:
            start_of_month = date(year, month, 1)
            if month == 12:
                end_of_month = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_of_month = date(year, month + 1, 1) - timedelta(days=1)
            
            query_filter["attendance_date"] = {
                "$gte": start_of_month.strftime("%Y-%m-%d"),
                "$lte": end_of_month.strftime("%Y-%m-%d")
            }
        
        logger.info(f"Final query filter: {query_filter}")
        
        # Get total count
        total_records = db.attendance.count_documents(query_filter)
        logger.info(f"Total attendance records found: {total_records}")
        
        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_records + limit - 1) // limit
        
        # Get attendance records
        attendance_records = list(
            db.attendance.find(query_filter)
            .sort("attendance_date", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Convert to response format
        formatted_records = []
        for record in attendance_records:
            formatted_record = convert_objectid_to_str(record)
            formatted_records.append(formatted_record)
        
        logger.info(f"Returning {len(formatted_records)} formatted records")
        
        return {
            "success": True,
            "employee": {
                "employee_id": employee_id,
                "name": employee.get("full_name") or employee.get("name"),
                "email": employee.get("email"),
                "department": employee.get("department")
            },
            "data": {
                "records": formatted_records,
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "total_records": total_records,
                    "records_per_page": limit
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employee attendance records: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.delete("/admin/delete/{attendance_id}", status_code=200)
async def admin_delete_attendance(
    attendance_id: str = Path(..., description="Attendance record ID"),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin delete attendance record"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR or Admin access required."
            )
        
        # Validate attendance ID
        if not ObjectId.is_valid(attendance_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid attendance record ID"
            )
        
        # Get database reference
        db = get_database()
        
        # Find and delete the record
        result = db.attendance.delete_one({"_id": ObjectId(attendance_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found"
            )
        
        admin_user_id = get_user_id(current_user)
        logger.info(f"Admin {admin_user_id} deleted attendance record {attendance_id}")
        
        return {
            "success": True,
            "message": "Attendance record deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting attendance record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.post("/validate-location", status_code=200)
async def validate_attendance_location(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Validate if employee location is within allowed geofence for attendance"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Validate required location fields
        if "latitude" not in data or "longitude" not in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Latitude and longitude are required"
            )
        
        user_lat = float(data["latitude"])
        user_lon = float(data["longitude"])
        
        # Get database reference
        db = get_database()
        
        # Get employee information and office locations
        employee = db.users.find_one({"user_id": user_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Define office locations (you can store these in database)
        office_locations = [
            {
                "name": "Main Office",
                "latitude": 28.6139,  # Example: New Delhi coordinates
                "longitude": 77.2090,
                "radius_meters": 100  # 100 meter radius
            },
            {
                "name": "Branch Office",
                "latitude": 28.7041,  # Example: Gurgaon coordinates
                "longitude": 77.1025,
                "radius_meters": 150
            }
        ]
        
        # You can also get this from database based on employee's assigned office
        # office_locations = list(db.office_locations.find({"active": True}))
        
        def calculate_distance(lat1, lon1, lat2, lon2):
            """Calculate distance between two coordinates using Haversine formula"""
            import math
            
            # Convert latitude and longitude from degrees to radians
            lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
            
            # Haversine formula
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            r = 6371000  # Radius of earth in meters
            
            return c * r
        
        # Check if user is within any allowed location
        valid_locations = []
        for office in office_locations:
            distance = calculate_distance(
                user_lat, user_lon,
                office["latitude"], office["longitude"]
            )
            
            if distance <= office["radius_meters"]:
                valid_locations.append({
                    "office_name": office["name"],
                    "distance_meters": round(distance, 2),
                    "within_radius": True
                })
            else:
                valid_locations.append({
                    "office_name": office["name"],
                    "distance_meters": round(distance, 2),
                    "within_radius": False
                })
        
        is_valid_location = any(loc["within_radius"] for loc in valid_locations)
        
        # Check if work from home is enabled for this employee
        work_from_home_enabled = employee.get("work_from_home_enabled", False)
        if work_from_home_enabled:
            is_valid_location = True
        
        return {
            "success": True,
            "data": {
                "is_valid_location": is_valid_location,
                "work_from_home_enabled": work_from_home_enabled,
                "user_location": {
                    "latitude": user_lat,
                    "longitude": user_lon,
                    "address": data.get("address", "")
                },
                "office_locations": valid_locations,
                "message": "Location validated successfully" if is_valid_location else "You are not within any allowed office location"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating location: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/working-hours-config", status_code=200)
async def get_working_hours_config(
    current_user: dict = Depends(get_current_user)
):
    """Get working hours configuration for employee"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Get employee information
        employee = db.users.find_one({"user_id": user_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Get working hours configuration (can be employee-specific or default)
        working_hours_config = {
            "standard_hours_per_day": 8,
            "standard_minutes_per_day": 480,
            "work_start_time": "09:00",
            "work_end_time": "18:00",
            "late_threshold_minutes": 15,
            "early_leave_threshold_minutes": 15,
            "minimum_hours_for_half_day": 4,
            "break_time_minutes": 60,
            "overtime_rate": 1.5,
            "weekend_days": ["Saturday", "Sunday"],
            "flexible_timing": False,
            "core_hours": {
                "start": "10:00",
                "end": "16:00"
            },
            "shifts": {
                "day": {
                    "start_time": "09:00",
                    "end_time": "18:00",
                    "break_minutes": 60
                },
                "evening": {
                    "start_time": "14:00",
                    "end_time": "23:00",
                    "break_minutes": 60
                },
                "night": {
                    "start_time": "22:00",
                    "end_time": "07:00",
                    "break_minutes": 60
                }
            }
        }
        
        # Override with employee-specific configuration if available
        if employee.get("working_hours_config"):
            working_hours_config.update(employee["working_hours_config"])
        
        return {
            "success": True,
            "data": working_hours_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting working hours config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# =================== DASHBOARD/ANALYTICS ROUTES ===================

@attendance_router.get("/admin/dashboard-stats", status_code=200)
async def get_attendance_dashboard_stats(
    date: Optional[str] = Query(None, description="Specific date (YYYY-MM-DD), defaults to today"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance dashboard statistics for HR/Admin"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. HR/Admin permissions required."
            )
        
        # Get database reference
        db = get_database()
        
        # Use provided date or today
        target_date = date if date else datetime.now().date().strftime("%Y-%m-%d")
        
        # Validate date format
        if not validate_date_format(target_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD."
            )
        
        # Aggregation pipeline for today's stats
        pipeline = [
            {
                "$match": {
                    "attendance_date": target_date
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_records": {"$sum": 1},
                    "present_count": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "present"]}, 1, 0]
                        }
                    },
                    "absent_count": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "absent"]}, 1, 0]
                        }
                    },
                    "late_count": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "late"]}, 1, 0]
                        }
                    },
                    "leave_count": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "leave"]}, 1, 0]
                        }
                    },
                    "half_day_count": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "half_day"]}, 1, 0]
                        }
                    }
                }
            }
        ]
        
        result = list(db.attendance.aggregate(pipeline))
        stats = result[0] if result else {
            "total_records": 0,
            "present_count": 0,
            "absent_count": 0,
            "late_count": 0,
            "leave_count": 0,
            "half_day_count": 0
        }
        
        # Calculate attendance percentage
        total_employees = stats.get("total_records", 0)
        present_employees = stats.get("present_count", 0)
        attendance_percentage = (present_employees / total_employees * 100) if total_employees > 0 else 0
        
        # Get total employees from users collection for comparison
        total_active_employees = db.users.count_documents({"is_active": {"$ne": False}})
        
        dashboard_stats = {
            "date": target_date,
            "present_today": stats.get("present_count", 0),
            "absent_today": stats.get("absent_count", 0),
            "late_entries": stats.get("late_count", 0),
            "on_leave": stats.get("leave_count", 0),
            "half_day": stats.get("half_day_count", 0),
            "attendance_percentage": round(attendance_percentage, 1),
            "total_marked_attendance": total_employees,
            "total_active_employees": total_active_employees,
            "unmarked_attendance": max(0, total_active_employees - total_employees)
        }
        
        return {
            "success": True,
            "data": dashboard_stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/statistics", status_code=200)
async def get_attendance_statistics(
    days: Optional[int] = Query(7, description="Number of days for statistics"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance statistics for dashboard (7-day trend)"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. HR/Admin permissions required."
            )
        
        # Get database reference
        db = get_database()
        
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        # Get attendance data for the date range
        attendance_records = list(db.attendance.find({
            "attendance_date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": end_date.strftime("%Y-%m-%d")
            }
        }))
        
        # Get total active employees
        total_active_employees = db.users.count_documents({"is_active": True})
        
        # Calculate today's attendance
        today_str = end_date.strftime("%Y-%m-%d")
        today_records = [r for r in attendance_records if r.get("attendance_date") == today_str]
        
        present_today = len([r for r in today_records if r.get("status") == "present"])
        absent_today = total_active_employees - present_today
        
        # Calculate yesterday's attendance for trend
        yesterday = end_date - timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y-%m-%d")
        yesterday_records = [r for r in attendance_records if r.get("attendance_date") == yesterday_str]
        present_yesterday = len([r for r in yesterday_records if r.get("status") == "present"])
        
        # Calculate attendance percentages
        today_attendance_percentage = (present_today / total_active_employees * 100) if total_active_employees > 0 else 0
        yesterday_attendance_percentage = (present_yesterday / total_active_employees * 100) if total_active_employees > 0 else 0
        
        return {
            "success": True,
            "data": {
                "today_attendance_percentage": round(today_attendance_percentage, 1),
                "yesterday_attendance_percentage": round(yesterday_attendance_percentage, 1),
                "present_today": present_today,
                "absent_today": absent_today,
                "total_employees": total_active_employees,
                "period_days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting attendance statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/admin/filters/departments", status_code=200)
async def get_departments_for_filter(
    current_user: dict = Depends(get_current_user)
):
    """Get list of departments for filtering"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. HR/Admin permissions required."
            )
        
        # Get database reference
        db = get_database()
        
        # Get unique departments from users collection
        departments = db.users.distinct("department", {"department": {"$ne": None, "$ne": ""}})
        departments = [dept for dept in departments if dept]  # Remove empty/null values
        departments.sort()  # Sort alphabetically
        
        return {
            "success": True,
            "data": departments
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting departments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/admin/filters/employees", status_code=200)
async def get_employees_for_filter(
    department: Optional[str] = Query(None, description="Filter by department"),
    current_user: dict = Depends(get_current_user)
):
    """Get list of employees for filtering"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. HR/Admin permissions required."
            )
        
        # Get database reference
        db = get_database()
        
        # Build filter to exclude system administrators and admin roles
        filter_criteria = {
            "is_active": {"$ne": False},
            # Exclude system administrators and admin roles
            "role": {
                "$nin": [
                    "admin", 
                    "administrator", 
                    "system_admin", 
                    "system_administrator",
                    "super_admin",
                    "superadmin"
                ]
            },
            # Also exclude by username patterns commonly used for admin accounts
            "username": {
                "$not": {
                    "$regex": "^(admin|administrator|system|root|superuser).*",
                    "$options": "i"
                }
            },
            # Exclude by full name patterns
            "full_name": {
                "$not": {
                    "$regex": "^(system administrator|admin|administrator).*",
                    "$options": "i"
                }
            }
        }
        
        if department:
            filter_criteria["department"] = department
        
        # Get employees
        employees = list(db.users.find(
            filter_criteria,
            {
                "user_id": 1,
                "full_name": 1,
                "name": 1,
                "email": 1,
                "department": 1,
                "_id": 1
            }
        ).sort("full_name", 1))
        
        # Format response
        employee_list = []
        for emp in employees:
            employee_list.append({
                "employee_id": emp.get("user_id") or str(emp.get("_id")),
                "name": emp.get("full_name") or emp.get("name") or "Unknown",
                "email": emp.get("email"),
                "department": emp.get("department")
            })
        
        return {
            "success": True,
            "data": employee_list
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting employees: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# =================== REPORTING ROUTES ===================

@attendance_router.get("/reports/summary", status_code=200)
async def get_attendance_summary_report(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None, description="Specific employee ID"),
    department: Optional[str] = Query(None, description="Filter by department"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance summary report (accessible by employees for themselves, HR/Admin for all)"""
    try:
        # Get user ID and check permissions
        user_id = get_user_id(current_user)
        is_hr_admin = has_hr_admin_permission(current_user)
        
        # If not HR/Admin, can only view own records
        if not is_hr_admin:
            if employee_id and employee_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own attendance summary"
                )
            employee_id = user_id
        
        # Validate date format
        if not validate_date_format(start_date) or not validate_date_format(end_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get database reference
        db = get_database()
        
        # Build aggregation pipeline
        pipeline = [
            {
                "$match": {
                    "attendance_date": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            }
        ]
        
        # Add employee filter if specified
        if employee_id:
            pipeline[0]["$match"]["employee_id"] = employee_id
        
        # Join with users collection
        pipeline.extend([
            {
                "$lookup": {
                    "from": "users",
                    "let": {"emp_id": "$employee_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$user_id", "$$emp_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$emp_id"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "employee"
                }
            },
            {"$unwind": {"path": "$employee", "preserveNullAndEmptyArrays": True}},
        ])
        
        # Add department filter if specified
        if department:
            pipeline.append({
                "$match": {"employee.department": department}
            })
        
        # Group by employee and calculate statistics
        pipeline.append({
            "$group": {
                "_id": "$employee_id",
                "employee_name": {"$first": "$employee.full_name"},
                "employee_email": {"$first": "$employee.email"},
                "employee_department": {"$first": "$employee.department"},
                "total_days": {"$sum": 1},
                "present_days": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "present"]}, 1, 0]
                    }
                },
                "absent_days": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "absent"]}, 1, 0]
                    }
                },
                "late_days": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "late"]}, 1, 0]
                    }
                },
                "leave_days": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "leave"]}, 1, 0]
                    }
                },
                "total_working_minutes": {
                    "$sum": {"$ifNull": ["$total_working_minutes", 0]}
                },
                "overtime_minutes": {
                    "$sum": {"$ifNull": ["$overtime_minutes", 0]}
                }
            }
        })
        
        # Execute pipeline
        summary_data = list(db.attendance.aggregate(pipeline))
        
        # Format response
        formatted_summary = []
        for summary in summary_data:
            formatted_summary.append({
                "employee_id": summary["_id"],
                "employee_name": summary.get("employee_name", "Unknown"),
                "employee_email": summary.get("employee_email", ""),
                "employee_department": summary.get("employee_department", ""),
                "total_days": summary["total_days"],
                "present_days": summary["present_days"],
                "absent_days": summary["absent_days"],
                "late_days": summary["late_days"],
                "leave_days": summary["leave_days"],
                "total_working_hours": round(summary["total_working_minutes"] / 60, 2),
                "overtime_hours": round(summary["overtime_minutes"] / 60, 2),
                "attendance_percentage": round(
                    (summary["present_days"] / summary["total_days"]) * 100, 2
                ) if summary["total_days"] > 0 else 0
            })
        
        return {
            "success": True,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": formatted_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting attendance summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# =================== LEAVE MANAGEMENT ROUTES ===================

@attendance_router.post("/leave/request", status_code=201)
async def submit_leave_request(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Employee submit leave request"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User information not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Validate required fields
        required_fields = ["leave_type", "start_date", "end_date", "reason"]
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )
        
        # Validate date format and logic
        if not validate_date_format(data["start_date"]) or not validate_date_format(data["end_date"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date cannot be after end date"
            )
        
        if start_date < date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date cannot be in the past"
            )
        
        # Calculate days requested
        days_requested = (end_date - start_date).days + 1
        
        # Create leave request record
        now = datetime.now()
        leave_request = {
            "user_id": user_id,
            "employee_id": user_id,
            "leave_type": data["leave_type"].lower().replace(" ", "_"),
            "start_date": data["start_date"],
            "end_date": data["end_date"],
            "days_requested": days_requested,
            "reason": data["reason"],
            "status": "pending",
            "requested_at": now,
            "is_half_day": data.get("is_half_day", False),
            "emergency_contact": data.get("emergency_contact", ""),
            "emergency_phone": data.get("emergency_phone", ""),
            "applied_to_id": data.get("applied_to_id"),
            "created_by": user_id,
            "last_modified": now
        }
        
        # Insert leave request
        result = db.leave_requests.insert_one(leave_request)
        leave_request["_id"] = result.inserted_id
        
        logger.info(f"Leave request created for user {user_id}")
        
        return {
            "success": True,
            "message": "Leave request submitted successfully",
            "data": convert_objectid_to_str(leave_request)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting leave request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/my-requests", status_code=200)
async def get_my_leave_requests(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Records per page"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user)
):
    """Get employee's own leave requests"""
    try:
        # Get user ID
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User information not found"
            )
        
        # Get database reference
        db = get_database()
        
        # Build query filter
        query_filter = {"user_id": user_id}
        
        if status_filter and status_filter.lower() != "all":
            query_filter["status"] = status_filter.lower()
        
        # Get total count
        total_records = db.leave_requests.count_documents(query_filter)
        
        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_records + limit - 1) // limit
        
        # Get leave requests
        leave_requests = list(
            db.leave_requests.find(query_filter)
            .sort("requested_at", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Get user info for applied_to names
        for request in leave_requests:
            if request.get("applied_to_id"):
                applied_to_user = db.users.find_one({"user_id": request["applied_to_id"]})
                if applied_to_user:
                    request["applied_to_name"] = applied_to_user.get("full_name", applied_to_user.get("name", "Unknown"))
        
        return {
            "success": True,
            "data": convert_objectid_to_str(leave_requests),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_records,
                "total_pages": total_pages
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leave requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/admin/all", status_code=200)
async def admin_get_all_leave_requests(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=100, description="Records per page"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    start_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin get all leave requests with filtering"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR/Admin access required."
            )
        
        # Get database reference
        db = get_database()
        
        # Build query filter
        query_filter = {}
        
        if status_filter and status_filter.lower() != "all":
            query_filter["status"] = status_filter.lower()
        
        if employee_id:
            query_filter["user_id"] = employee_id
        
        if leave_type and leave_type.lower() != "all":
            query_filter["leave_type"] = leave_type.lower().replace(" ", "_")
        
        # Date range filtering
        if start_date and end_date:
            if validate_date_format(start_date) and validate_date_format(end_date):
                query_filter["start_date"] = {
                    "$gte": start_date,
                    "$lte": end_date
                }
        
        # Get total count
        total_records = db.leave_requests.count_documents(query_filter)
        
        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_records + limit - 1) // limit
        
        # Get leave requests
        leave_requests = list(
            db.leave_requests.find(query_filter)
            .sort("requested_at", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Enrich with user information
        for request in leave_requests:
            # Get employee info
            employee = db.users.find_one({"user_id": request["user_id"]})
            if employee:
                request["employee_name"] = employee.get("full_name", employee.get("name", "Unknown"))
                request["employee_email"] = employee.get("email", "")
            
            # Get applied_to info
            if request.get("applied_to_id"):
                applied_to = db.users.find_one({"user_id": request["applied_to_id"]})
                if applied_to:
                    request["applied_to_name"] = applied_to.get("full_name", applied_to.get("name", "Unknown"))
            
            # Get reviewed_by info if available
            if request.get("reviewed_by_id"):
                reviewed_by = db.users.find_one({"user_id": request["reviewed_by_id"]})
                if reviewed_by:
                    request["reviewed_by_name"] = reviewed_by.get("full_name", reviewed_by.get("name", "Unknown"))
        
        return {
            "success": True,
            "data": convert_objectid_to_str(leave_requests),
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_records,
                "total_pages": total_pages
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all leave requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.put("/leave/admin/action/{leave_id}", status_code=200)
async def admin_leave_action(
    leave_id: str = Path(..., description="Leave request ID"),
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin approve or reject leave request"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR/Admin access required."
            )
        
        # Validate action
        action = data.get("action", "").lower()
        if action not in ["approve", "reject"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid action. Must be 'approve' or 'reject'"
            )
        
        # Get database reference
        db = get_database()
        
        # Find leave request
        try:
            leave_request = db.leave_requests.find_one({"_id": ObjectId(leave_id)})
        except:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave request not found"
            )
        
        if not leave_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave request not found"
            )
        
        if leave_request.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leave request is already {leave_request.get('status')}"
            )
        
        # Update leave request
        now = datetime.now()
        reviewer_id = get_user_id(current_user)
        
        update_data = {
            "status": "approved" if action == "approve" else "rejected",
            "reviewed_by_id": reviewer_id,
            "reviewed_by": data.get("reviewed_by", current_user.get("name", "Admin")),
            "reviewed_at": now,
            "last_modified": now
        }
        
        if action == "reject":
            update_data["rejection_reason"] = data.get("remarks", data.get("reason", ""))
        else:
            update_data["approved_at"] = now
            update_data["remarks"] = data.get("remarks", "")
        
        # Update in database
        db.leave_requests.update_one(
            {"_id": ObjectId(leave_id)},
            {"$set": update_data}
        )
        
        # Get updated record
        updated_request = db.leave_requests.find_one({"_id": ObjectId(leave_id)})
        
        logger.info(f"Leave request {leave_id} {action}d by {reviewer_id}")
        
        return {
            "success": True,
            "message": f"Leave request {action}d successfully",
            "data": convert_objectid_to_str(updated_request)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing leave action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/balances/{employee_id}", status_code=200)
async def get_employee_leave_balance(
    employee_id: str = Path(..., description="Employee ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get leave balance for an employee"""
    try:
        user_id = get_user_id(current_user)
        
        # Check if user can view this data (self or HR/Admin)
        if user_id != employee_id and not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Get database reference
        db = get_database()
        
        # Check if employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Get existing leave balance or create default
        leave_balance = db.leave_balances.find_one({"employee_id": employee_id})
        
        if not leave_balance:
            # Create default leave balance (adjust values as per company policy)
            default_balance = {
                "employee_id": employee_id,
                "annual_leave": 21,  # Annual leave days
                "sick_leave": 12,    # Sick leave days  
                "casual_leave": 7,   # Casual leave days
                "maternity_leave": 182,  # Maternity leave days
                "paternity_leave": 15,   # Paternity leave days
                "last_updated": datetime.now(),
                "created_at": datetime.now()
            }
            
            result = db.leave_balances.insert_one(default_balance)
            leave_balance = default_balance
            leave_balance["_id"] = result.inserted_id
        
        return {
            "success": True,
            "data": convert_objectid_to_str(leave_balance)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leave balance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.patch("/leave/admin/balance/{employee_id}", status_code=200)
async def admin_update_leave_balance(
    employee_id: str = Path(..., description="Employee ID"),
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """HR/Admin update employee leave balance"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR/Admin access required."
            )
        
        # Get database reference
        db = get_database()
        
        # Check if employee exists
        employee = db.users.find_one({"user_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Build update data
        update_data = {
            "last_updated": datetime.now(),
            "updated_by": get_user_id(current_user)
        }
        
        # Update leave balances if provided
        leave_fields = ["annual_leave", "sick_leave", "casual_leave", "maternity_leave", "paternity_leave"]
        for field in leave_fields:
            if field in data and isinstance(data[field], (int, float)):
                update_data[field] = max(0, int(data[field]))  # Ensure non-negative values
        
        if len(update_data) <= 2:  # Only timestamp and updated_by
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid leave balance fields provided"
            )
        
        # Update or create leave balance
        result = db.leave_balances.update_one(
            {"employee_id": employee_id},
            {"$set": update_data, "$setOnInsert": {"created_at": datetime.now(), "employee_id": employee_id}},
            upsert=True
        )
        
        # Get updated balance
        updated_balance = db.leave_balances.find_one({"employee_id": employee_id})
        
        logger.info(f"Leave balance updated for employee {employee_id}")
        
        return {
            "success": True,
            "message": "Leave balance updated successfully",
            "data": convert_objectid_to_str(updated_balance)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating leave balance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/types", status_code=200)
async def get_leave_types(
    current_user: dict = Depends(get_current_user)
):
    """Get available leave types"""
    try:
        leave_types = [
            {
                "id": "annual_leave",
                "name": "Annual Leave",
                "description": "Yearly vacation leave"
            },
            {
                "id": "sick_leave", 
                "name": "Sick Leave",
                "description": "Medical leave for illness"
            },
            {
                "id": "casual_leave",
                "name": "Casual Leave", 
                "description": "Short-term personal leave"
            },
            {
                "id": "maternity_leave",
                "name": "Maternity Leave",
                "description": "Leave for childbirth and childcare"
            },
            {
                "id": "paternity_leave",
                "name": "Paternity Leave",
                "description": "Leave for fathers after childbirth"
            },
            {
                "id": "emergency_leave",
                "name": "Emergency Leave",
                "description": "Urgent personal or family emergency"
            }
        ]
        
        return {
            "success": True,
            "data": leave_types
        }
        
    except Exception as e:
        logger.error(f"Error getting leave types: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/hr-managers", status_code=200)
async def get_hr_managers(
    current_user: dict = Depends(get_current_user)
):
    """Get list of HR managers for leave approval"""
    try:
        # Get database reference
        db = get_database()
        
        # Find users with HR roles
        hr_roles = ["hr", "hr_admin", "hr_manager", "admin", "manager"]
        
        # Query for HR managers
        hr_managers = list(db.users.find({
            "$or": [
                {"role": {"$in": hr_roles}},
                {"roles": {"$in": hr_roles}},
                {"role_names": {"$in": hr_roles}}
            ]
        }, {
            "user_id": 1,
            "name": 1,
            "email": 1,
            "role": 1,
            "roles": 1,
            "role_names": 1
        }))
        
        # Format HR managers
        formatted_managers = []
        for manager in hr_managers:
            manager_data = {
                "id": manager.get("user_id"),
                "name": manager.get("name", "Unknown"),
                "email": manager.get("email", ""),
                "role": manager.get("role", "")
            }
            
            # Determine primary role
            if manager.get("roles"):
                manager_data["role"] = manager["roles"][0] if isinstance(manager["roles"], list) else str(manager["roles"])
            elif manager.get("role_names"):
                manager_data["role"] = manager["role_names"][0] if isinstance(manager["role_names"], list) else str(manager["role_names"])
            
            formatted_managers.append(manager_data)
        
        return {
            "success": True,
            "data": convert_objectid_to_str(formatted_managers)
        }
        
    except Exception as e:
        logger.error(f"Error getting HR managers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@attendance_router.get("/leave/dashboard-stats", status_code=200)
async def get_leave_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get leave dashboard statistics for HR/Admin"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. HR/Admin access required."
            )
        
        # Get database reference
        db = get_database()
        
        # Get leave request statistics
        total_requests = db.leave_requests.count_documents({})
        pending_requests = db.leave_requests.count_documents({"status": "pending"})
        approved_requests = db.leave_requests.count_documents({"status": "approved"})
        rejected_requests = db.leave_requests.count_documents({"status": "rejected"})
        
        # Get current month statistics
        current_month_start = date.today().replace(day=1).strftime("%Y-%m-%d")
        current_month_stats = {
            "total": db.leave_requests.count_documents({
                "requested_at": {"$gte": datetime.strptime(current_month_start, "%Y-%m-%d")}
            }),
            "pending": db.leave_requests.count_documents({
                "status": "pending",
                "requested_at": {"$gte": datetime.strptime(current_month_start, "%Y-%m-%d")}
            }),
            "approved": db.leave_requests.count_documents({
                "status": "approved", 
                "requested_at": {"$gte": datetime.strptime(current_month_start, "%Y-%m-%d")}
            })
        }
        
        # Get leave type breakdown
        leave_type_stats = list(db.leave_requests.aggregate([
            {"$group": {
                "_id": "$leave_type",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}}
        ]))
        
        return {
            "success": True,
            "data": {
                "total_requests": total_requests,
                "pending_requests": pending_requests,
                "approved_requests": approved_requests,
                "rejected_requests": rejected_requests,
                "current_month": current_month_stats,
                "leave_types": leave_type_stats
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leave dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# =================== HR-SPECIFIC ENDPOINTS ===================

@hr_router.get("/attendance/statistics", status_code=200)
async def get_hr_attendance_statistics(
    days: Optional[int] = Query(None, description="Number of days for statistics (if not provided, shows all data)"),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance statistics for HR dashboard"""
    try:
        # Check HR/Admin permissions
        if not has_hr_admin_permission(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. HR/Admin permissions required."
            )
        
        # Get database reference
        db = get_database()
        
        # Calculate date range
        end_date = datetime.now().date()
        
        # If days is provided, use it; otherwise get all data (last 30 days for performance)
        if days:
            start_date = end_date - timedelta(days=days-1)
            date_filter = {
                "attendance_date": {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                }
            }
        else:
            # Get all data (last 30 days for performance, but can be adjusted)
            start_date = end_date - timedelta(days=30)
            date_filter = {}  # No date filter to get all data
        
        # Get attendance data
        attendance_records = list(db.attendance.find(date_filter))
        
        # Get total active employees
        total_active_employees = db.users.count_documents({"is_active": True})
        
        # Calculate today's attendance
        today_str = end_date.strftime("%Y-%m-%d")
        today_records = [r for r in attendance_records if r.get("attendance_date") == today_str]
        
        present_today = len([r for r in today_records if r.get("status") == "present"])
        absent_today = total_active_employees - present_today
        
        # Calculate yesterday's attendance for trend
        yesterday = end_date - timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y-%m-%d")
        yesterday_records = [r for r in attendance_records if r.get("attendance_date") == yesterday_str]
        present_yesterday = len([r for r in yesterday_records if r.get("status") == "present"])
        
        # Calculate attendance percentages
        today_attendance_percentage = (present_today / total_active_employees * 100) if total_active_employees > 0 else 0
        yesterday_attendance_percentage = (present_yesterday / total_active_employees * 100) if total_active_employees > 0 else 0
        
        # Build weekly attendance trend data (last 7 days regardless of filter)
        trend_data = []
        for i in range(6, -1, -1):  # Last 7 days
            date_check = end_date - timedelta(days=i)
            date_str = date_check.strftime("%Y-%m-%d")
            
            day_records = [r for r in attendance_records if r.get("attendance_date") == date_str]
            day_present = len([r for r in day_records if r.get("status") == "present"])
            day_absent = total_active_employees - day_present
            
            trend_data.append({
                "date": date_str,
                "present": day_present,
                "absent": day_absent
            })
        
        return {
            "success": True,
            "today_attendance_percentage": round(today_attendance_percentage, 1),
            "yesterday_attendance_percentage": round(yesterday_attendance_percentage, 1),
            "present_today": present_today,
            "absent_today": absent_today,
            "total_employees": total_active_employees,
            "period_days": days if days else "all",
            "start_date": start_date.isoformat() if days else None,
            "end_date": end_date.isoformat(),
            "daily_trend": trend_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting HR attendance statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Export the router
def get_router():
    return attendance_router

def get_hr_router():
    return hr_router
