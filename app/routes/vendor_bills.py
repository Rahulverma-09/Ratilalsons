# app/routes/vendor_bills.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from typing import List, Optional
from datetime import datetime
from app.database.schemas.vendor_bill_schema import (
    VendorBillCreate, VendorBillUpdate, VendorBillModel, VendorBillFilter, 
    VendorBillStatusEnum, VendorBillApproval, VendorBillPayment, VendorBillStats
)
from app.database.repositories.vendor_bill_repository import VendorBillRepository
from app.dependencies import get_current_user, accounts_required
from app.database import get_database
from pydantic import BaseModel
import os
import uuid

vendor_bill_router = APIRouter(prefix="/api/vendor-bills", tags=["Vendor Bills"])

def get_vendor_bill_repo() -> VendorBillRepository:
    """Dependency to get vendor bill repository"""
    db = get_database()
    return VendorBillRepository(db["vendor_bills"])

@vendor_bill_router.get("/stats", response_model=VendorBillStats)
async def vendor_bill_stats(
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Vendor bill dashboard statistics"""
    try:
        stats = repo.get_stats()
        return stats
    except Exception as e:
        # Return empty stats if there's an error
        return VendorBillStats(
            total_bills=0,
            uploaded=0,
            under_review=0,
            approved=0,
            paid=0,
            rejected=0,
            pending_payment_amount=0.0,
            total_paid_amount=0.0
        )

@vendor_bill_router.post("/", response_model=VendorBillModel, status_code=status.HTTP_201_CREATED)
async def create_vendor_bill(
    bill_data: VendorBillCreate,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(get_current_user)
):
    """Create new vendor bill (can be uploaded by vendor or admin)"""
    bill_dict = bill_data.dict()
    
    # Always populate vendor information from vendor profiles
    if bill_dict.get("vendor_id"):
        try:
            db = get_database()
            vendors_collection = db["vendors"]
            
            # Try by custom vendor ID first (VND-001 format)
            vendor = vendors_collection.find_one({"id": bill_dict["vendor_id"]})
            
            # If not found, try by ObjectId
            if not vendor and bill_dict["vendor_id"] != "dummy-vendor-id":
                try:
                    from bson import ObjectId
                    vendor = vendors_collection.find_one({"_id": ObjectId(bill_dict["vendor_id"])})
                except:
                    pass
            
            if vendor:
                bill_dict["vendor_name"] = vendor.get("name", bill_dict.get("vendor_name"))
                bill_dict["vendor_email"] = vendor.get("email", bill_dict.get("vendor_email"))
                bill_dict["vendor_phone"] = vendor.get("phone", bill_dict.get("vendor_phone"))
                bill_dict["vendor_address"] = vendor.get("address", bill_dict.get("vendor_address"))
                bill_dict["vendor_company"] = vendor.get("company", bill_dict.get("vendor_company"))
        except Exception as e:
            # If vendor lookup fails, use the provided data
            pass
    
    bill = repo.create_bill(bill_dict, uploaded_by=current_user.get("user_id"))
    return bill

@vendor_bill_router.post("/upload", response_model=VendorBillModel, status_code=status.HTTP_201_CREATED)
async def upload_vendor_bill_file(
    vendor_id: str,
    bill_number: str,
    total_amount: float,
    due_date: str,
    file: UploadFile = File(...),
    bill_date: Optional[str] = None,
    reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(get_current_user)
):
    """Upload vendor bill with file attachment"""
    # Validate file type
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX"
        )
    
    # Save uploaded file
    upload_dir = "uploaded_pdfs/vendor_bills"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create bill with minimal required data
    bill_data = {
        "vendor_id": vendor_id,
        "bill_number": bill_number,
        "reference_number": reference_number,
        "total_amount": total_amount,
        "subtotal": total_amount,  # Default subtotal to total for file upload
        "tax_amount": 0.0,  # Default tax amount
        "due_date": datetime.fromisoformat(due_date.replace('Z', '+00:00')),
        "bill_date": datetime.fromisoformat(bill_date.replace('Z', '+00:00')) if bill_date else datetime.utcnow(),
        "notes": notes,
        "uploaded_file_path": file_path,
        "items": [{
            "name": "Uploaded Bill",
            "description": f"Bill {bill_number} - File upload",
            "quantity": 1,
            "unit_price": total_amount,
            "tax_rate": 0.0
        }]
    }
    
    bill = repo.create_bill(bill_data, uploaded_by=current_user.get("user_id"))
    return bill

@vendor_bill_router.get("/{bill_id}", response_model=VendorBillModel)
async def get_vendor_bill(
    bill_id: str,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(get_current_user)
):
    """Get single vendor bill details"""
    bill = repo.get_bill(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    return bill

@vendor_bill_router.put("/{bill_id}", response_model=VendorBillModel)
async def update_vendor_bill(
    bill_id: str,
    update_data: VendorBillUpdate,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Update vendor bill (admin only)"""
    bill = repo.get_bill(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    
    # Prevent editing paid bills
    if bill["status"] == VendorBillStatusEnum.paid.value:
        raise HTTPException(status_code=400, detail="Cannot edit paid bill")
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    updated_bill = repo.update_bill(bill_id, update_dict)
    return updated_bill

@vendor_bill_router.post("/{bill_id}/review", status_code=status.HTTP_200_OK)
async def start_bill_review(
    bill_id: str,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Start reviewing vendor bill (admin only)"""
    success = repo.set_under_review(bill_id, current_user.get("user_id"))
    if not success:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    return {"message": "Bill review started"}

@vendor_bill_router.post("/{bill_id}/approve", status_code=status.HTTP_200_OK)
async def approve_vendor_bill(
    bill_id: str,
    approval_data: VendorBillApproval,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Approve or reject vendor bill (admin only)"""
    if approval_data.approved:
        success = repo.approve_bill(
            bill_id, 
            current_user.get("user_id"), 
            approval_data.dict()
        )
        message = "Vendor bill approved"
    else:
        success = repo.reject_bill(
            bill_id, 
            current_user.get("user_id"), 
            approval_data.approval_notes or "No reason provided"
        )
        message = "Vendor bill rejected"
    
    if not success:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    
    return {"message": message}

@vendor_bill_router.post("/{bill_id}/payment", status_code=status.HTTP_200_OK)
async def record_bill_payment(
    bill_id: str,
    payment_data: VendorBillPayment,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Record payment for vendor bill (admin only)"""
    bill = repo.get_bill(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    
    if bill["status"] != VendorBillStatusEnum.approved.value:
        raise HTTPException(status_code=400, detail="Bill must be approved before payment")
    
    success = repo.record_payment(
        bill_id, 
        current_user.get("user_id"), 
        payment_data.dict()
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to record payment")
    
    return {"message": "Payment recorded successfully"}

@vendor_bill_router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor_bill(
    bill_id: str,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """Delete vendor bill (admin only - irreversible)"""
    success = repo.delete_bill(bill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    return None

@vendor_bill_router.get("/", response_model=dict)
async def list_vendor_bills(
    vendor_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: VendorBillRepository = Depends(get_vendor_bill_repo),
    current_user: dict = Depends(accounts_required)
):
    """List vendor bills with filters (Admin dashboard)"""
    skip = (page - 1) * limit
    filters = {
        "vendor_id": vendor_id,
        "status": [status] if status and status.strip() else None,
    }
    
    bills, total = repo.list_bills(filters, skip=skip, limit=limit)
    return {
        "bills": bills,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

# VENDOR-FACING ENDPOINTS (for vendors to see their bills)

@vendor_bill_router.get("/lookup-vendor/{vendor_id}", response_model=dict)
async def lookup_vendor_info(
    vendor_id: str,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo)
):
    """Lookup vendor information by ID (for bill creation)"""
    try:
        db = get_database()
        vendors_collection = db["vendors"]
        
        # Try by custom vendor ID first (VND-001 format)
        vendor = vendors_collection.find_one({"id": vendor_id})
        
        # If not found, try by ObjectId
        if not vendor and vendor_id != "dummy-vendor-id":
            try:
                from bson import ObjectId
                vendor = vendors_collection.find_one({"_id": ObjectId(vendor_id)})
            except:
                pass
        
        if vendor:
            return {
                "found": True,
                "vendor": {
                    "id": vendor.get("id", str(vendor.get("_id", ""))),
                    "name": vendor.get("name"),
                    "email": vendor.get("email"),
                    "phone": vendor.get("phone"),
                    "address": vendor.get("address"),
                    "company": vendor.get("company"),
                    "contact_person": vendor.get("contact_person")
                }
            }
        else:
            return {"found": False, "vendor": None}
            
    except Exception as e:
        return {"found": False, "vendor": None, "error": str(e)}

@vendor_bill_router.get("/vendor/{vendor_id}/bills", response_model=dict)
async def vendor_view_bills(
    vendor_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: VendorBillRepository = Depends(get_vendor_bill_repo)
):
    """Vendor view of their bills and payment status (no auth required)"""
    skip = (page - 1) * limit
    
    bills, total = repo.get_bills_for_vendor(vendor_id, skip=skip, limit=limit)
    
    # Filter out sensitive admin information
    vendor_bills = []
    for bill in bills:
        vendor_bill = {
            "id": bill["id"],
            "bill_number": bill["bill_number"],
            "reference_number": bill.get("reference_number"),
            "total_amount": bill["total_amount"],
            "due_date": bill["due_date"],
            "bill_date": bill["bill_date"],
            "status": bill["status"],
            "payment_amount": bill.get("payment_amount"),
            "payment_method": bill.get("payment_method"),
            "paid_at": bill.get("paid_at"),
            "created_at": bill["created_at"],
            "notes": bill.get("notes")
        }
        vendor_bills.append(vendor_bill)
    
    return {
        "bills": vendor_bills,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

@vendor_bill_router.get("/vendor/bill/{bill_id}/status", response_model=dict)
async def vendor_check_payment_status(
    bill_id: str,
    repo: VendorBillRepository = Depends(get_vendor_bill_repo)
):
    """Vendor checks payment status of their bill (no auth required)"""
    bill = repo.get_bill(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Return payment status information
    return {
        "bill_number": bill["bill_number"],
        "status": bill["status"],
        "total_amount": bill["total_amount"],
        "payment_amount": bill.get("payment_amount"),
        "payment_method": bill.get("payment_method"),
        "paid_at": bill.get("paid_at"),
        "approval_notes": bill.get("approval_notes"),
        "rejection_reason": bill.get("rejection_reason")
    }