# app/routers/tickets.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import os
import uuid
from app.database.schemas.ticket_schema import (
    TicketCreate, TicketUpdate, TicketModel, TicketFilter, StatusEnum, PriorityEnum, TicketResponse
)
from app.database.repositories.ticket_repository import TicketRepository
from app.dependencies import get_ticket_repo, support_required, get_current_user, admin_required

ticket_router = APIRouter(prefix="/api/tickets", tags=["Support Tickets"])

def get_user_role(current_user: dict) -> str:
    """Determine user role for ticket access control"""
    user_roles = current_user.get("token_data", {}).get("roles", [])
    if not user_roles:
        user_roles = [current_user.get("role", "customer")]
    
    if "admin" in user_roles or "super_admin" in user_roles:
        return "admin"
    elif "employee" in user_roles or "staff" in user_roles or "hr" in user_roles:
        return "employee"
    elif "vendor" in user_roles:
        return "vendor"
    else:
        return "customer"

def filter_internal_notes(ticket: dict, user_role: str) -> dict:
    """Filter internal notes based on user role"""
    if user_role in ["admin", "employee"]:
        return ticket
    
    # Filter out internal responses for customers/vendors
    if "resolution_log" in ticket:
        ticket["resolution_log"] = [
            response for response in ticket["resolution_log"]
            if not response.get("internal", False)
        ]
    
    return ticket

@ticket_router.post("/", response_model=TicketModel, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_data: TicketCreate,
    attachments: Optional[List[UploadFile]] = File(None),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Create new support ticket (Any authenticated user)"""
    # Auto-set ticket_number using your sequence
    from app.database import get_next_sequence, get_database
    db = get_database()
    ticket_number = f"TICKET-{get_next_sequence(db, 'ticket_number'):06d}"
    
    ticket_data_dict = ticket_data.dict()
    ticket_data_dict["ticket_number"] = ticket_number
    
    # Set raised_by from current user
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    user_name = current_user.get("full_name") or current_user.get("username") or "Unknown User"
    ticket_data_dict["raised_by"] = {
        "user_id": user_id,
        "name": user_name
    }
    
    # Handle file attachments
    attachment_paths = []
    if attachments:
        upload_dir = f"uploaded_files/tickets/{ticket_number}"
        os.makedirs(upload_dir, exist_ok=True)
        
        for file in attachments:
            if file.filename:
                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                
                attachment_paths.append({
                    "filename": file.filename,
                    "file_path": file_path,
                    "uploaded_at": datetime.utcnow()
                })
    
    ticket_data_dict["attachments"] = attachment_paths
    
    # Initialize empty arrays
    ticket_data_dict["resolution_log"] = []
    ticket_data_dict["status_history"] = [{
        "status": "open",
        "changed_by": user_name,
        "timestamp": datetime.utcnow()
    }]
    
    ticket = repo.create_ticket(ticket_data_dict)
    return ticket

@ticket_router.get("/stats", response_model=dict)
async def ticket_stats(
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Dashboard statistics for support team and employees"""
    user_role = get_user_role(current_user)
    
    if user_role not in ["admin", "employee"]:
        raise HTTPException(status_code=403, detail="Only admin and employees can view statistics")
    
    # Base query for statistics
    base_query = {}
    if user_role == "employee":
        # Employees only see tickets assigned to them
        user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
        base_query["assigned_to_employee"] = user_id
    
    # Get status statistics
    pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    status_stats = list(repo.collection.aggregate(pipeline))
    status_dict = {item["_id"]: item["count"] for item in status_stats}
    
    # High priority tickets query
    high_priority_query = {
        **base_query,
        "status": {"$in": ["open", "in_progress"]},
        "priority": "high"
    }
    high_priority = repo.collection.count_documents(high_priority_query)
    
    return {
        "total_open": status_dict.get("open", 0),
        "total_in_progress": status_dict.get("in_progress", 0),
        "total_resolved": status_dict.get("resolved", 0),
        "total_closed": status_dict.get("closed", 0),
        "high_priority_open": high_priority
    }

@ticket_router.get("/{ticket_id}", response_model=TicketModel)
async def get_ticket(
    ticket_id: str,
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Get single ticket details with role-based access control"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_role = get_user_role(current_user)
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    
    # Check access based on role
    is_creator = ticket.get("raised_by", {}).get("user_id") == user_id
    is_assigned_vendor = ticket.get("assigned_to_vendor") == user_id
    is_assigned_employee = ticket.get("assigned_to_employee") == user_id
    
    access_granted = False
    if user_role == "admin":
        access_granted = True
    elif user_role == "employee":
        access_granted = is_assigned_employee
    elif user_role in ["customer", "vendor"]:
        access_granted = is_creator or is_assigned_vendor
    
    if not access_granted:
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
    
    # Filter internal notes based on user role
    filtered_ticket = filter_internal_notes(ticket, user_role)
    
    return filtered_ticket

@ticket_router.put("/{ticket_id}", response_model=TicketModel)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Update ticket with role-based permissions"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_role = get_user_role(current_user)
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    user_name = current_user.get("full_name") or current_user.get("username") or "System"
    
    # Check permissions based on role
    if user_role == "admin":
        # Admin has full access
        pass
    elif user_role == "employee":
        # Employee can only update tickets assigned to them
        if ticket.get("assigned_to_employee") != user_id:
            raise HTTPException(status_code=403, detail="You can only update tickets assigned to you")
        
        # Employees can change status but not assign/reassign or close (admin override)
        restricted_fields = ["assigned_to_employee", "assigned_to_vendor"]
        update_dict = update_data.dict(exclude_unset=True)
        
        for field in restricted_fields:
            if field in update_dict:
                raise HTTPException(status_code=403, detail=f"Employees cannot modify {field}")
    else:
        # Customers/vendors cannot update tickets
        raise HTTPException(status_code=403, detail="Only admin and employees can update tickets")
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    
    # Add status history if status is being changed
    if "status" in update_dict:
        updated_ticket = repo.update_status(ticket_id, update_dict["status"], user_name)
        del update_dict["status"]
        if update_dict:  # If there are other fields to update
            updated_ticket = repo.update_ticket(ticket_id, update_dict)
    else:
        updated_ticket = repo.update_ticket(ticket_id, update_dict)
    
    # Filter internal notes for non-admin/employee roles
    filtered_ticket = filter_internal_notes(updated_ticket, user_role)
    
    return filtered_ticket

@ticket_router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(
    ticket_id: str,
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(support_required)
):
    """Delete ticket (irreversible)"""
    success = repo.delete_ticket(ticket_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return None

@ticket_router.get("/", response_model=dict)
async def list_tickets(
    status: Optional[List[StatusEnum]] = Query(None),
    priority: Optional[List[PriorityEnum]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """List tickets based on user role"""
    skip = (page - 1) * limit
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    user_role = get_user_role(current_user)
    
    filters = {
        "status": status,
        "priority": priority,
    }
    
    if user_role == "admin":
        # Admin sees all tickets
        tickets, total = repo.list_tickets(filters, skip=skip, limit=limit)
    elif user_role == "employee":
        # Employee sees only tickets assigned to them
        filters["assigned_to_employee"] = user_id
        tickets, total = repo.list_tickets(filters, skip=skip, limit=limit)
    else:
        # Customers/vendors see tickets they raised OR are assigned to
        tickets_raised = repo.list_tickets({**filters, "raised_by.user_id": user_id}, skip=0, limit=1000)
        tickets_assigned = repo.list_tickets({**filters, "assigned_to_vendor": user_id}, skip=0, limit=1000)
        
        # Combine and deduplicate
        all_tickets = {t["id"]: t for t in tickets_raised[0] + tickets_assigned[0]}
        tickets_list = list(all_tickets.values())
        total = len(tickets_list)
        
        # Apply pagination
        tickets = tickets_list[skip:skip + limit]
    
    # Filter internal notes for non-admin/employee users
    if user_role not in ["admin", "employee"]:
        tickets = [filter_internal_notes(ticket, user_role) for ticket in tickets]
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

@ticket_router.get("/my", response_model=dict)
async def my_tickets(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)  # ✅ Customers can see own tickets
):
    """List tickets raised by current user (Customer self-service)"""
    skip = (page - 1) * limit
    filters = {"raised_by.user_id": current_user["id"]}
    tickets, total = repo.list_tickets(filters, skip=skip, limit=limit)
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

@ticket_router.post("/{ticket_id}/responses", response_model=TicketModel)
async def add_ticket_response(
    ticket_id: str,
    response: TicketResponse,
    attachments: Optional[List[UploadFile]] = File(None),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Add a response/comment to a ticket with file upload support"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    user_role = get_user_role(current_user)
    user_name = current_user.get("full_name") or current_user.get("username") or "Unknown User"
    
    # Check if user can respond to this ticket
    is_creator = ticket.get("raised_by", {}).get("user_id") == user_id
    is_assigned_vendor = ticket.get("assigned_to_vendor") == user_id
    is_assigned_employee = ticket.get("assigned_to_employee") == user_id
    
    access_granted = False
    if user_role == "admin":
        access_granted = True
    elif user_role == "employee":
        access_granted = is_assigned_employee
    elif user_role in ["customer", "vendor"]:
        access_granted = is_creator or is_assigned_vendor
    
    if not access_granted:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this ticket")
    
    # Handle file attachments
    attachment_paths = []
    if attachments:
        ticket_number = ticket.get("ticket_number", ticket_id)
        upload_dir = f"uploaded_files/tickets/{ticket_number}/responses"
        os.makedirs(upload_dir, exist_ok=True)
        
        for file in attachments:
            if file.filename:
                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                
                attachment_paths.append({
                    "filename": file.filename,
                    "file_path": file_path,
                    "uploaded_at": datetime.utcnow()
                })
    
    response_data = {
        "author_id": user_id,
        "author_name": user_name,
        "author_role": user_role,
        "message": response.message,
        "internal": response.internal if user_role in ["admin", "employee"] else False,  # Only admin/employees can mark as internal
        "attachments": attachment_paths,
        "timestamp": datetime.utcnow()
    }
    
    updated_ticket = repo.add_response(ticket_id, response_data)
    
    # Filter internal notes based on user role
    filtered_ticket = filter_internal_notes(updated_ticket, user_role)
    
    return filtered_ticket

@ticket_router.put("/{ticket_id}/status", response_model=TicketModel)
async def update_ticket_status(
    ticket_id: str,
    new_status: StatusEnum,
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Update ticket status (Admin and assigned employees only)"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_role = get_user_role(current_user)
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    user_name = current_user.get("full_name") or current_user.get("username") or "System"
    
    # Check permissions
    if user_role == "admin":
        # Admin can change any status
        pass
    elif user_role == "employee":
        # Employee can only change status of assigned tickets
        if ticket.get("assigned_to_employee") != user_id:
            raise HTTPException(status_code=403, detail="You can only change status of tickets assigned to you")
        
        # Employees cannot close tickets (only admin can override)
        if new_status.value == "closed" and ticket.get("status") != "resolved":
            raise HTTPException(status_code=403, detail="Only admin can close tickets. Please resolve first.")
    else:
        raise HTTPException(status_code=403, detail="Only admin and assigned employees can update ticket status")
    
    updated_ticket = repo.update_status(ticket_id, new_status.value, user_name)
    
    # Filter internal notes based on user role
    filtered_ticket = filter_internal_notes(updated_ticket, user_role)
    
    return filtered_ticket

@ticket_router.get("/assigned/me", response_model=dict)
async def get_my_assigned_tickets(
    status: Optional[List[StatusEnum]] = Query(None),
    priority: Optional[List[PriorityEnum]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Get tickets assigned to current employee"""
    user_role = get_user_role(current_user)
    if user_role != "employee":
        raise HTTPException(status_code=403, detail="Only employees can access this endpoint")
    
    skip = (page - 1) * limit
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    
    filters = {
        "assigned_to_employee": user_id,
        "status": status,
        "priority": priority,
    }
    
    tickets, total = repo.list_tickets(filters, skip=skip, limit=limit)
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

@ticket_router.post("/{ticket_id}/escalate", response_model=TicketModel)
async def escalate_ticket(
    ticket_id: str,
    escalation_reason: str = Form(...),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(get_current_user)
):
    """Escalate ticket to admin (Employee only)"""
    user_role = get_user_role(current_user)
    if user_role != "employee":
        raise HTTPException(status_code=403, detail="Only employees can escalate tickets")
    
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_id = current_user.get("user_id") or current_user.get("id") or str(current_user.get("_id"))
    if ticket.get("assigned_to_employee") != user_id:
        raise HTTPException(status_code=403, detail="You can only escalate tickets assigned to you")
    
    user_name = current_user.get("full_name") or current_user.get("username") or "Employee"
    
    # Add escalation to resolution log
    escalation_data = {
        "author_id": user_id,
        "author_name": user_name,
        "author_role": "employee",
        "message": f"ESCALATED TO ADMIN: {escalation_reason}",
        "internal": True,
        "escalation": True,
        "timestamp": datetime.utcnow()
    }
    
    # Update ticket priority to high if not already
    update_data = {
        "priority": "high",
        "escalated": True,
        "escalated_by": user_id,
        "escalated_at": datetime.utcnow()
    }
    
    # Add escalation response and update ticket
    updated_ticket = repo.add_response(ticket_id, escalation_data)
    updated_ticket = repo.update_ticket(ticket_id, update_data)
    
    return updated_ticket

@ticket_router.post("/{ticket_id}/assign", response_model=TicketModel)
async def assign_ticket(
    ticket_id: str,
    assigned_to_employee: Optional[str] = Form(None),
    assigned_to_vendor: Optional[str] = Form(None),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(admin_required)
):
    """Assign or reassign ticket (Admin only)"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not assigned_to_employee and not assigned_to_vendor:
        raise HTTPException(status_code=400, detail="Must specify either employee or vendor to assign to")
    
    user_name = current_user.get("full_name") or current_user.get("username") or "Admin"
    
    update_data = {}
    if assigned_to_employee:
        update_data["assigned_to_employee"] = assigned_to_employee
    if assigned_to_vendor:
        update_data["assigned_to_vendor"] = assigned_to_vendor
    
    update_data["assigned_by"] = current_user.get("user_id") or current_user.get("id")
    update_data["assigned_at"] = datetime.utcnow()
    
    # Add assignment log
    assignment_data = {
        "author_id": current_user.get("user_id") or current_user.get("id"),
        "author_name": user_name,
        "author_role": "admin",
        "message": f"Ticket assigned to: {assigned_to_employee or assigned_to_vendor}",
        "internal": True,
        "assignment": True,
        "timestamp": datetime.utcnow()
    }
    
    updated_ticket = repo.update_ticket(ticket_id, update_data)
    updated_ticket = repo.add_response(ticket_id, assignment_data)
    
    return updated_ticket

@ticket_router.post("/{ticket_id}/close", response_model=TicketModel)
async def close_ticket(
    ticket_id: str,
    closure_reason: str = Form(...),
    repo: TicketRepository = Depends(get_ticket_repo),
    current_user: dict = Depends(admin_required)
):
    """Close ticket (Admin only)"""
    ticket = repo.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user_name = current_user.get("full_name") or current_user.get("username") or "Admin"
    
    # Add closure reason to resolution log
    closure_data = {
        "author_id": current_user.get("user_id") or current_user.get("id"),
        "author_name": user_name,
        "author_role": "admin",
        "message": f"TICKET CLOSED: {closure_reason}",
        "internal": False,
        "closure": True,
        "timestamp": datetime.utcnow()
    }
    
    # Close the ticket
    updated_ticket = repo.update_status(ticket_id, "closed", user_name)
    updated_ticket = repo.add_response(ticket_id, closure_data)
    
    return updated_ticket
