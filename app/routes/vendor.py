from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
from app.database.schemas.vendor_schema import (
    VendorModel, VendorCreateModel, VendorUpdateModel, VendorOrderModel, 
    VendorTransactionModel, VendorNoteModel, VendorActivityLogModel,
    VendorListResponse, VendorStatsResponse, PurchaseOrderCreate
)
from app.services.auth_service_sync import AuthServiceSync
from app.database import (
    vendors_collection,
    vendor_orders_collection,
    vendor_transactions_collection,
    vendor_notes_collection,
    vendor_activity_logs_collection
)
from bson import ObjectId
from datetime import datetime
from app.dependencies import get_current_user
import os
import json
import logging
import re

# Initialize auth service
auth_sync = AuthServiceSync()

# Set up logging
logger = logging.getLogger(__name__)

# Create router with authentication dependency
vendor_router = APIRouter(
    prefix="/api/vendors", 
    tags=["vendors"], 
    dependencies=[Depends(get_current_user)]
)

def obj_id_to_str(doc):
    """Convert ObjectId to string and ensure id field exists"""
    if "id" not in doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc

def log_vendor_activity(vendor_id: str, action: str, description: str = None, user_id: str = None, metadata: dict = None):
    """Log vendor activity for audit trail"""
    try:
        activity = {
            "vendor_id": vendor_id,
            "action": action,
            "description": description,
            "user_id": user_id,
            "metadata": metadata or {},
            "timestamp": datetime.now()
        }
        vendor_activity_logs_collection().insert_one(activity)
    except Exception as e:
        logger.error(f"Failed to log vendor activity: {str(e)}")

# --- Vendor CRUD Operations ---

@vendor_router.post("/", response_model=VendorModel)
async def create_vendor(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: str = Form(...),
    city: str = Form(None),
    state: str = Form(None),
    country: str = Form(None),
    zip: str = Form(None),
    company: str = Form(...),
    registration_number: str = Form(None),
    tax_id: str = Form(None),
    contact_person: str = Form(...),
    contact_designation: str = Form(None),
    vendor_type: str = Form("regular"),
    status: str = Form("active"),
    tags: str = Form(""),
    preferences: str = Form("{}"),
    profile_picture: UploadFile = File(None),
    business_license: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Create a new vendor with comprehensive validation and file handling"""
    
    # Parse tags and preferences
    try:
        preferences_dict = json.loads(preferences) if preferences else {}
    except Exception:
        preferences_dict = {}
    
    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    # Validate GST Number
    if registration_number:
        if not re.match(r"^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz]{1}[0-9A-Za-z]{1}$", registration_number):
            raise HTTPException(status_code=400, detail="Invalid GST Number format.")
    
    # Check for duplicate vendor (email or phone)
    existing = vendors_collection().find_one({
        "$or": [
            {"email": email},
            {"phone": phone}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Vendor with this email or phone number already exists."
        )
    
    # Generate custom vendor ID
    last_vendor = vendors_collection().find_one(
        {"id": {"$regex": "^VND-\\d+$"}}, 
        sort=[("id", -1)]
    )
    new_id_num = int(last_vendor["id"].replace("VND-", "")) + 1 if last_vendor and "id" in last_vendor else 1
    custom_id = f"VND-{new_id_num:03d}"
    
    # Handle file uploads
    profile_picture_url = None
    business_license_url = None
    
    if profile_picture is not None and profile_picture.filename:
        # Create vendor directory
        upload_dir = os.path.join("uploaded_pdfs", f"vendor_{custom_id}")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save profile picture
        file_ext = os.path.splitext(profile_picture.filename)[-1]
        file_name = f"profile{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(await profile_picture.read())
        profile_picture_url = f"/{file_path}"
    
    if business_license is not None and business_license.filename:
        # Create vendor directory if not exists
        upload_dir = os.path.join("uploaded_pdfs", f"vendor_{custom_id}")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save business license
        file_ext = os.path.splitext(business_license.filename)[-1]
        file_name = f"business_license{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(await business_license.read())
        business_license_url = f"/{file_path}"
    
    # Create vendor document
    current_time = datetime.now()
    vendor_doc = {
        "id": custom_id,
        "name": name,
        "email": email,
        "phone": phone,
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "zip": zip,
        "company": company,
        "registration_number": registration_number,
        "tax_id": tax_id,
        "contact_person": contact_person,
        "contact_designation": contact_designation,
        "vendor_type": vendor_type,
        "status": status,
        "profile_picture": profile_picture_url,
        "avatar_url": profile_picture_url,  # For frontend compatibility
        "business_license": business_license_url,
        "tags": tags_list,
        "preferences": preferences_dict,
        "total_spend": 0.0,
        "orders_count": 0,
        "created_at": current_time,
        "updated_at": current_time,
        "joined_at": current_time  # For frontend compatibility
    }
    
    # Insert vendor
    result = vendors_collection().insert_one(vendor_doc)
    inserted_doc = vendors_collection().find_one({"_id": result.inserted_id})
    
    # Log activity
    log_vendor_activity(
        vendor_id=custom_id,
        action="vendor_created",
        description=f"Vendor {name} created by {current_user.get('name', 'Unknown')}",
        user_id=current_user.get('id'),
        metadata={"company": company, "vendor_type": vendor_type}
    )
    
    return obj_id_to_str(inserted_doc) if inserted_doc else vendor_doc


# --- Purchase Orders (must be BEFORE /{vendor_id} to avoid routing conflicts) ---

@vendor_router.post("/purchase-orders")
async def create_purchase_order(
    order_data: PurchaseOrderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a purchase order with items and auto-generate an invoice number"""

    # Verify vendor exists
    vendor = vendors_collection().find_one({"id": order_data.vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Calculate line totals and subtotal
    items_with_totals = []
    subtotal = 0.0
    for item in order_data.items:
        line_total = round(item.qty * item.unit_price, 2)
        subtotal += line_total
        items_with_totals.append({
            "name": item.name,
            "qty": item.qty,
            "unit_price": item.unit_price,
            "total": line_total,
        })
    subtotal = round(subtotal, 2)

    gst_percent = order_data.gst_percent
    gst_amount = round(subtotal * gst_percent / 100, 2)
    grand_total = round(subtotal + gst_amount, 2)

    # Generate invoice number INV-XXXX
    last_inv = vendor_orders_collection().find_one(
        {"invoice_number": {"$regex": "^INV-\\d+$"}},
        sort=[("created_at", -1)],
    )
    if last_inv and last_inv.get("invoice_number"):
        try:
            inv_num = int(last_inv["invoice_number"].replace("INV-", "")) + 1
        except Exception:
            inv_num = 1001
    else:
        inv_num = 1001
    invoice_number = f"INV-{inv_num}"

    # Generate order number VO-XXXXX
    last_order = vendor_orders_collection().find_one(
        {"order_number": {"$regex": "^VO-\\d+$"}},
        sort=[("created_at", -1)],
    )
    if last_order and last_order.get("order_number"):
        try:
            order_num = int(last_order["order_number"].replace("VO-", "")) + 1
        except Exception:
            order_num = 1
    else:
        order_num = 1
    order_number = f"VO-{order_num:05d}"

    current_time = datetime.now()
    vendor_name = vendor.get("name", "")
    vendor_email = vendor.get("email", "")
    vendor_company = vendor.get("company", "")

    order_doc = {
        "invoice_number": invoice_number,
        "order_number": order_number,
        "vendor_id": order_data.vendor_id,
        "vendor_name": vendor_name,
        "vendor_email": vendor_email,
        "vendor_company": vendor_company,
        "invoice_date": current_time,
        "items": items_with_totals,
        "subtotal": subtotal,
        "gst_percent": gst_percent,
        "gst_amount": gst_amount,
        "grand_total": grand_total,
        "amount": grand_total,
        "status": "pending",
        "notes": order_data.notes,
        "created_by": current_user.get("id") or current_user.get("user_id"),
        "created_at": current_time,
        "updated_at": current_time,
    }

    vendor_orders_collection().insert_one(order_doc)

    # Update vendor metrics
    vendors_collection().update_one(
        {"id": order_data.vendor_id},
        {"$inc": {"total_spend": grand_total, "orders_count": 1}},
    )

    log_vendor_activity(
        vendor_id=order_data.vendor_id,
        action="purchase_order_created",
        description=f"Purchase order {invoice_number} created for \u20b9{grand_total:.2f}",
        user_id=current_user.get("id"),
        metadata={"invoice_number": invoice_number, "grand_total": grand_total},
    )

    return {
        "invoice_number": invoice_number,
        "order_number": order_number,
        "vendor_id": order_data.vendor_id,
        "vendor_name": vendor_name,
        "vendor_email": vendor_email,
        "vendor_company": vendor_company,
        "invoice_date": current_time.isoformat(),
        "items": items_with_totals,
        "subtotal": subtotal,
        "gst_percent": gst_percent,
        "gst_amount": gst_amount,
        "grand_total": grand_total,
        "status": "pending",
        "notes": order_data.notes,
    }


@vendor_router.get("/{vendor_id}", response_model=VendorModel)
async def get_vendor(vendor_id: str):
    """Get vendor by ID with comprehensive data mapping"""
    
    # Try to find by custom ID first, then by ObjectId
    doc = None
    if ObjectId.is_valid(vendor_id):
        doc = vendors_collection().find_one({"_id": ObjectId(vendor_id)})
    if not doc:
        doc = vendors_collection().find_one({"id": vendor_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    doc = obj_id_to_str(doc)
    
    # Ensure all required fields are present with defaults
    default_fields = {
        "name": "",
        "email": "",
        "phone": "",
        "address": "",
        "city": "",
        "state": "",
        "country": "",
        "zip": "",
        "company": "",
        "registration_number": "",
        "tax_id": "",
        "contact_person": "",
        "contact_designation": "",
        "vendor_type": "regular",
        "status": "active",
        "tags": [],
        "preferences": {},
        "total_spend": 0.0,
        "orders_count": 0
    }
    
    for field, default_value in default_fields.items():
        if field not in doc or doc[field] is None:
            doc[field] = default_value
    
    # Ensure frontend compatibility
    if "created_at" in doc:
        doc["joined_at"] = doc.get("joined_at", doc["created_at"])
    else:
        doc["created_at"] = doc["joined_at"] = datetime.now()
    
    if "profile_picture" in doc and doc["profile_picture"]:
        doc["avatar_url"] = doc.get("avatar_url", doc["profile_picture"])
    else:
        doc["profile_picture"] = doc.get("avatar_url", "")
        doc["avatar_url"] = doc.get("avatar_url", "")
    
    return doc

@vendor_router.put("/{vendor_id}", response_model=VendorModel)
async def update_vendor(
    vendor_id: str, 
    name: str = Form(None),
    email: str = Form(None),
    phone: str = Form(None),
    address: str = Form(None),
    city: str = Form(None),
    state: str = Form(None),
    country: str = Form(None),
    zip: str = Form(None),
    company: str = Form(None),
    registration_number: str = Form(None),
    tax_id: str = Form(None),
    contact_person: str = Form(None),
    contact_designation: str = Form(None),
    vendor_type: str = Form(None),
    status: str = Form(None),
    tags: str = Form(None),
    preferences: str = Form(None),
    profile_picture: UploadFile = File(None),
    business_license: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Update vendor with comprehensive validation and file handling"""
    
    # Build query
    query = {"id": vendor_id} if vendor_id.startswith("VND-") else {"_id": ObjectId(vendor_id)}
    
    # Check if vendor exists
    existing_vendor = vendors_collection().find_one(query)
    if not existing_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Build update document
    update_doc = {}
    
    # Update basic fields if provided
    if name is not None:
        update_doc["name"] = name
    if email is not None:
        # Check for email conflicts
        email_conflict = vendors_collection().find_one({
            "email": email,
            "_id": {"$ne": existing_vendor["_id"]}
        })
        if email_conflict:
            raise HTTPException(status_code=409, detail="Email already exists for another vendor")
        update_doc["email"] = email
    
    if phone is not None:
        # Check for phone conflicts
        phone_conflict = vendors_collection().find_one({
            "phone": phone,
            "_id": {"$ne": existing_vendor["_id"]}
        })
        if phone_conflict:
            raise HTTPException(status_code=409, detail="Phone number already exists for another vendor")
        update_doc["phone"] = phone
    
    # Validate GST Number
    if registration_number is not None and registration_number.strip():
        if not re.match(r"^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz]{1}[0-9A-Za-z]{1}$", registration_number):
            raise HTTPException(status_code=400, detail="Invalid GST Number format.")
            
    # Update other fields
    field_mappings = {
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "zip": zip,
        "company": company,
        "registration_number": registration_number,
        "tax_id": tax_id,
        "contact_person": contact_person,
        "contact_designation": contact_designation,
        "vendor_type": vendor_type,
        "status": status
    }
    
    for field, value in field_mappings.items():
        if value is not None:
            update_doc[field] = value
    
    # Handle tags and preferences
    if tags is not None:
        update_doc["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    
    if preferences is not None:
        try:
            update_doc["preferences"] = json.loads(preferences) if preferences else {}
        except Exception:
            update_doc["preferences"] = {}
    
    # Handle file uploads
    vendor_id_for_files = existing_vendor.get("id", str(existing_vendor["_id"]))
    
    if profile_picture is not None and profile_picture.filename:
        upload_dir = os.path.join("uploaded_pdfs", f"vendor_{vendor_id_for_files}")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_ext = os.path.splitext(profile_picture.filename)[-1]
        file_name = f"profile{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(await profile_picture.read())
        
        update_doc["profile_picture"] = f"/{file_path}"
        update_doc["avatar_url"] = f"/{file_path}"
    
    if business_license is not None and business_license.filename:
        upload_dir = os.path.join("uploaded_pdfs", f"vendor_{vendor_id_for_files}")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_ext = os.path.splitext(business_license.filename)[-1]
        file_name = f"business_license{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        with open(file_path, "wb") as f:
            f.write(await business_license.read())
        
        update_doc["business_license"] = f"/{file_path}"
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Always update the updated_at field
    update_doc["updated_at"] = datetime.now()
    
    # Perform update
    result = vendors_collection().update_one(query, {"$set": update_doc})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Log activity
    log_vendor_activity(
        vendor_id=vendor_id_for_files,
        action="vendor_updated",
        description=f"Vendor updated by {current_user.get('name', 'Unknown')}",
        user_id=current_user.get('id'),
        metadata={"updated_fields": list(update_doc.keys())}
    )
    
    # Return updated document
    doc = vendors_collection().find_one(query)
    return obj_id_to_str(doc)

@vendor_router.delete("/{vendor_id}", status_code=204)
async def delete_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
    """Delete vendor with proper cleanup"""
    
    query = {"id": vendor_id} if vendor_id.startswith("VND-") else {"_id": ObjectId(vendor_id)}
    
    # Check if vendor exists
    vendor = vendors_collection().find_one(query)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_name = vendor.get("name", "Unknown")
    vendor_id_str = vendor.get("id", str(vendor["_id"]))
    
    # Delete vendor
    result = vendors_collection().delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Log activity
    log_vendor_activity(
        vendor_id=vendor_id_str,
        action="vendor_deleted",
        description=f"Vendor {vendor_name} deleted by {current_user.get('name', 'Unknown')}",
        user_id=current_user.get('id'),
        metadata={"vendor_name": vendor_name}
    )
    
    return

@vendor_router.get("/", response_model=List[VendorModel])
async def get_all_vendors(
    status: Optional[str] = None,
    vendor_type: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    search: Optional[str] = None,
    company: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None,
    tags: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    skip: int = 0,
    limit: int = 100
):
    """Get all vendors with comprehensive filtering and search"""
    
    query = {}
    
    # Apply filters
    if status:
        query["status"] = status
    
    if vendor_type:
        query["vendor_type"] = vendor_type
    
    if email:
        query["email"] = {"$regex": email, "$options": "i"}
    
    if phone:
        query["phone"] = {"$regex": phone, "$options": "i"}
    
    if company:
        query["company"] = {"$regex": company, "$options": "i"}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
    
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    
    if tags:
        query["tags"] = {"$in": [tag.strip() for tag in tags.split(",")]}
    
    # Search functionality
    if search:
        search_query = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"id": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"contact_person": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"state": {"$regex": search, "$options": "i"}},
            {"country": {"$regex": search, "$options": "i"}},
        ]
        query["$or"] = search_query
    
    # Determine sort direction
    sort_direction = -1 if sort_order.lower() == "desc" else 1
    
    # Aggregation pipeline for enhanced data
    pipeline = [
        {"$match": query},
        {
            "$lookup": {
                "from": "vendor_orders",
                "localField": "id",
                "foreignField": "vendor_id",
                "as": "orders"
            }
        },
        {
            "$lookup": {
                "from": "vendor_transactions",
                "localField": "id",
                "foreignField": "vendor_id",
                "as": "transactions"
            }
        },
        {
            "$addFields": {
                "orders_count": {"$size": "$orders"},
                "total_spend": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {
                                "input": "$transactions",
                                "cond": {"$eq": ["$$this.transaction_type", "payment"]}
                            }},
                            "as": "transaction",
                            "in": "$$transaction.amount"
                        }
                    }
                }
            }
        },
        {"$sort": {sort_by: sort_direction}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    # Execute aggregation
    vendors = list(vendors_collection().aggregate(pipeline))
    
    # Process results
    result = []
    for vendor in vendors:
        vendor = obj_id_to_str(vendor)
        
        # Ensure all required fields
        default_fields = {
            "name": "",
            "email": "",
            "phone": "",
            "address": "",
            "company": "",
            "vendor_type": "regular",
            "status": "active",
            "tags": [],
            "preferences": {},
            "total_spend": 0.0,
            "orders_count": 0
        }
        
        for field, default_value in default_fields.items():
            if field not in vendor or vendor[field] is None:
                vendor[field] = default_value
        
        # Frontend compatibility
        if "created_at" in vendor:
            vendor["joined_at"] = vendor.get("joined_at", vendor["created_at"])
        
        if "profile_picture" in vendor and vendor["profile_picture"]:
            vendor["avatar_url"] = vendor.get("avatar_url", vendor["profile_picture"])
        else:
            vendor["avatar_url"] = ""
        
        result.append(vendor)
    
    return result

# --- Vendor Statistics ---

@vendor_router.get("/stats/overview", response_model=VendorStatsResponse)
async def get_vendor_stats():
    """Get comprehensive vendor statistics"""
    
    # Count aggregations
    total_vendors = vendors_collection().count_documents({})
    active_vendors = vendors_collection().count_documents({"status": "active"})
    preferred_vendors = vendors_collection().count_documents({"vendor_type": "preferred"})
    strategic_vendors = vendors_collection().count_documents({"vendor_type": "strategic"})
    
    # Total spend calculation
    spend_pipeline = [
        {
            "$lookup": {
                "from": "vendor_transactions",
                "localField": "id",
                "foreignField": "vendor_id",
                "as": "transactions"
            }
        },
        {
            "$unwind": {
                "path": "$transactions",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$match": {
                "transactions.transaction_type": "payment"
            }
        },
        {
            "$group": {
                "_id": None,
                "total_spend": {"$sum": "$transactions.amount"}
            }
        }
    ]
    
    spend_result = list(vendors_collection().aggregate(spend_pipeline))
    total_spend = spend_result[0]["total_spend"] if spend_result else 0.0
    
    # Recent vendors
    recent_vendors = list(vendors_collection().find(
        {},
        sort=[("created_at", -1)],
        limit=5
    ))
    
    # Process recent vendors
    processed_recent = []
    for vendor in recent_vendors:
        vendor = obj_id_to_str(vendor)
        # Add required fields
        for field in ["name", "email", "company", "vendor_type", "status"]:
            if field not in vendor:
                vendor[field] = ""
        processed_recent.append(vendor)
    
    return {
        "total_vendors": total_vendors,
        "active_vendors": active_vendors,
        "preferred_vendors": preferred_vendors,
        "strategic_vendors": strategic_vendors,
        "total_spend": total_spend,
        "recent_vendors": processed_recent
    }

# --- Vendor Orders Management ---

@vendor_router.post("/{vendor_id}/orders", response_model=VendorOrderModel)
async def create_vendor_order(
    vendor_id: str,
    order: VendorOrderModel,
    current_user: dict = Depends(get_current_user)
):
    """Create a new order for a vendor"""
    
    # Verify vendor exists
    vendor = vendors_collection().find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Generate order ID
    last_order = vendor_orders_collection().find_one(
        {"order_number": {"$regex": "^VO-\\d+$"}},
        sort=[("order_number", -1)]
    )
    order_num = int(last_order["order_number"].replace("VO-", "")) + 1 if last_order else 1
    order_number = f"VO-{order_num:05d}"
    
    # Create order
    order_doc = {
        "id": str(ObjectId()),
        "vendor_id": vendor_id,
        "order_number": order_number,
        "amount": order.amount,
        "status": order.status,
        "items": order.items or [],
        "order_date": order.order_date or datetime.now(),
        "delivery_date": order.delivery_date,
        "notes": order.notes,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    result = vendor_orders_collection().insert_one(order_doc)
    
    # Update vendor orders count
    vendors_collection().update_one(
        {"id": vendor_id},
        {"$inc": {"orders_count": 1}}
    )
    
    # Log activity
    log_vendor_activity(
        vendor_id=vendor_id,
        action="order_created",
        description=f"Order {order_number} created for amount ${order.amount}",
        user_id=current_user.get("id"),
        metadata={"order_number": order_number, "amount": order.amount}
    )
    
    inserted_doc = vendor_orders_collection().find_one({"_id": result.inserted_id})
    return obj_id_to_str(inserted_doc)

@vendor_router.get("/{vendor_id}/orders", response_model=List[VendorOrderModel])
async def get_vendor_orders(
    vendor_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all orders for a specific vendor"""
    
    query = {"vendor_id": vendor_id}
    if status:
        query["status"] = status
    
    orders = list(vendor_orders_collection().find(
        query,
        sort=[("order_date", -1)],
        skip=skip,
        limit=limit
    ))
    
    return [obj_id_to_str(order) for order in orders]

# --- Vendor Transactions Management ---

@vendor_router.post("/{vendor_id}/transactions", response_model=VendorTransactionModel)
async def create_vendor_transaction(
    vendor_id: str,
    transaction: VendorTransactionModel,
    current_user: dict = Depends(get_current_user)
):
    """Create a new transaction for a vendor"""
    
    # Verify vendor exists
    vendor = vendors_collection().find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Create transaction
    transaction_doc = {
        "id": str(ObjectId()),
        "vendor_id": vendor_id,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "payment_method": transaction.payment_method,
        "status": transaction.status,
        "reference_id": transaction.reference_id,
        "description": transaction.description,
        "timestamp": transaction.timestamp or datetime.now(),
        "created_by": current_user.get("id"),
        "created_at": datetime.now()
    }
    
    result = vendor_transactions_collection().insert_one(transaction_doc)
    
    # Update vendor total spend if it's a payment
    if transaction.transaction_type == "payment":
        vendors_collection().update_one(
            {"id": vendor_id},
            {"$inc": {"total_spend": transaction.amount}}
        )
    
    # Log activity
    log_vendor_activity(
        vendor_id=vendor_id,
        action="transaction_created",
        description=f"{transaction.transaction_type.title()} of ${transaction.amount}",
        user_id=current_user.get("id"),
        metadata={
            "transaction_type": transaction.transaction_type,
            "amount": transaction.amount,
            "reference_id": transaction.reference_id
        }
    )
    
    inserted_doc = vendor_transactions_collection().find_one({"_id": result.inserted_id})
    return obj_id_to_str(inserted_doc)

@vendor_router.get("/{vendor_id}/transactions", response_model=List[VendorTransactionModel])
async def get_vendor_transactions(
    vendor_id: str,
    transaction_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all transactions for a specific vendor"""
    
    query = {"vendor_id": vendor_id}
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    transactions = list(vendor_transactions_collection().find(
        query,
        sort=[("timestamp", -1)],
        skip=skip,
        limit=limit
    ))
    
    return [obj_id_to_str(transaction) for transaction in transactions]

# --- Vendor Notes Management ---

@vendor_router.post("/{vendor_id}/notes", response_model=VendorNoteModel)
async def create_vendor_note(
    vendor_id: str,
    note: VendorNoteModel,
    current_user: dict = Depends(get_current_user)
):
    """Create a new note for a vendor"""
    
    # Verify vendor exists
    vendor = vendors_collection().find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Create note
    note_doc = {
        "id": str(ObjectId()),
        "vendor_id": vendor_id,
        "user_id": current_user.get("id"),
        "author": current_user.get("name", "Unknown"),
        "content": note.content,
        "note_type": note.note_type or "general",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    result = vendor_notes_collection().insert_one(note_doc)
    
    # Log activity
    log_vendor_activity(
        vendor_id=vendor_id,
        action="note_added",
        description=f"Note added by {current_user.get('name', 'Unknown')}",
        user_id=current_user.get("id"),
        metadata={"note_type": note.note_type}
    )
    
    inserted_doc = vendor_notes_collection().find_one({"_id": result.inserted_id})
    return obj_id_to_str(inserted_doc)

@vendor_router.get("/{vendor_id}/notes", response_model=List[VendorNoteModel])
async def get_vendor_notes(
    vendor_id: str,
    note_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all notes for a specific vendor"""
    
    query = {"vendor_id": vendor_id}
    if note_type:
        query["note_type"] = note_type
    
    notes = list(vendor_notes_collection().find(
        query,
        sort=[("created_at", -1)],
        skip=skip,
        limit=limit
    ))
    
    return [obj_id_to_str(note) for note in notes]

# --- Vendor Activity Logs ---

@vendor_router.get("/{vendor_id}/activity", response_model=List[VendorActivityLogModel])
async def get_vendor_activity_logs(
    vendor_id: str,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get activity logs for a specific vendor"""
    
    query = {"vendor_id": vendor_id}
    if action:
        query["action"] = action
    
    activities = list(vendor_activity_logs_collection().find(
        query,
        sort=[("timestamp", -1)],
        skip=skip,
        limit=limit
    ))
    
    return [obj_id_to_str(activity) for activity in activities]
