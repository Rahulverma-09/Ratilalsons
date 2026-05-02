from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import logging

# Import authentication and database dependencies
from app.dependencies import get_current_user
from app.database import get_database
from app.database.schemas.payroll_schema import (
    PayrollConfig,
    PayrollConfigCreate,
    PayrollConfigResponse,
    SalaryStructure,
    SalaryStructureCreate,
    SalaryStructureResponse,
    SalaryStructuresListResponse,
    PayrollCalculation,
    PayrollRecord
)
from pydantic import BaseModel
from typing import Union

# Additional schemas for the new functionality
class PayrollTicket(BaseModel):
    employee_id: str
    subject: str
    description: str
    category: str = "payroll"
    priority: str = "medium"
    status: str = "open"
    created_at: datetime = None
    
class BonusDeduction(BaseModel):
    employee_id: str
    type: str  # "bonus", "incentive", "deduction"
    amount: float
    reason: str
    period: str
    approved_by: str = None
    status: str = "draft"
    created_at: datetime = None
    
class PaymentRelease(BaseModel):
    payroll_record_id: str
    released_by: str
    release_date: datetime
    payment_method: str = "bank_transfer"
    transaction_id: str = None
    status: str = "paid"

# Set up logger
logger = logging.getLogger(__name__)

# Create router
payroll_router = APIRouter(
    prefix="/api/payroll",
    tags=["Payroll Management"]
)

# Helper function to convert MongoDB ObjectId to string
def convert_objectid_to_str(data):
    """Convert MongoDB document to JSON-serializable dictionary."""
    if data is None:
        return data
    
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, (dict, list)):
                result[key] = convert_objectid_to_str(value)
            else:
                result[key] = value
        return result
    elif isinstance(data, list):
        return [convert_objectid_to_str(item) for item in data]
    elif isinstance(data, ObjectId):
        return str(data)
    else:
        return data

# Helper function to extract roles from user data
def extract_user_roles(user_data: dict) -> list:
    """Extract all roles from user data"""
    user_roles = []
    
    # Check role field (string)
    if 'role' in user_data and isinstance(user_data['role'], str):
        user_roles.append(user_data['role'].lower())
    
    # Check roles field (list)
    if 'roles' in user_data and isinstance(user_data['roles'], list):
        for role in user_data['roles']:
            if isinstance(role, str):
                user_roles.append(role.lower())
            elif isinstance(role, dict) and 'name' in role:
                user_roles.append(role['name'].lower())
    
    return user_roles

# Helper function to check admin permissions
def has_admin_permission(user_data: dict) -> bool:
    """Check if user has admin permissions - Full system access"""
    if not user_data:
        return False
    
    user_roles = extract_user_roles(user_data)
    admin_roles = ['admin', 'administrator', 'superuser', 'root']
    return any(role in admin_roles for role in user_roles) or user_data.get('user_id') == '1'

# Helper function to check HR/Manager permissions
def has_hr_permission(user_data: dict) -> bool:
    """Check if user has HR/Manager permissions - Can generate drafts, handle bonuses"""
    if not user_data:
        return False
    
    # Admin has all permissions
    if has_admin_permission(user_data):
        return True
    
    user_roles = extract_user_roles(user_data)
    hr_roles = ['hr', 'human_resources', 'human resource', 'humanresources', 'payroll', 'manager']
    return any(role in hr_roles for role in user_roles)

# Helper function to check employee permissions  
def has_employee_permission(user_data: dict) -> bool:
    """Check if user has employee permissions - Can view own data only"""
    if not user_data:
        return False
    
    # Any authenticated user is considered an employee
    return True

# Helper function to check if user can view specific employee data
def can_view_employee_data(current_user: dict, target_employee_id: str) -> bool:
    """Check if current user can view data for target employee"""
    if has_admin_permission(current_user) or has_hr_permission(current_user):
        return True
    
    # Employee can only view their own data
    current_user_id = current_user.get('user_id', current_user.get('username'))
    return str(current_user_id) == str(target_employee_id)

# ========================== PAYROLL CONFIG ENDPOINTS ==========================

@payroll_router.get("/config", response_model=PayrollConfigResponse)
async def get_payroll_config(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current payroll configuration (HR/Admin only)"""
    try:
        # Check permissions - Only HR and Admin
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access payroll configuration"
            )
        
        # Fetch config from database
        config_doc = await db.payroll_configs.find_one({})
        
        if not config_doc:
            # Return default config if none exists
            default_config = {
                "hra_rate": 40,
                "allowance_rate": 20,
                "pf_rate": 12,
                "professional_tax": 200,
                "tds_threshold": 50000,
                "tds_rate": 10,
                "working_days": 26,
                "active_period": "2025-12"
            }
            return {
                "success": True,
                "message": "Default payroll configuration returned",
                "data": default_config
            }
        
        # Convert ObjectId and return
        config_data = dict(config_doc)  # Create a copy
        config_data = convert_objectid_to_str(config_data)
        config_data['id'] = str(config_doc['_id'])
        
        return {
            "success": True,
            "message": "Payroll configuration retrieved successfully",
            "data": config_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching payroll config: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.post("/config", response_model=PayrollConfigResponse)
async def update_payroll_config(
    config_data: PayrollConfigCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Update payroll configuration (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to modify payroll configuration"
            )
        
        # Prepare update data
        update_data = config_data.dict()
        update_data['updated_at'] = datetime.now()
        update_data['updated_by'] = current_user.get('user_id', current_user.get('username'))
        
        # Update or create config
        result = await db.payroll_configs.find_one_and_update(
            {},  # Update the single config document
            {"$set": update_data},
            upsert=True,
            return_document=True
        )
        
        # Convert ObjectId and return
        result_copy = dict(result)  # Create a copy
        config_data = convert_objectid_to_str(result_copy)
        config_data['id'] = str(result['_id'])
        
        return {
            "success": True,
            "message": "Payroll configuration updated successfully",
            "data": config_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating payroll config: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ========================== SALARY STRUCTURE ENDPOINTS ==========================

@payroll_router.get("/structures", response_model=SalaryStructuresListResponse)
async def get_salary_structures(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all salary structures (HR/Admin only)"""
    try:
        # Check permissions - Only HR and Admin
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access salary structures"
            )
        
        # Fetch structures from database
        structures_cursor = db.salary_structures.find({"is_active": True})
        structures_list = await structures_cursor.to_list(length=None)
        
        # Convert ObjectIds
        structures_data = []
        for structure in structures_list:
            structure_copy = dict(structure)  # Create a copy
            structure_data = convert_objectid_to_str(structure_copy)
            structure_data['id'] = str(structure['_id'])
            structures_data.append(structure_data)
        
        return {
            "success": True,
            "message": f"Retrieved {len(structures_data)} salary structures",
            "data": structures_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching salary structures: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.post("/structures", response_model=SalaryStructureResponse)
async def create_salary_structure(
    structure_data: SalaryStructureCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create new salary structure (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to create salary structures"
            )
        
        # Check if position already exists
        existing_structure = await db.salary_structures.find_one({
            "position": structure_data.position,
            "is_active": True
        })
        
        if existing_structure:
            raise HTTPException(
                status_code=400,
                detail=f"Salary structure for position '{structure_data.position}' already exists"
            )
        
        # Prepare insert data
        insert_data = structure_data.dict()
        insert_data['created_at'] = datetime.now()
        insert_data['updated_at'] = datetime.now()
        insert_data['is_active'] = True
        
        # Insert new structure
        result = await db.salary_structures.insert_one(insert_data)
        
        # Fetch the created structure
        created_structure = await db.salary_structures.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId and return
        structure_copy = dict(created_structure)  # Create a copy
        structure_data = convert_objectid_to_str(structure_copy)
        structure_data['id'] = str(created_structure['_id'])
        
        return {
            "success": True,
            "message": "Salary structure created successfully",
            "data": structure_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating salary structure: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.put("/structures/{structure_id}", response_model=SalaryStructureResponse)
async def update_salary_structure(
    structure_id: str,
    structure_data: SalaryStructureCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Update salary structure (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to update salary structures"
            )
        
        # Validate ObjectId
        try:
            structure_object_id = ObjectId(structure_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid structure ID")
        
        # Check if structure exists
        existing_structure = await db.salary_structures.find_one({"_id": structure_object_id})
        if not existing_structure:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        
        # Check if position name conflicts (excluding current structure)
        position_conflict = await db.salary_structures.find_one({
            "position": structure_data.position,
            "is_active": True,
            "_id": {"$ne": structure_object_id}
        })
        
        if position_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Another salary structure with position '{structure_data.position}' already exists"
            )
        
        # Prepare update data
        update_data = structure_data.dict()
        update_data['updated_at'] = datetime.now()
        
        # Update structure
        result = await db.salary_structures.find_one_and_update(
            {"_id": structure_object_id},
            {"$set": update_data},
            return_document=True
        )
        
        # Convert ObjectId and return
        result_copy = dict(result)  # Create a copy
        structure_data = convert_objectid_to_str(result_copy)
        structure_data['id'] = str(result['_id'])
        
        return {
            "success": True,
            "message": "Salary structure updated successfully",
            "data": structure_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating salary structure: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.delete("/structures/{structure_id}")
async def delete_salary_structure(
    structure_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Delete salary structure (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to delete salary structures"
            )
        
        # Validate ObjectId
        try:
            structure_object_id = ObjectId(structure_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid structure ID")
        
        # Check if structure exists
        existing_structure = await db.salary_structures.find_one({"_id": structure_object_id})
        if not existing_structure:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        
        # Soft delete (mark as inactive)
        await db.salary_structures.update_one(
            {"_id": structure_object_id},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.now()
                }
            }
        )
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Salary structure deleted successfully"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting salary structure: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ========================== HR/MANAGER ENDPOINTS ==========================

@payroll_router.post("/hr/generate-draft-payslip")
async def generate_draft_payslip(
    payroll_data: PayrollCalculation,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Generate draft payslip (HR/Manager only - cannot mark as PAID)"""
    try:
        # Check HR permissions
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to generate draft payslips"
            )
        
        # Prepare draft payroll record
        draft_record = {
            "employee_id": payroll_data.employee_id,
            "period": payroll_data.period,
            "status": "draft",
            "calculation": payroll_data.dict(),
            "generated_by": current_user.get('user_id', current_user.get('username')),
            "generated_at": datetime.now(),
            "is_paid": False
        }
        
        # Check if draft already exists for this employee and period
        existing_draft = await db.payroll_records.find_one({
            "employee_id": payroll_data.employee_id,
            "period": payroll_data.period,
            "status": "draft"
        })
        
        if existing_draft:
            # Update existing draft
            result = await db.payroll_records.find_one_and_update(
                {"_id": existing_draft["_id"]},
                {"$set": draft_record},
                return_document=True
            )
        else:
            # Create new draft
            insert_result = await db.payroll_records.insert_one(draft_record)
            result = await db.payroll_records.find_one({"_id": insert_result.inserted_id})
        
        # Convert ObjectId
        result_data = convert_objectid_to_str(result)
        result_data['id'] = str(result['_id'])
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Draft payslip generated successfully",
                "data": result_data
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating draft payslip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.post("/hr/bonus-deduction")
async def add_bonus_deduction(
    bonus_deduction: BonusDeduction,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Add bonus, incentive, or deduction (HR/Manager only)"""
    try:
        # Check HR permissions
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to handle bonuses/deductions"
            )
        
        # Validate type
        valid_types = ["bonus", "incentive", "deduction"]
        if bonus_deduction.type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Prepare data
        bonus_deduction_dict = bonus_deduction.dict()
        bonus_deduction_dict['created_at'] = datetime.now()
        bonus_deduction_dict['created_by'] = current_user.get('user_id', current_user.get('username'))
        bonus_deduction_dict['status'] = 'approved' if has_admin_permission(current_user) else 'pending'
        
        # Insert bonus/deduction
        result = await db.bonus_deductions.insert_one(bonus_deduction_dict)
        
        # If it's approved, update the relevant payroll record
        if bonus_deduction_dict['status'] == 'approved':
            await update_payroll_with_bonus_deduction(db, bonus_deduction)
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"{bonus_deduction.type.title()} {'approved and applied' if bonus_deduction_dict['status'] == 'approved' else 'submitted for approval'}",
                "data": {
                    "id": str(result.inserted_id),
                    "employee_id": bonus_deduction.employee_id,
                    "type": bonus_deduction.type,
                    "amount": bonus_deduction.amount,
                    "status": bonus_deduction_dict['status']
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding bonus/deduction: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.get("/hr/pending-approvals")
async def get_pending_approvals(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get pending bonus/deduction approvals (HR/Manager only)"""
    try:
        # Check HR permissions
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to view approvals"
            )
        
        # Get pending items
        pending_cursor = db.bonus_deductions.find({"status": "pending"})
        pending_list = await pending_cursor.to_list(length=None)
        
        # Convert ObjectIds
        pending_data = convert_objectid_to_str(pending_list)
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"Retrieved {len(pending_data)} pending approvals",
                "data": pending_data
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching pending approvals: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Helper function to update payroll with bonus/deduction
async def update_payroll_with_bonus_deduction(db, bonus_deduction: BonusDeduction):
    """Update payroll record with approved bonus/deduction"""
    try:
        # Find the payroll record for the period
        payroll_record = await db.payroll_records.find_one({
            "employee_id": bonus_deduction.employee_id,
            "period": bonus_deduction.period
        })
        
        if payroll_record:
            calculation = payroll_record["calculation"]
            
            if bonus_deduction.type in ["bonus", "incentive"]:
                # Add to earnings
                calculation["total_earnings"] += bonus_deduction.amount
                calculation["net_pay"] += bonus_deduction.amount
            else:  # deduction
                # Add to deductions
                calculation["total_deductions"] += bonus_deduction.amount
                calculation["net_pay"] -= bonus_deduction.amount
            
            # Update the record
            await db.payroll_records.update_one(
                {"_id": payroll_record["_id"]},
                {"$set": {"calculation": calculation}}
            )
        
    except Exception as e:
        logger.error(f"Error updating payroll with bonus/deduction: {e}")

# ========================== PAYROLL CALCULATION ENDPOINTS ==========================

@payroll_router.post("/calculate/{employee_id}")
async def calculate_employee_payroll(
    employee_id: str,
    period: str = Query(..., description="Payroll period (YYYY-MM)"),
    attendance_days: int = Query(..., description="Days attended"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Calculate payroll for specific employee (HR/Admin only)"""
    try:
        # Check permissions - Only HR and Admin can calculate payroll
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to calculate payroll"
            )
        
        # Get payroll config
        config_doc = await db.payroll_configs.find_one({})
        if not config_doc:
            raise HTTPException(status_code=404, detail="Payroll configuration not found")
        
        # Get employee data
        employee = await db.employees.find_one({"userid": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get employee's salary structure or use basic salary
        salary_structure = await db.salary_structures.find_one({
            "position": employee.get("position"),
            "is_active": True
        })
        
        basic_salary = float(salary_structure["basic_salary"]) if salary_structure else float(employee.get("salary", 0))
        hra_rate = config_doc.get("hra_rate", 40) / 100
        allowance_rate = config_doc.get("allowance_rate", 20) / 100
        pf_rate = config_doc.get("pf_rate", 12) / 100
        professional_tax = config_doc.get("professional_tax", 200)
        tds_rate = config_doc.get("tds_rate", 10) / 100
        tds_threshold = config_doc.get("tds_threshold", 50000)
        working_days = config_doc.get("working_days", 26)
        
        # Calculate payroll
        daily_rate = basic_salary / working_days
        gross_pay = daily_rate * attendance_days
        hra = gross_pay * hra_rate
        allowances = gross_pay * allowance_rate
        total_earnings = gross_pay + hra + allowances
        
        pf = total_earnings * pf_rate
        tds = (total_earnings - tds_threshold) * tds_rate if total_earnings > tds_threshold else 0
        total_deductions = pf + professional_tax + tds
        net_pay = total_earnings - total_deductions
        
        # Create calculation object
        calculation = PayrollCalculation(
            employee_id=employee_id,
            period=period,
            gross_pay=round(gross_pay, 2),
            hra=round(hra, 2),
            allowances=round(allowances, 2),
            total_earnings=round(total_earnings, 2),
            pf=round(pf, 2),
            professional_tax=professional_tax,
            tds=round(tds, 2),
            total_deductions=round(total_deductions, 2),
            net_pay=round(net_pay, 2),
            config_snapshot=config_doc,
            attendance_days=attendance_days,
            working_days=working_days,
            calculated_at=datetime.now()
        )
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Payroll calculated successfully",
                "data": calculation.dict()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating payroll: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ========================== ADMIN ENDPOINTS ==========================

@payroll_router.get("/admin/all-payment-slips")
async def get_all_payment_slips(
    period: Optional[str] = Query(None, description="Filter by period (YYYY-MM)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, approved, paid)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Records per page"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all payment slips (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access all payment slips"
            )
        
        # Build query
        query = {}
        if period:
            query["period"] = period
        if status:
            query["status"] = status
        
        # Get total count
        total_count = await db.payroll_records.count_documents(query)
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get paginated results
        records_cursor = db.payroll_records.find(query).skip(skip).limit(limit).sort("created_at", -1)
        records_list = await records_cursor.to_list(length=None)
        
        # Enrich with employee details
        enriched_records = []
        for record in records_list:
            # Get employee info
            employee = await db.employees.find_one({"userid": record["employee_id"]})
            
            record_data = convert_objectid_to_str(record)
            record_data['id'] = str(record['_id'])
            record_data['employee_info'] = {
                "name": employee.get("name", "Unknown") if employee else "Unknown",
                "department": employee.get("department", "N/A") if employee else "N/A",
                "position": employee.get("position", "N/A") if employee else "N/A"
            }
            enriched_records.append(record_data)
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"Retrieved {len(enriched_records)} payment slips",
                "data": {
                    "records": enriched_records,
                    "pagination": {
                        "current_page": page,
                        "total_pages": (total_count + limit - 1) // limit,
                        "total_records": total_count,
                        "records_per_page": limit
                    }
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching all payment slips: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.post("/admin/release-payment/{payroll_record_id}")
async def release_payment(
    payroll_record_id: str,
    payment_data: PaymentRelease,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Release payment - mark payroll as PAID (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to release payments"
            )
        
        # Validate ObjectId
        try:
            record_object_id = ObjectId(payroll_record_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid payroll record ID")
        
        # Check if payroll record exists
        payroll_record = await db.payroll_records.find_one({"_id": record_object_id})
        if not payroll_record:
            raise HTTPException(status_code=404, detail="Payroll record not found")
        
        # Check if already paid
        if payroll_record.get("is_paid", False):
            raise HTTPException(status_code=400, detail="Payment already released for this record")
        
        # Prepare payment data
        payment_dict = payment_data.dict()
        payment_dict['released_by'] = current_user.get('user_id', current_user.get('username'))
        payment_dict['release_date'] = datetime.now()
        
        # Update payroll record with payment info
        update_data = {
            "is_paid": True,
            "status": "paid",
            "payment_info": payment_dict,
            "updated_at": datetime.now()
        }
        
        result = await db.payroll_records.find_one_and_update(
            {"_id": record_object_id},
            {"$set": update_data},
            return_document=True
        )
        
        # Log payment release
        payment_log = {
            "payroll_record_id": payroll_record_id,
            "employee_id": payroll_record["employee_id"],
            "period": payroll_record["period"],
            "amount": payroll_record["calculation"]["net_pay"],
            "released_by": payment_dict['released_by'],
            "released_at": payment_dict['release_date'],
            "payment_method": payment_dict.get('payment_method', 'bank_transfer'),
            "transaction_id": payment_dict.get('transaction_id')
        }
        
        await db.payment_releases.insert_one(payment_log)
        
        # Convert ObjectId
        result_data = convert_objectid_to_str(result)
        result_data['id'] = str(result['_id'])
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Payment released successfully",
                "data": {
                    "payroll_record": result_data,
                    "payment_info": payment_dict
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error releasing payment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.get("/admin/payment-releases")
async def get_payment_releases(
    period: Optional[str] = Query(None, description="Filter by period (YYYY-MM)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Records per page"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payment release history (Admin only)"""
    try:
        # Check admin permissions
        if not has_admin_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to view payment releases"
            )
        
        # Build query
        query = {}
        if period:
            query["period"] = period
        
        # Get total count
        total_count = await db.payment_releases.count_documents(query)
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get paginated results
        releases_cursor = db.payment_releases.find(query).skip(skip).limit(limit).sort("released_at", -1)
        releases_list = await releases_cursor.to_list(length=None)
        
        # Convert ObjectIds
        releases_data = convert_objectid_to_str(releases_list)
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"Retrieved {len(releases_data)} payment releases",
                "data": {
                    "releases": releases_data,
                    "pagination": {
                        "current_page": page,
                        "total_pages": (total_count + limit - 1) // limit,
                        "total_records": total_count,
                        "records_per_page": limit
                    }
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching payment releases: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ========================== PAYROLL REPORTS ENDPOINTS ==========================

@payroll_router.post("/reports/payslip")
async def generate_payslip_pdf(
    payslip_data: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Generate PDF payslip for employee (HR/Admin only)"""
    try:
        # Check permissions - Only HR and Admin can generate payslips
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to generate payslips"
            )
        
        # For now, return a success response (you can integrate PDF generation later)
        # This would typically use libraries like reportlab or weasyprint
        return JSONResponse(
            content={
                "success": True,
                "message": "Payslip generated successfully",
                "data": {
                    "employee_id": payslip_data.get("employeeId"),
                    "period": payslip_data.get("period"),
                    "generated_at": payslip_data.get("generatedAt"),
                    "download_url": f"/api/payroll/download/payslip_{payslip_data.get('employeeId')}_{payslip_data.get('period')}.pdf"
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating payslip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.get("/reports/summary")
async def get_payroll_summary(
    period: str = Query(..., description="Payroll period (YYYY-MM)"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payroll summary for a period (HR/Admin only)"""
    try:
        # Check permissions - Only HR and Admin can access payroll reports
        if not has_hr_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access payroll reports"
            )
        
        # Get all payroll records for the period
        records_cursor = db.payroll_records.find({"period": period})
        records_list = await records_cursor.to_list(length=None)
        
        if not records_list:
            return JSONResponse(
                content={
                    "success": True,
                    "message": "No payroll records found for this period",
                    "data": {
                        "period": period,
                        "total_employees": 0,
                        "total_gross_pay": 0,
                        "total_deductions": 0,
                        "total_net_pay": 0,
                        "records": []
                    }
                }
            )
        
        # Calculate summary
        total_employees = len(records_list)
        total_gross_pay = sum(record["calculation"]["total_earnings"] for record in records_list)
        total_deductions = sum(record["calculation"]["total_deductions"] for record in records_list)
        total_net_pay = sum(record["calculation"]["net_pay"] for record in records_list)
        
        # Convert ObjectIds
        records_data = convert_objectid_to_str(records_list)
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Payroll summary retrieved successfully",
                "data": {
                    "period": period,
                    "total_employees": total_employees,
                    "total_gross_pay": round(total_gross_pay, 2),
                    "total_deductions": round(total_deductions, 2),
                    "total_net_pay": round(total_net_pay, 2),
                    "records": records_data
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching payroll summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ========================== EMPLOYEE ENDPOINTS ==========================

@payroll_router.get("/employee/salary-structure/{employee_id}")
async def get_employee_salary_structure(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get salary structure for specific employee (Employee: own data, HR/Admin: any employee)"""
    try:
        # Check if user can view this employee's data
        if not can_view_employee_data(current_user, employee_id):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to view this employee's salary structure"
            )
        
        # Get employee data
        employee = await db.employees.find_one({"userid": employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get employee's salary structure
        salary_structure = await db.salary_structures.find_one({
            "position": employee.get("position"),
            "is_active": True
        })
        
        if not salary_structure:
            # Return basic salary info if no structure exists
            return JSONResponse(
                content={
                    "success": True,
                    "message": "Basic salary information retrieved",
                    "data": {
                        "employee_id": employee_id,
                        "employee_name": employee.get("name"),
                        "position": employee.get("position"),
                        "basic_salary": employee.get("salary", 0),
                        "structure_type": "basic"
                    }
                }
            )
        
        # Convert ObjectId and return structure (read-only for employees)
        structure_data = convert_objectid_to_str(salary_structure)
        structure_data['id'] = str(salary_structure['_id'])
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Salary structure retrieved successfully",
                "data": {
                    "employee_id": employee_id,
                    "employee_name": employee.get("name"),
                    "structure": structure_data,
                    "read_only": not has_hr_permission(current_user)
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee salary structure: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.get("/employee/payslips/{employee_id}")
async def get_employee_payslips(
    employee_id: str,
    period: Optional[str] = Query(None, description="Filter by period (YYYY-MM)"),
    limit: int = Query(10, description="Number of payslips to fetch"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payslips for specific employee (Employee: own data, HR/Admin: any employee)"""
    try:
        # Check if user can view this employee's data
        if not can_view_employee_data(current_user, employee_id):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to view this employee's payslips"
            )
        
        # Build query
        query = {"employee_id": employee_id}
        if period:
            query["period"] = period
        
        # Get payslips
        payslips_cursor = db.payroll_records.find(query).sort("period", -1).limit(limit)
        payslips_list = await payslips_cursor.to_list(length=None)
        
        # Convert ObjectIds
        payslips_data = convert_objectid_to_str(payslips_list)
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"Retrieved {len(payslips_data)} payslips",
                "data": {
                    "employee_id": employee_id,
                    "payslips": payslips_data,
                    "can_download": True
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee payslips: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.get("/employee/tax-deductions/{employee_id}")
async def get_employee_tax_deductions(
    employee_id: str,
    financial_year: Optional[str] = Query(None, description="Financial year (YYYY-YYYY)"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get tax & deduction summary for employee (Employee: own data, HR/Admin: any employee)"""
    try:
        # Check if user can view this employee's data
        if not can_view_employee_data(current_user, employee_id):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to view this employee's tax information"
            )
        
        # Build query for financial year or current year
        if not financial_year:
            current_year = datetime.now().year
            financial_year = f"{current_year-1}-{current_year}"
        
        # Get all payroll records for the financial year
        year_parts = financial_year.split("-")
        start_year, end_year = year_parts[0], year_parts[1]
        
        query = {
            "employee_id": employee_id,
            "$or": [
                {"period": {"$regex": f"^{start_year}"}},
                {"period": {"$regex": f"^{end_year}"}}
            ]
        }
        
        records_cursor = db.payroll_records.find(query)
        records_list = await records_cursor.to_list(length=None)
        
        # Calculate totals
        total_earnings = sum(record["calculation"]["total_earnings"] for record in records_list)
        total_pf = sum(record["calculation"]["pf"] for record in records_list)
        total_professional_tax = sum(record["calculation"]["professional_tax"] for record in records_list)
        total_tds = sum(record["calculation"]["tds"] for record in records_list)
        total_deductions = sum(record["calculation"]["total_deductions"] for record in records_list)
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Tax & deduction summary retrieved successfully",
                "data": {
                    "employee_id": employee_id,
                    "financial_year": financial_year,
                    "summary": {
                        "total_earnings": round(total_earnings, 2),
                        "total_pf": round(total_pf, 2),
                        "total_professional_tax": round(total_professional_tax, 2),
                        "total_tds": round(total_tds, 2),
                        "total_deductions": round(total_deductions, 2)
                    },
                    "monthly_breakdown": [
                        {
                            "period": record["period"],
                            "pf": record["calculation"]["pf"],
                            "professional_tax": record["calculation"]["professional_tax"],
                            "tds": record["calculation"]["tds"],
                            "total_deductions": record["calculation"]["total_deductions"]
                        } for record in records_list
                    ]
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching tax deductions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@payroll_router.post("/employee/raise-ticket")
async def raise_payroll_ticket(
    ticket_data: PayrollTicket,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Raise payroll-related ticket (Any authenticated employee)"""
    try:
        # Check employee permission
        if not has_employee_permission(current_user):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to raise tickets"
            )
        
        # Ensure employee can only raise tickets for themselves
        current_user_id = current_user.get('user_id', current_user.get('username'))
        if str(current_user_id) != str(ticket_data.employee_id):
            raise HTTPException(
                status_code=403,
                detail="You can only raise tickets for yourself"
            )
        
        # Prepare ticket data
        ticket_dict = ticket_data.dict()
        ticket_dict['created_at'] = datetime.now()
        ticket_dict['ticket_id'] = f"PAY-{datetime.now().strftime('%Y%m%d')}-{current_user_id}"
        
        # Insert ticket
        result = await db.payroll_tickets.insert_one(ticket_dict)
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Payroll ticket raised successfully",
                "data": {
                    "ticket_id": ticket_dict['ticket_id'],
                    "subject": ticket_data.subject,
                    "status": "open",
                    "created_at": ticket_dict['created_at'].isoformat()
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error raising payroll ticket: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Export router
__all__ = ["payroll_router"]
