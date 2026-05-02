# app/database/schemas/payroll_schema.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

class PayrollConfig(BaseModel):
    id: Optional[str] = None
    hra_rate: float = Field(40.0, ge=0, le=100, description="HRA percentage")
    allowance_rate: float = Field(20.0, ge=0, le=100, description="Allowances percentage")
    pf_rate: float = Field(12.0, ge=0, le=100, description="Provident Fund rate")
    professional_tax: float = Field(200.0, ge=0, description="Monthly professional tax")
    tds_rate: float = Field(10.0, ge=0, le=100, description="TDS rate")
    tds_threshold: float = Field(50000.0, ge=0, description="TDS exemption threshold")
    working_days: int = Field(26, ge=1, le=31, description="Monthly working days")
    active_period: str = Field("2025-12", description="Active payroll period")
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_by: Optional[str] = None

    class Config:
        # Allow ObjectId to string conversion
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class PayrollConfigCreate(BaseModel):
    hra_rate: float = Field(40.0, ge=0, le=100)
    allowance_rate: float = Field(20.0, ge=0, le=100)
    pf_rate: float = Field(12.0, ge=0, le=100)
    professional_tax: float = Field(200.0, ge=0)
    tds_rate: float = Field(10.0, ge=0, le=100)
    tds_threshold: float = Field(50000.0, ge=0)
    working_days: int = Field(26, ge=1, le=31)
    active_period: str = Field("2025-12")
    updated_by: Optional[str] = None

class SalaryStructure(BaseModel):
    id: Optional[str] = None
    position: str = Field(..., min_length=1, description="Job position")
    basic_salary: float = Field(..., ge=0, description="Monthly basic salary")
    hra_rate: float = Field(40.0, ge=0, le=100)
    allowance_rate: float = Field(20.0, ge=0, le=100)
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)
    is_active: bool = Field(True)

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class SalaryStructureCreate(BaseModel):
    position: str = Field(..., min_length=1)
    basic_salary: float = Field(..., ge=0)
    hra_rate: float = Field(40.0, ge=0, le=100)
    allowance_rate: float = Field(20.0, ge=0, le=100)

class PayrollCalculation(BaseModel):
    employee_id: str
    period: str
    gross_pay: float
    hra: float
    allowances: float
    total_earnings: float
    pf: float
    professional_tax: float
    tds: float
    total_deductions: float
    net_pay: float
    config_snapshot: Dict[str, Any]  # Store config used for audit
    attendance_days: int
    working_days: int
    calculated_at: datetime = Field(default_factory=datetime.now)

class PayrollRecord(BaseModel):
    id: Optional[str] = None
    employee_id: str
    period: str
    calculation: PayrollCalculation
    status: str = Field("pending", description="pending|approved|paid")
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payment_ref: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

# Response models
class PayrollConfigResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class SalaryStructureResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class SalaryStructuresListResponse(BaseModel):
    success: bool
    message: str
    data: List[Dict[str, Any]] = []
