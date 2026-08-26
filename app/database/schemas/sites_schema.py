from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class SiteCreateModel(BaseModel):
    """
    Model for creating a new site.
    """
    site_name: str = Field(..., example="Vendest")
    site_location: str = Field(..., example="Noida")
    status: Literal["Active", "Inactive"] = Field("Inactive", example="Active")
    generator_ids: Optional[List[str]] = Field(default_factory=list, example=["GEN-001", "GEN-002"])
    assigned_employee_id: Optional[str] = Field(
        None, description="Employee ID assigned to this site", example="60e8ccc02b90186a12a0fd1a"
    )


class SiteUpdateModel(BaseModel):
    """
    Model for updating a site. All fields optional.
    """
    site_name: Optional[str] = Field(None, example="Vendest Updated")
    site_location: Optional[str] = Field(None, example="Gurgaon")
    status: Optional[Literal["Active", "Inactive"]] = Field(None, example="Active")
    generator_ids: Optional[List[str]] = Field(None, example=["GEN-003", "GEN-004"])
    assigned_employee_id: Optional[str] = Field(
        None, description="Employee ID to assign or switch to this site", example="60e8ccc02b90186a12a0fd1a"
    )


class SiteModel(SiteCreateModel):
    """
    Site full representation model for responses.
    """
    id: str = Field(..., description="MongoDB ObjectId as string")
    last_updated: Optional[str] = Field(
        None, alias="lastUpdated", description="ISO 8601 datetime string of last update"
    )

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
        extra = "ignore"
