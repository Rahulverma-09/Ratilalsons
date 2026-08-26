# app/database/schemas/ticket_schema.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId

class PriorityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class StatusEnum(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"

class CategoryEnum(str, Enum):
    billing = "billing"
    technical = "technical"
    hr = "hr"
    support = "support"
    other = "other"

class UserRoleEnum(str, Enum):
    customer = "customer"
    vendor = "vendor"
    employee = "employee"
    admin = "admin"
    support = "support"

class RaisedBy(BaseModel):
    user_id: str
    role: UserRoleEnum
    full_name: Optional[str] = None
    email: Optional[str] = None

class AssignedTo(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    role: Optional[str] = None

class ResolutionLog(BaseModel):
    timestamp: datetime
    author_id: str
    author_role: str
    message: str
    internal: bool = False

class TicketDocumentLink(BaseModel):
    document_id: str
    document_type: str
    pdf_url: str
    generated_for: str

class TicketFilter(BaseModel):
    status: Optional[List[StatusEnum]] = None
    priority: Optional[List[PriorityEnum]] = None
    category: Optional[List[CategoryEnum]] = None
    raised_by: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    limit: int = 20

class TicketBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: str
    priority: PriorityEnum = PriorityEnum.medium
    category: CategoryEnum = CategoryEnum.support
    tags: List[str] = Field(default_factory=list)
    linked_invoice: Optional[str] = None  # ✅ INVOICE INTEGRATION
    assigned_to_vendor: Optional[str] = None  # For customer complaints to vendors

class TicketCreate(TicketBase):
    raised_by: RaisedBy

class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    status: Optional[StatusEnum] = None
    assigned_to: Optional[AssignedTo] = None
    resolution_notes: Optional[str] = None

class TicketResponse(BaseModel):
    message: str
    internal: bool = False  # Whether visible only to staff

class TicketStats(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress: int
    resolved: int
    closed: int
    avg_resolution_days: float
    high_priority_open: int

class TicketListResponse(BaseModel):
    tickets: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    has_next: bool

class TicketModel(TicketBase):
    id: str
    ticket_number: str
    status: StatusEnum = StatusEnum.open
    raised_by: RaisedBy
    assigned_to: Optional[AssignedTo] = None
    created_at: datetime
    updated_at: datetime
    total_comments: int = 0
    days_open: int = 0
    linked_documents: List[TicketDocumentLink] = Field(default_factory=list)
    linked_invoices: List[str] = Field(default_factory=list)  # ✅ INVOICE LINKS
    resolution_log: List[ResolutionLog] = Field(default_factory=list)
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    
    class Config:
        from_attributes = True
        populate_by_name = True

class TicketFeedback(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
