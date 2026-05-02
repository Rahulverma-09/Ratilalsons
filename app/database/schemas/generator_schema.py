from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ----------- Generator (Metadata) -----------
class GeneratorModel(BaseModel):
    id: Optional[str] = None
    generator_name: str = Field(..., example="SWAN-KTL")
    generator_id: Optional[str] = Field(None, example="SWA-01")
    generator_type: Optional[str] = Field(None, example="Diesel")
    model: Optional[str] = Field(None, example="Cummins C150D5")
    fuel_type: Optional[str] = Field(None, example="Diesel")
    capacity: Optional[str] = Field(None, example="30 KVA")
    installation_date: Optional[str] = Field(None, example="2025-11-04")
    ownership: Optional[str] = Field(None, example="Owned")
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        validate_by_name = True
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True
        extra = "ignore"

# ----------- Generator Usage Record -----------
class GeneratorUsageModel(BaseModel):
    id: Optional[str] = None
    generator_id: Optional[str] = None
    site_id: Optional[str] = None
    date: str
    fuel_consumed: float
    fuel_cost_per_litre: float
    total_fuel_cost: float = 0
    generator_usage_hours: float
    operator_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        validate_by_name = True
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True
        extra = "ignore"

# ----------- Electricity Reading -----------
class ElectricityReadingModel(BaseModel):
    id: Optional[str] = None
    site_id: str
    generator_id: str
    date: str
    electricity_reading: float
    per_unit_cost: float
    total_energy_cost: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        validate_by_name = True
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True
        extra = "ignore"

# ----------- Maintenance Log -----------
class MaintenanceLogModel(BaseModel):
    id: Optional[str] = None
    generator_id: str
    site_id: Optional[str] = None
    date: str
    maintenance_status: str
    operating_hours_at_last_service: Optional[float] = None
    technician: str
    created_at: Optional[datetime] = None

    class Config:
        validate_by_name = True
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True
        extra = "ignore"

# ----------- Vehicle -----------
class VehicleModel(BaseModel):
    id: Optional[str] = None
    vehicle_id: Optional[str] = Field(None, example="VHC-01")
    vehicle_name: str = Field(..., example="Tata Ace")
    vehicle_number: str = Field(..., example="MH-12-AB-1234")
    fuel_type: Optional[str] = Field(None, example="Diesel")
    date: Optional[str] = Field(None, example="2026-04-10")
    ownership: Optional[str] = Field(None, example="Owned")
    created_at: Optional[datetime] = None

    class Config:
        validate_by_name = True
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True
        extra = "ignore"

# ----------- Site Management -----------
class SiteCreateModel(BaseModel):
    site_name: str = Field(..., example="Vendest")
    site_location: str = Field(..., example="Noida")
    status: str = Field(..., example="Active")  # Allowed values: "Active", "Inactive"
    generator_ids: Optional[List[str]] = Field(default_factory=list, example=["GEN-001", "GEN-002"])
    assigned_employee_id: Optional[str] = Field(None, example="60e8ccc02b90186a12a0fd1a")

class SiteModel(SiteCreateModel):
    id: str = Field(..., description="MongoDB ObjectId as string")
    last_updated: Optional[str] = Field(None, alias="lastUpdated")  # ISO datetime string

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
        extra = "ignore"

#--------------Reports Schema-------------

class ReadingSummary(BaseModel):
    date: Optional[str]
    electricity_reading: Optional[float]
    per_unit_cost: Optional[float]
    total_energy_cost: Optional[float]

# NEW: Fuel usage record
class FuelUsageSummary(BaseModel):
    date: Optional[str]
    fuel_usage: Optional[float]
    cost_per_litre: Optional[float]
    total_cost: Optional[float]

class GeneratorUsageSummary(BaseModel):
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    generator_id: str
    generator_name: str
    total_usage: float
    total_cost: float
    readings: Optional[List[ReadingSummary]] = None
    usage: Optional[List[FuelUsageSummary]] = None          
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None

class SiteUsageReport(BaseModel):
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    site_location: Optional[str] = None
    assigned_employee_id: Optional[str] = None
    status: Optional[str] = None
    generators: List[GeneratorUsageSummary]

class GeneratorTrendPoint(BaseModel):
    date: str  # ISO date string
    energy: float
    cost: float

# For new detailed responses:
class GeneratorUsageReportResponse(BaseModel):
    site_report: SiteUsageReport
    trend: List[GeneratorTrendPoint] = []
