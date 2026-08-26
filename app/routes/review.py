from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any
from datetime import datetime
import logging

from app.services.auth_service import AuthService
get_current_user = AuthService.get_current_user
from ..database import get_database

# Set up logger
logger = logging.getLogger(__name__)

# Create router
reviews_router = APIRouter(
    prefix="/api/reviews",
    tags=["Reviews"]
)

# Helper function to convert MongoDB ObjectId to string
def convert_objectid_to_str(data):
    if isinstance(data, dict):
        for key in list(data.keys()):
            if hasattr(data[key], '__name__') and data[key].__name__ == 'ObjectId':
                data[key] = str(data[key])
            elif isinstance(data[key], (dict, list)):
                data[key] = convert_objectid_to_str(data[key])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            data[i] = convert_objectid_to_str(item)
    return data

@reviews_router.post("/")
async def create_review(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a task review/feedback"""
    try:
        # Map frontend field names to backend field names
        task_id = data.get("taskId")
        rating = data.get("rating")
        feedback = data.get("feedback") or data.get("comments")  # Accept both field names
        
        # Validate required fields
        if not task_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required field: taskId"}
            )
        if not rating:
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required field: rating"}
            )
        if not feedback:
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required field: feedback/comments"}
            )
        
        # Create review document
        review_document = {
            "task_id": task_id,
            "rating": rating,
            "feedback": feedback,
            "review_type": data.get("reviewType", "general"),
            "recommendations": data.get("recommendations", ""),
            "reviewed_by": data.get("reviewedBy") or current_user.get("name") or "User",
            "reviewer_id": str(current_user.get("_id")),
            "created_at": data.get("createdAt") or datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Insert review
        result = db.reviews.insert_one(review_document)
        
        # Also update the task with review information if needed
        if task_id:
            db.tasks.update_one(
                {"id": task_id},
                {
                    "$set": {
                        "has_review": True,
                        "latest_review_rating": rating,
                        "updated_at": datetime.now()
                    }
                }
            )
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Review created successfully",
            "review_id": str(result.inserted_id)
        })
        
    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@reviews_router.get("/")
async def get_reviews(
    task_id: str = Query(None, description="Filter by task ID"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get reviews, optionally filtered by task ID"""
    try:
        # Build query
        query = {}
        if task_id:
            query["task_id"] = task_id
        
        # Get reviews
        reviews = []
        if "reviews" in db.list_collection_names():
            reviews_cursor = db.reviews.find(query).sort("created_at", -1)
            reviews = list(reviews_cursor)
        
        return convert_objectid_to_str({
            "success": True,
            "data": reviews
        })
        
    except Exception as e:
        logger.error(f"Error getting reviews: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )