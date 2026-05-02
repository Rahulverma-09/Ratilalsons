from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ----------- Inactivity & Overtime Alert Model -----------
class InactivityAlertModel(BaseModel):
    id: Optional[str] = None
    site: str
    generator: str
    issue: str
    start: str
    status: str
    createdAt: Optional[datetime] = Field(None, alias="created_at")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "validate_by_name": True,
    }

# ----------- Reading/Performance Anomaly Alert Model -----------
class AnomalyAlertModel(BaseModel):
    id: Optional[str] = None                    # Document/row ID if from DB
    site_id: Optional[str] = None               # Unique site ID if needed for drilldown/filter
    site: str                                   # Site name
    generator_id: Optional[str] = None          # Unique generator ID if needed
    device: str                                 # Generator/device name
    anomaly: str                                # "No electricity reading" / "Reading is zero"
    detected: str                               # Date detected, format "YYYY-MM-DD"
    status: str                                 # "open", "closed", etc.
    created_at: Optional[datetime] = Field(None, alias="createdAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "validate_by_name": True,
    }

# ----------- Combined Alerts Response (optional) -----------
class AlertsResponseModel(BaseModel):
    inactivity_alerts: List['InactivityAlertModel']
    anomaly_alerts: List[AnomalyAlertModel]

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "validate_by_name": True,
    }