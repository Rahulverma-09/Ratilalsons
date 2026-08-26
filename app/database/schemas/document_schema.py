# app/database/schemas/document_schema.py (ENHANCED VERSION)
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class DocumentBase(BaseModel):
    type: str  # e.g., "MoU", "quotation", "receipt"
    generated_for: str  # e.g., entity id (franchise, lead, invoice)
    template_data: Dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)
    linked_lead: Optional[str] = None
    linked_franchise: Optional[str] = None
    linked_invoice: Optional[str] = None  # ✅ Already exists
    linked_ticket: Optional[str] = None    # ✅ NEW: Ticket linking

class DocumentCreate(DocumentBase):
    pass

class DocumentModel(DocumentBase):
    id: str
    pdf_url: str
    
    class Config:
        from_attributes = True
