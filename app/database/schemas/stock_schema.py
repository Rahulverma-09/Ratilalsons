from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class ProductModel(BaseModel):
    product_id: Optional[str]= None
    name: str
    sku: Optional[str] = None
    warehouseQty: int = Field(0, alias="warehouse_qty")
    depotQty: Dict[str, int] = Field(default_factory=dict, alias="depot_qty")
    lowStockThreshold: int = Field(10, alias="low_stock_threshold")
    category: Optional[str] = None
    price: float = 0
    description: Optional[str] = None
    date: Optional[datetime] = None
    low_stock: Optional[bool] = False

    class Config:
        validate_by_name = True  
        from_attributes = True  

class StockModel(BaseModel):
    stock_id: Optional[str] = None
    product_name: Optional[str] = None
    product_id: str
    type: Optional[str] = None
    quantity: int
    location: str
    by: Optional[str] = None
    date: Optional[datetime] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_city: Optional[str] = None
    stock_head: Optional[str] = None       # "Customer", "Site", "Contractor", "Staff"
    reference_id: Optional[str] = None    # id of the customer/site/staff
    reference_name: Optional[str] = None  # display name

    class Config:
        validate_by_name = True 
        from_attributes = True   

class StockLogModel(BaseModel):
    log_id: Optional[str] = None
    date: datetime = Field(default_factory=datetime.now)
    product_id: str
    product_name: str
    type: str  # "in" or "out"
    quantity: int
    before_quantity: Optional[int] = None
    after_quantity: Optional[int] = None
    location: str
    by: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_city: Optional[str] = None
    stock_head: Optional[str] = None       # "Customer", "Site", "Contractor", "Staff"
    reference_id: Optional[str] = None
    reference_name: Optional[str] = None
    status: str = Field("in", description="Action performed")  # "in", "out", "update"
    remarks: Optional[str] = None


class RequisitionModel(BaseModel):
    requisition_id: Optional[str] = None
    product_id: str
    product_name: str
    qty: int
    from_location: str
    to_location: str
    status: str  # "Pending", "Dispatched", etc.
    date: datetime = Field(default_factory=datetime.now)