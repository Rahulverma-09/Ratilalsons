from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime

class TaskStatusUpdate(BaseModel):
    status: str = Field(..., description="New status of the task", example="completed")
    approved_by: Optional[str] = Field(None, description="User ID who approved the task")
    remarks: Optional[str] = Field(None, description="Remarks or comments")

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Title of the task")
    description: Optional[str] = Field(None, description="Description of the task")
    status: Optional[str] = Field(None, description="Status of the task")
    priority: Optional[str] = Field(None, description="Priority level")
    timeSpent: Optional[float] = Field(None, description="Time spent on task in hours")
    assigned_date: Optional[date] = Field(None, description="Current date for the task")
    remarks: Optional[str] = Field(None, description="Remarks or comments")
    approved_by: Optional[str] = Field(None, description="User ID who approved the task")

class TaskModel(BaseModel):
    id: Optional[str] = Field(None, description="Custom Task ID e.g. tsk-01")
    title: str = Field(..., description="Title of the task")
    assigned_to: str = Field(..., description="Readable user id e.g. USR-001")
    status: str = Field(default="pending", description="Current status of the task")
    assigned_at: str = Field(..., description="Site name where employee is assigned")
    assigned_by: str = Field(..., description="username/userid/role who assigned the task")
    assigned_date: date = Field(None, description="Current date for the task")
    approved_by: Optional[str] = Field(None, description="Readable user id of approver")
    approved_at: Optional[datetime] = Field(None, description="Approval time")
    remarks: Optional[str] = Field(None, description="Remarks or comments")

    class Config:
        orm_mode = True

TaskSchema = TaskModel
