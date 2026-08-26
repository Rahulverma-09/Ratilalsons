from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class VendorTypeEnum(str, Enum):
    regular = "regular"
    preferred = "preferred"
    strategic = "strategic"

class VendorStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    blocked = "blocked"

class VendorModel(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=25)
    address: str = Field(..., min_length=1, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    zip: Optional[str] = Field(None, max_length=20)
    
    # Company Information
    company: str = Field(..., min_length=1, max_length=200)
    registration_number: Optional[str] = Field(None, max_length=15, pattern=r"^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz]{1}[0-9A-Za-z]{1}$")
    tax_id: Optional[str] = Field(None, max_length=100)
    contact_person: str = Field(..., min_length=1, max_length=100)
    contact_designation: Optional[str] = Field(None, max_length=100)
    
    # Vendor Settings
    vendor_type: VendorTypeEnum = VendorTypeEnum.regular
    status: VendorStatusEnum = VendorStatusEnum.active
    
    # Files and Additional Info
    profile_picture: Optional[str] = None
    avatar_url: Optional[str] = None  # For frontend compatibility
    business_license: Optional[str] = None
    
    # Metadata
    tags: Optional[List[str]] = []
    preferences: Optional[Dict[str, Any]] = {}
    
    # Financial Data
    total_spend: Optional[float] = 0.0
    orders_count: Optional[int] = 0
    
    # Timestamps
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)
    joined_at: Optional[datetime] = None  # For frontend compatibility

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class VendorCreateModel(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=25)
    address: str = Field(..., min_length=1, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    zip: Optional[str] = Field(None, max_length=20)
    
    # Company Information
    company: str = Field(..., min_length=1, max_length=200)
    registration_number: Optional[str] = Field(None, max_length=15, pattern=r"^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz]{1}[0-9A-Za-z]{1}$")
    tax_id: Optional[str] = Field(None, max_length=100)
    contact_person: str = Field(..., min_length=1, max_length=100)
    contact_designation: Optional[str] = Field(None, max_length=100)
    
    # Vendor Settings
    vendor_type: VendorTypeEnum = VendorTypeEnum.regular
    status: VendorStatusEnum = VendorStatusEnum.active
    
    # Metadata
    tags: Optional[List[str]] = []
    preferences: Optional[Dict[str, Any]] = {}

class VendorUpdateModel(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=7, max_length=25)
    address: Optional[str] = Field(None, min_length=1, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    zip: Optional[str] = Field(None, max_length=20)
    
    # Company Information
    company: Optional[str] = Field(None, min_length=1, max_length=200)
    registration_number: Optional[str] = Field(None, max_length=15, pattern=r"^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz]{1}[0-9A-Za-z]{1}$")
    tax_id: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, min_length=1, max_length=100)
    contact_designation: Optional[str] = Field(None, max_length=100)
    
    # Vendor Settings
    vendor_type: Optional[VendorTypeEnum] = None
    status: Optional[VendorStatusEnum] = None
    
    # Metadata
    tags: Optional[List[str]] = None
    preferences: Optional[Dict[str, Any]] = None

# For vendor orders and transactions
class VendorOrderModel(BaseModel):
    id: Optional[str] = None
    vendor_id: str
    order_number: Optional[str] = None
    amount: float
    status: str = "pending"
    items: Optional[List[Dict[str, Any]]] = []
    terms: Optional[List[str]] = []
    order_date: Optional[datetime] = Field(default_factory=datetime.now)
    delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None

class VendorTransactionModel(BaseModel):
    id: Optional[str] = None
    vendor_id: str
    amount: float
    transaction_type: str  # payment, refund, adjustment
    payment_method: Optional[str] = None
    status: str = "completed"
    reference_id: Optional[str] = None
    description: Optional[str] = None
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    created_by: Optional[str] = None

class VendorNoteModel(BaseModel):
    id: Optional[str] = None
    vendor_id: str
    user_id: str
    author: Optional[str] = None  # For frontend compatibility
    content: str
    note_type: Optional[str] = "general"  # general, follow-up, issue, etc.
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None

class VendorActivityLogModel(BaseModel):
    id: Optional[str] = None
    vendor_id: str
    action: str  # created, updated, order_placed, payment_received, etc.
    description: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)

# Purchase Order schemas
class PurchaseOrderItem(BaseModel):
    name: str
    qty: float
    unit: Optional[str] = "nos"
    unit_price: Optional[float] = 0.0
    total: Optional[float] = None

class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    items: List[PurchaseOrderItem]
    notes: Optional[str] = None
    terms: Optional[List[str]] = []
    gst_percent: Optional[float] = 0.0

# Response Models
class VendorListResponse(BaseModel):
    vendors: List[VendorModel]
    total: int
    page: int
    per_page: int

class VendorStatsResponse(BaseModel):
    total_vendors: int
    active_vendors: int
    preferred_vendors: int
    strategic_vendors: int
    total_spend: float
    recent_vendors: List[VendorModel]