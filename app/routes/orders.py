from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import orders_collection, get_database
from app.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

# Create orders router
orders_router = APIRouter(
    prefix="/api/orders",
    tags=["Orders Management"]
)

def convert_objectid_to_str(data):
    """Convert MongoDB document to JSON-serializable dictionary."""
    if isinstance(data, dict):
        for key in list(data.keys()):
            if isinstance(data[key], ObjectId):
                data[key] = str(data[key])
            elif isinstance(data[key], (dict, list)):
                data[key] = convert_objectid_to_str(data[key])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            data[i] = convert_objectid_to_str(item)
    return data

@orders_router.get("/statistics", response_model=dict)
async def get_orders_statistics(
    days: Optional[int] = Query(30, description="Number of days for statistics"),
    current_user: dict = Depends(get_current_user)
):
    """Get orders statistics for dashboard"""
    try:
        # Get database reference
        db = get_database()
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get orders within the date range
        pipeline = [
            {
                "$match": {
                    "created_at": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "total_amount": {"$sum": {"$toDouble": {"$ifNull": ["$total_amount", 0]}}}
                }
            }
        ]
        
        # Execute aggregation
        orders_collection_ref = orders_collection()
        result = list(orders_collection_ref.aggregate(pipeline))
        
        # Process results
        stats = {}
        for item in result:
            status = item["_id"] or "unknown"
            stats[status] = {
                "count": item["count"],
                "total_amount": item["total_amount"]
            }
        
        # Get overall totals
        total_orders = sum(stat["count"] for stat in stats.values())
        total_revenue = sum(stat["total_amount"] for stat in stats.values())
        
        # Calculate status-specific counts
        pending = stats.get("pending", {}).get("count", 0)
        completed = stats.get("completed", {}).get("count", 0)
        cancelled = stats.get("cancelled", {}).get("count", 0)
        processing = stats.get("processing", {}).get("count", 0)
        
        return {
            "success": True,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "pending": pending,
            "completed": completed,
            "cancelled": cancelled,
            "processing": processing,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "detailed_stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting orders statistics: {str(e)}")
        # Return default values if error occurs
        return {
            "success": False,
            "total_orders": 0,
            "total_revenue": 0,
            "pending": 0,
            "completed": 0,
            "cancelled": 0,
            "processing": 0,
            "period_days": days,
            "start_date": start_date.isoformat() if 'start_date' in locals() else None,
            "end_date": end_date.isoformat() if 'end_date' in locals() else None,
            "detailed_stats": {},
            "error": str(e)
        }

@orders_router.get("/", response_model=dict)
async def get_orders(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Records per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user)
):
    """Get orders with pagination"""
    try:
        # Get database reference
        orders_collection_ref = orders_collection()
        
        # Build query filter
        query_filter = {}
        if status:
            query_filter["status"] = status
        
        # Get total count
        total_orders = orders_collection_ref.count_documents(query_filter)
        
        # Calculate pagination
        skip = (page - 1) * limit
        total_pages = (total_orders + limit - 1) // limit
        
        # Get orders
        orders = list(
            orders_collection_ref.find(query_filter)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Convert ObjectIds to strings
        formatted_orders = [convert_objectid_to_str(order) for order in orders]
        
        return {
            "success": True,
            "data": formatted_orders,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_records": total_orders,
                "records_per_page": limit
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting orders: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )