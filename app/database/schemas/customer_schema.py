from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class FeedbackModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    user_id: Optional[str] = None
    content: Optional[str] = None
    comment: Optional[str] = None  # Frontend uses comment instead of content
    rating: Optional[int] = None
    date: Optional[datetime] = Field(default_factory=datetime.now)
    type: str = "feedback"

class CommunicationLogModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    channel: str  # e.g., call, email, whatsapp
    direction: Optional[str] = None  # inbound or outbound
    agent_id: Optional[str] = None
    by: Optional[str] = None  # Frontend uses "by" instead of agent_id
    metadata: Optional[Dict[str, Any]] = None
    content: Optional[str] = None
    message: Optional[str] = None  # Frontend uses message instead of content
    time: Optional[datetime] = Field(default_factory=datetime.now)

class TransactionModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    payment_method: Optional[str] = None
    mode: Optional[str] = None  # Frontend uses mode instead of payment_method
    status: Optional[str] = "completed"
    details: Optional[str] = None
    remark: Optional[str] = None  # Frontend uses remark instead of details
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    date: Optional[datetime] = None  # Frontend uses date instead of timestamp
    reference_id: Optional[str] = None
    order_id: Optional[str] = None  # Frontend uses order_id for reference

class NoteModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    user_id: str
    author: Optional[str] = None  # Frontend uses author instead of user_id
    content: str
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    type: Optional[str] = "general"  # general, follow-up, etc.

class LoyaltyModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    points: int
    action: Optional[str] = None  # earn, redeem, expire
    change: Optional[str] = None  # Frontend uses change to display +/- points
    reason: Optional[str] = None
    date: Optional[datetime] = Field(default_factory=datetime.now)
    expiry_date: Optional[datetime] = None
    
class ComplaintModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    subject: str
    description: str
    status: Optional[str] = "open"  # open, in-progress, resolved, closed
    date: Optional[datetime] = None  # Frontend uses date
    priority: Optional[str] = "medium"  # low, medium, high
    assigned_to: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None

class ActivityLogModel(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    action: str
    description: str
    details: Optional[str] = None  # Frontend uses details
    performed_by: Optional[str] = None
    user: Optional[str] = None  # Frontend uses user
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    time: Optional[datetime] = None  # Frontend uses time
    metadata: Optional[Dict[str, Any]] = None

class CustomerProfileModel(BaseModel):
    id: Optional[str] = None
    name: str
    email: EmailStr
    password: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    profile_picture: Optional[str] = None
    avatar_url: Optional[str] = None  # Frontend uses avatar_url
    company: Optional[str] = None
    job_title: Optional[str] = None
    birthday: Optional[datetime] = None
    date_of_birth: Optional[datetime] = None  # Frontend uses date_of_birth
    anniversary: Optional[datetime] = None
    age: Optional[int] = None  # Frontend uses age
    full_name: Optional[str] = None  # Frontend uses full_name as an alternative
    preferences: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=datetime.now)
    joined_on: Optional[datetime] = None  # Frontend uses joined_on
    updated_at: Optional[datetime] = None
    status: Optional[str] = "active"
    customer_type: Optional[str] = "regular"  # regular, vip, premium
    orders_count: Optional[int] = 0  # Frontend uses orders_count
    source: Optional[str] = None  # how the customer was acquired
    lifetime_value: Optional[float] = 0.0
    feedbacks: Optional[List[FeedbackModel]] = []
    communication_logs: Optional[List[CommunicationLogModel]] = []
    transactions: Optional[List[TransactionModel]] = []
    notes: Optional[List[NoteModel]] = []
    complaints: Optional[List[ComplaintModel]] = []
    activity_logs: Optional[List[ActivityLogModel]] = []


# Customer Portal API Schemas

# Request Schemas (what frontend sends)
class FeedbackSubmitRequest(BaseModel):
    text: Optional[str] = None
    rating: int = Field(ge=1, le=5, description="Rating from 1 to 5 stars")
    vendor: Optional[str] = "General"
    product: Optional[str] = "General"
    sku: Optional[str] = None

class ComplaintSubmitRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=200, description="Brief subject of the complaint")
    description: str = Field(min_length=10, description="Detailed description of the complaint")
    vendor: Optional[str] = "General"
    product: Optional[str] = "General"
    priority: Optional[str] = Field(default="medium", pattern="^(low|medium|high)$")

class OrderItem(BaseModel):
    product_id: str = Field(description="Product ID to order")
    quantity: int = Field(ge=1, description="Quantity to order")

class OrderSubmitRequest(BaseModel):
    items: List[OrderItem] = Field(min_items=1, description="List of items to order")
    shipping_address: Optional[str] = None
    notes: Optional[str] = None

class SupportTicketRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=10, description="Detailed message")
    priority: Optional[str] = Field(default="medium", pattern="^(low|medium|high)$")

# Response Schemas (what API returns)
class CustomerSummary(BaseModel):
    id: str
    name: str
    type: str
    status: str
    revenue: float
    orders: int
    joined: str
    email: str
    phone: str
    address: str

class OrderSummary(BaseModel):
    id: str
    date: str
    status: str
    amount: float
    items: Optional[List[Dict]] = []
    item_name: Optional[str] = ""
    quantity: Optional[int] = 0

class CustomerStats(BaseModel):
    total_orders: int
    total_revenue: float
    average_order_value: float
    status: str

class DashboardResponse(BaseModel):
    customer: CustomerSummary
    recent_orders: List[OrderSummary]
    stats: CustomerStats

class OrdersResponse(BaseModel):
    orders: List[OrderSummary]
    total: int

class CustomerProfile(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    address: str
    city: Optional[str] = ""
    state: Optional[str] = ""
    country: Optional[str] = ""
    company: Optional[str] = ""
    job_title: Optional[str] = ""
    customer_type: str
    status: str
    joined: str
    lifetime_value: float
    profile_picture: Optional[str] = ""

class ProfileResponse(BaseModel):
    profile: CustomerProfile

class FeedbackResponse(BaseModel):
    id: str
    vendor: str
    product: str
    sku: Optional[str] = ""
    rating: int
    text: Optional[str] = ""
    date: str

class FeedbackListResponse(BaseModel):
    feedbacks: List[FeedbackResponse]
    total: int

class ComplaintResponse(BaseModel):
    id: str
    subject: str
    description: str
    vendor: str
    product: str
    status: str
    priority: str
    date: str

class ComplaintListResponse(BaseModel):
    complaints: List[ComplaintResponse]
    total: int

class ProductResponse(BaseModel):
    id: str
    name: str
    sku: Optional[str] = ""
    description: Optional[str] = ""
    price: float
    warehouse_qty: int
    image: Optional[str] = ""
    category: Optional[str] = ""

class PaginationInfo(BaseModel):
    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool

class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    pagination: PaginationInfo

class VendorInfo(BaseModel):
    id: str
    name: str
    products: List[str]

class VendorsResponse(BaseModel):
    vendors: List[VendorInfo]

class SuccessResponse(BaseModel):
    success: bool
    message: str
    id: Optional[str] = None

class OrderSuccessResponse(BaseModel):
    success: bool
    message: str
    order_id: str
    total_amount: float

# Cart Management Schemas
class CartItem(BaseModel):
    id: str
    product_id: str
    name: str
    sku: Optional[str] = ""
    quantity: int = Field(ge=1)
    price: float
    status: str = "In Stock"
    image: Optional[str] = ""

class CartResponse(BaseModel):
    items: List[CartItem]
    total_items: int
    total_value: float

class CartItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)

class CartUpdateRequest(BaseModel):
    quantity: int = Field(ge=0)  # 0 means remove from cart

class OrderDetailItem(BaseModel):
    name: str
    quantity: int
    price: float
    sku: Optional[str] = ""

class ShippingDetails(BaseModel):
    address: str
    contact: str
    method: str

class PaymentDetails(BaseModel):
    method: str
    transaction_id: str

class SupportDetails(BaseModel):
    contact: str
    email: str

class OrderDetailResponse(BaseModel):
    id: str
    date: str
    amount: float
    status: str
    items: List[OrderDetailItem]
    shipping: ShippingDetails
    payment: PaymentDetails
    support: SupportDetails
    invoice_url: Optional[str] = "#"

class CheckoutRequest(BaseModel):
    shipping_address: Optional[str] = None
    payment_method: Optional[str] = "COD"
    notes: Optional[str] = None