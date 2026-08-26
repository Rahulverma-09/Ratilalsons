# app/database/schemas/vendor_bill_schema.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId

class VendorBillStatusEnum(str, Enum):
    uploaded = "uploaded"      # Vendor uploaded bill
    under_review = "under_review"  # Admin is reviewing
    approved = "approved"      # Admin approved bill
    paid = "paid"             # Admin recorded payment
    rejected = "rejected"     # Admin rejected bill

class BillItem(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    quantity: float = Field(..., ge=0.01)
    unit_price: float = Field(..., ge=0)
    tax_rate: float = Field(0.0, ge=0, le=100)
    
    @validator('unit_price')
    def validate_unit_price(cls, v):
        if v < 0:
            raise ValueError('Unit price cannot be negative')
        return v
    
    @property
    def total(self) -> float:
        return self.quantity * self.unit_price * (1 + self.tax_rate / 100)

class VendorBillFilter(BaseModel):
    vendor_id: Optional[str] = None
    status: Optional[List[VendorBillStatusEnum]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    limit: int = 20

class VendorBillBase(BaseModel):
    vendor_id: str
    vendor_name: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_address: Optional[str] = None
    bill_number: str = Field(..., max_length=50)
    reference_number: Optional[str] = None  # Vendor's reference
    items: List[BillItem] = Field(..., min_items=1, max_items=100)
    subtotal: float = Field(..., ge=0)
    tax_amount: float = Field(0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    due_date: datetime
    bill_date: datetime
    notes: Optional[str] = None
    status: VendorBillStatusEnum = VendorBillStatusEnum.uploaded
    uploaded_file_path: Optional[str] = None  # Path to uploaded bill document

class VendorBillCreate(BaseModel):
    vendor_id: str
    bill_number: str = Field(..., max_length=50)
    reference_number: Optional[str] = None
    items: List[BillItem] = Field(..., min_items=1, max_items=100)
    subtotal: float = Field(..., ge=0)
    tax_amount: float = Field(0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    due_date: datetime
    bill_date: datetime
    notes: Optional[str] = None
    uploaded_file_path: Optional[str] = None

class VendorBillUpdate(BaseModel):
    vendor_name: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_address: Optional[str] = None
    bill_number: Optional[str] = None
    reference_number: Optional[str] = None
    items: Optional[List[BillItem]] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    bill_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[VendorBillStatusEnum] = None

class VendorBillApproval(BaseModel):
    approved: bool
    approval_notes: Optional[str] = None
    payment_due_date: Optional[datetime] = None

class VendorBillPayment(BaseModel):
    payment_amount: float = Field(..., ge=0)
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    payment_method: str = Field(..., max_length=50)
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None

class VendorBillStats(BaseModel):
    total_bills: int
    uploaded: int
    under_review: int
    approved: int
    paid: int
    rejected: int
    pending_payment_amount: float
    total_paid_amount: float

class VendorBillModel(VendorBillBase):
    id: str
    created_at: datetime
    updated_at: datetime
    uploaded_by: Optional[str] = None  # User who uploaded
    reviewed_by: Optional[str] = None  # Admin who reviewed
    approved_by: Optional[str] = None  # Admin who approved
    paid_by: Optional[str] = None      # Admin who recorded payment
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    payment_amount: Optional[float] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

class VendorBillListResponse(BaseModel):
    bills: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    has_next: bool