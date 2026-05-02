"""
Employees API Routes - Alias/Proxy to Auth Routes
This provides backward compatibility for /api/employees/ endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from typing import Dict, Any
from app.dependencies import get_current_user
from app.database.repositories.user_repository import UserRepository
from app.database.schemas.user_schema import UserUpdate
from app.services.auth_service import AuthService
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Create router with /api/employees prefix
employees_router = APIRouter(
    prefix="/api/employees",
    tags=["Employees"]
)


@employees_router.put("/{employee_id}", response_model=Dict[str, Any])
async def update_employee(
    employee_id: str,
    employee_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Update employee information (alias to auth/users endpoint)
    This provides backward compatibility for old frontend code
    """
    try:
        logger.info(f"Updating employee via /api/employees/{employee_id}")
        
        user_repo = UserRepository()
        auth_service = AuthService()
        
        # Convert employee_data to UserUpdate format
        update_data = {}
        
        # Map common fields
        field_mapping = {
            'full_name': 'full_name',
            'name': 'full_name',
            'email': 'email',
            'phone': 'phone',
            'department': 'department',
            'is_active': 'is_active',
            'role': 'roles',
            'roles': 'roles',
            'role_ids': 'role_ids',
            'reporting_user_id': 'reporting_user_id',
            'reports_to': 'reporting_user_id'
        }
        
        for key, value in employee_data.items():
            if key in field_mapping and value is not None:
                mapped_key = field_mapping[key]
                update_data[mapped_key] = value
            elif key not in ['user_id', 'id', '_id', 'employee_id', 'password', 'username']:
                # Pass through other fields that aren't IDs or sensitive
                update_data[key] = value
        
        # Handle password if provided
        if 'password' in employee_data and employee_data['password']:
            update_data['password'] = auth_service.get_password_hash(employee_data['password'])
        
        # Add updated timestamp
        update_data['updated_at'] = datetime.now()
        
        # First check if user exists (try both _id and user_id fields)
        from app.database import get_database
        from bson import ObjectId
        
        db = get_database()
        
        # Try to find user by user_id first, then by _id
        user_record = db.users.find_one({
            "$or": [
                {"user_id": employee_id},
                {"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None}
            ]
        })
        
        if not user_record:
            logger.warning(f"Employee with ID {employee_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee not found with ID: {employee_id}"
            )
        
        # Get the actual user_id from the record
        actual_user_id = user_record.get("user_id")
        
        # Handle hierarchy if reporting_user_id is provided
        reporting_user_id = update_data.get('reporting_user_id')
        if reporting_user_id is not None:
            from app.services.user_hierarchy_service import UserHierarchyService
            try:
                try:
                    await UserHierarchyService.get_hierarchy(actual_user_id)
                    await UserHierarchyService.update_hierarchy(actual_user_id, reporting_user_id)
                except ValueError:
                    await UserHierarchyService.create_hierarchy(actual_user_id, reporting_user_id)
            except Exception as e:
                logger.warning(f"Hierarchy update warning: {str(e)}")
        
        # Update using the actual user_id
        result = db.users.update_one(
            {"user_id": actual_user_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            # Fetch updated user
            updated_user = db.users.find_one({"user_id": actual_user_id})
            
            if updated_user:
                # Convert ObjectId to string for JSON serialization
                if '_id' in updated_user:
                    updated_user['_id'] = str(updated_user['_id'])
                
                # Remove sensitive data
                if 'password' in updated_user:
                    del updated_user['password']
                
                logger.info(f"Successfully updated employee {employee_id}")
                return updated_user
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found after update"
                )
        else:
            logger.error(f"Failed to update employee {employee_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update employee"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating employee: {str(e)}"
        )


@employees_router.get("/{employee_id}", response_model=Dict[str, Any])
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get employee by ID"""
    try:
        from app.database import get_database
        from bson import ObjectId
        
        db = get_database()
        
        # Try to find user by user_id first, then by _id
        user = db.users.find_one({
            "$or": [
                {"user_id": employee_id},
                {"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None}
            ]
        })
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee not found with ID: {employee_id}"
            )
        
        # Convert ObjectId to string for JSON serialization
        if '_id' in user:
            user['_id'] = str(user['_id'])
        
        # Remove sensitive data
        if 'password' in user:
            del user['password']
            
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching employee: {str(e)}"
        )
