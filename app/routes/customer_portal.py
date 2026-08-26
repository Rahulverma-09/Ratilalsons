from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import List, Optional, Dict, Any
from app.database.schemas.customer_schema import (
    CustomerProfileModel, FeedbackModel, ComplaintModel,
    # New Customer Portal Schemas
    FeedbackSubmitRequest, ComplaintSubmitRequest, OrderSubmitRequest, SupportTicketRequest,
    DashboardResponse, OrdersResponse, ProfileResponse, FeedbackListResponse, ComplaintListResponse,
    ProductListResponse, VendorsResponse, SuccessResponse, OrderSuccessResponse,
    CustomerSummary, OrderSummary, CustomerStats, CustomerProfile, FeedbackResponse, 
    ComplaintResponse, ProductResponse, PaginationInfo, VendorInfo,
    # Cart Management Schemas
    CartItem, CartResponse, CartItemRequest, CartUpdateRequest, OrderDetailResponse,
    OrderDetailItem, ShippingDetails, PaymentDetails, SupportDetails, CheckoutRequest
)
from app.database.schemas.stock_schema import StockModel
from app.routes.stock_management import update_stock_logic
from app.services.auth_service_sync import AuthServiceSync
from app.database import (
    customers_collection,
    feedbacks_collection,
    complaints_collection,
    orders_collection,
    stock_collection,
    products_collection,
    stock_logs_collection,
    activity_logs_collection,
    db
)
from app.utils.auto_mail import send_order_confirmation_email
from bson import ObjectId
from datetime import datetime
from app.dependencies import get_current_user
import logging

auth_sync = AuthServiceSync()
logger = logging.getLogger("app")

# Customer Portal Router with authentication
customer_portal_router = APIRouter(
    prefix="/api/customer-portal", 
    tags=["customer-portal"], 
    dependencies=[Depends(get_current_user)]
)

def obj_id_to_str(doc):
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if "id" not in doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc

def get_customer_from_user(current_user: Dict[str, Any]) -> dict:
    """Get customer data from authenticated user"""
    user_id = current_user.get("id") or current_user.get("_id")
    
    # First try to find by user_id in customers collection
    customer = customers_collection().find_one({"user_id": str(user_id)})
    
    # If not found, try to find by email
    if not customer and current_user.get("email"):
        customer = customers_collection().find_one({"email": current_user["email"]})
    
    # If still not found, try to find by phone
    if not customer and current_user.get("phone"):
        customer = customers_collection().find_one({"phone": current_user["phone"]})
    
    if not customer:
        raise HTTPException(
            status_code=404, 
            detail="Customer profile not found. Please contact support."
        )
    
    return obj_id_to_str(customer)


# === DASHBOARD ENDPOINTS ===

@customer_portal_router.get("/dashboard", response_model=DashboardResponse)
async def get_customer_dashboard(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer dashboard overview data"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Get customer orders
        orders = list(orders_collection().find({"customer_id": customer_id}).sort("created_at", -1))
        orders_formatted = [obj_id_to_str(order) for order in orders]
        
        # Calculate stats
        total_orders = len(orders_formatted)
        total_revenue = sum(float(order.get("total_amount", 0)) for order in orders_formatted)
        
        # Get recent orders (last 5)
        recent_orders = orders_formatted[:5]
        
        # Format orders for dashboard display
        formatted_recent_orders = []
        for order in recent_orders:
            formatted_recent_orders.append({
                "id": order.get("order_id", order.get("id", "N/A")),
                "date": order.get("created_at", datetime.now()).strftime("%d %b %Y") if order.get("created_at") else "N/A",
                "status": order.get("status", "pending"),
                "amount": float(order.get("total_amount", 0))
            })
        
        customer_summary = CustomerSummary(
            id=customer["id"],
            name=customer.get("name", ""),
            type=customer.get("customer_type", "REGULAR").upper(),
            status=customer.get("status", "active"),
            revenue=total_revenue,
            orders=total_orders,
            joined=customer.get("created_at", datetime.now()).strftime("%d %b %Y") if customer.get("created_at") else "N/A",
            email=customer.get("email", ""),
            phone=customer.get("phone", ""),
            address=customer.get("address", "")
        )
        
        stats = CustomerStats(
            total_orders=total_orders,
            total_revenue=total_revenue,
            average_order_value=total_revenue / total_orders if total_orders > 0 else 0,
            status=customer.get("status", "active")
        )
        
        return DashboardResponse(
            customer=customer_summary,
            recent_orders=[OrderSummary(**order) for order in formatted_recent_orders],
            stats=stats
        )
        
    except Exception as e:
        logger.error(f"Error getting customer dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading dashboard: {str(e)}")


@customer_portal_router.get("/orders", response_model=OrdersResponse)
async def get_customer_orders(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer's order history"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Get all orders
        orders = list(orders_collection().find({"customer_id": customer_id}).sort("created_at", -1))
        
        formatted_orders = []
        for order in orders:
            order = obj_id_to_str(order)
            formatted_orders.append({
                "id": order.get("order_id", order.get("id", "N/A")),
                "date": order.get("created_at", datetime.now()).strftime("%d %b %Y") if order.get("created_at") else "N/A",
                "status": order.get("status", "pending"),
                "amount": float(order.get("total_amount", 0)),
                "items": order.get("items", []),
                "item_name": order.get("item_name", ""),
                "quantity": order.get("quantity", 0)
            })
        
        return OrdersResponse(
            orders=[OrderSummary(**order) for order in formatted_orders],
            total=len(formatted_orders)
        )
        
    except Exception as e:
        logger.error(f"Error getting customer orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading orders: {str(e)}")


@customer_portal_router.get("/profile", response_model=ProfileResponse)
async def get_customer_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer profile details"""
    try:
        customer = get_customer_from_user(current_user)
        
        # Clean and format customer data
        profile = {
            "id": customer["id"],
            "name": customer.get("name", ""),
            "email": customer.get("email", ""),
            "phone": customer.get("phone", ""),
            "address": customer.get("address", ""),
            "city": customer.get("city", ""),
            "state": customer.get("state", ""),
            "country": customer.get("country", ""),
            "company": customer.get("company", ""),
            "job_title": customer.get("job_title", ""),
            "customer_type": customer.get("customer_type", "regular"),
            "status": customer.get("status", "active"),
            "joined": customer.get("created_at", datetime.now()).strftime("%d %b %Y") if customer.get("created_at") else "N/A",
            "lifetime_value": float(customer.get("lifetime_value", 0)),
            "profile_picture": customer.get("profile_picture", "")
        }
        
        return ProfileResponse(profile=CustomerProfile(**profile))
        
    except Exception as e:
        logger.error(f"Error getting customer profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading profile: {str(e)}")


# === FEEDBACK ENDPOINTS ===

@customer_portal_router.post("/feedback", response_model=SuccessResponse)
async def submit_feedback(
    feedback_data: FeedbackSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Submit new feedback"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Validate required fields
        if not feedback_data.text and not feedback_data.rating:
            raise HTTPException(status_code=400, detail="Feedback text or rating is required")
        
        feedback_doc = {
            "customer_id": customer_id,
            "vendor": feedback_data.vendor,
            "product": feedback_data.product,
            "sku": feedback_data.sku or "",
            "rating": feedback_data.rating,
            "comment": feedback_data.text or "",
            "content": feedback_data.text or "",
            "date": datetime.now(),
            "created_at": datetime.now(),
            "user_id": customer.get("name", "Customer")
        }
        
        result = feedbacks_collection().insert_one(feedback_doc)
        feedback_doc["id"] = str(result.inserted_id)
        
        # Add activity log
        activity_logs_collection().insert_one({
            "customer_id": customer_id,
            "action": "feedback_submitted",
            "description": f"Feedback submitted for {feedback_data.product}",
            "performed_by": customer.get("name", "Customer"),
            "timestamp": datetime.now()
        })
        
        return SuccessResponse(
            success=True,
            message="Feedback submitted successfully",
            id=feedback_doc["id"]
        )
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")


@customer_portal_router.get("/feedback", response_model=FeedbackListResponse)
async def get_customer_feedback(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(None)
):
    """Get customer's feedback history"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Build query
        query = {"customer_id": customer_id}
        
        # Add search filter if provided
        if search:
            query["$or"] = [
                {"vendor": {"$regex": search, "$options": "i"}},
                {"product": {"$regex": search, "$options": "i"}},
                {"sku": {"$regex": search, "$options": "i"}},
                {"comment": {"$regex": search, "$options": "i"}}
            ]
        
        feedbacks = list(feedbacks_collection().find(query).sort("date", -1))
        
        formatted_feedbacks = []
        for feedback in feedbacks:
            feedback = obj_id_to_str(feedback)
            formatted_feedbacks.append(FeedbackResponse(
                id=feedback["id"],
                vendor=feedback.get("vendor", "General"),
                product=feedback.get("product", "General"),
                sku=feedback.get("sku", ""),
                rating=feedback.get("rating", 0),
                text=feedback.get("comment", feedback.get("content", "")),
                date=feedback.get("date", datetime.now()).strftime("%d %b %Y") if feedback.get("date") else "N/A"
            ))
        
        return FeedbackListResponse(
            feedbacks=formatted_feedbacks,
            total=len(formatted_feedbacks)
        )
        
    except Exception as e:
        logger.error(f"Error getting feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading feedback: {str(e)}")


# === COMPLAINTS ENDPOINTS ===

@customer_portal_router.post("/complaints", response_model=SuccessResponse)
async def submit_complaint(
    complaint_data: ComplaintSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Submit new complaint"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        complaint_doc = {
            "customer_id": customer_id,
            "subject": complaint_data.subject,
            "description": complaint_data.description,
            "vendor": complaint_data.vendor,
            "product": complaint_data.product,
            "status": "open",
            "priority": complaint_data.priority,
            "created_at": datetime.now(),
            "date": datetime.now(),
            "updated_at": datetime.now()
        }
        
        result = complaints_collection().insert_one(complaint_doc)
        complaint_doc["id"] = str(result.inserted_id)
        
        # Add activity log
        activity_logs_collection().insert_one({
            "customer_id": customer_id,
            "action": "complaint_submitted",
            "description": f"Complaint submitted: {complaint_data.subject}",
            "performed_by": customer.get("name", "Customer"),
            "timestamp": datetime.now()
        })
        
        return SuccessResponse(
            success=True,
            message="Complaint submitted successfully",
            id=complaint_doc["id"]
        )
        
    except Exception as e:
        logger.error(f"Error submitting complaint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error submitting complaint: {str(e)}")


@customer_portal_router.get("/complaints", response_model=ComplaintListResponse)
async def get_customer_complaints(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """Get customer's complaint history"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Build query
        query = {"customer_id": customer_id}
        
        if status:
            query["status"] = status
            
        if search:
            query["$or"] = [
                {"subject": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"vendor": {"$regex": search, "$options": "i"}},
                {"product": {"$regex": search, "$options": "i"}}
            ]
        
        complaints = list(complaints_collection().find(query).sort("created_at", -1))
        
        formatted_complaints = []
        for complaint in complaints:
            complaint = obj_id_to_str(complaint)
            formatted_complaints.append(ComplaintResponse(
                id=complaint["id"],
                subject=complaint.get("subject", ""),
                description=complaint.get("description", ""),
                vendor=complaint.get("vendor", "General"),
                product=complaint.get("product", "General"),
                status=complaint.get("status", "open"),
                priority=complaint.get("priority", "medium"),
                date=complaint.get("created_at", datetime.now()).strftime("%d %b %Y") if complaint.get("created_at") else "N/A"
            ))
        
        return ComplaintListResponse(
            complaints=formatted_complaints,
            total=len(formatted_complaints)
        )
        
    except Exception as e:
        logger.error(f"Error getting complaints: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading complaints: {str(e)}")


# === PURCHASE/PRODUCTS ENDPOINTS ===

def vendor_products_collection():
    from app.database.async_db import db
    return db["vendor_products"]

@customer_portal_router.get("/products", response_model=ProductListResponse)
async def get_available_products(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    """Get available products for purchase from vendor catalogs"""
    try:
        # Get products from vendor catalogs instead of inventory directly
        skip = (page - 1) * limit
        
        # Build aggregation pipeline to get active catalog products
        pipeline = [
            {"$match": {"is_active": True}},  # Only active catalog entries
            {
                "$lookup": {
                    "from": "products",
                    "localField": "inventory_product_id",
                    "foreignField": "_id",
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"},
            {
                "$lookup": {
                    "from": "stock",
                    "localField": "inventory_product_id",
                    "foreignField": "product_id",
                    "as": "stock_info"
                }
            },
            {
                "$addFields": {
                    "warehouse_qty": {
                        "$sum": {
                            "$map": {
                                "input": {
                                    "$filter": {
                                        "input": "$stock_info",
                                        "cond": {"$eq": [{"$toLower": "$$this.location"}, "warehouse"]}
                                    }
                                },
                                "as": "stock",
                                "in": "$$stock.quantity"
                            }
                        }
                    }
                }
            },
            {"$match": {"warehouse_qty": {"$gt": 0}}},  # Only in-stock items
        ]
        
        # Add search filter if provided
        if search:
            search_match = {
                "$or": [
                    {"product_info.name": {"$regex": search, "$options": "i"}},
                    {"product_info.sku": {"$regex": search, "$options": "i"}},
                    {"product_info.description": {"$regex": search, "$options": "i"}},
                    {"product_info.category": {"$regex": search, "$options": "i"}}
                ]
            }
            pipeline.insert(-1, {"$match": search_match})
        
        # Add pagination
        pipeline.extend([
            {"$skip": skip},
            {"$limit": limit}
        ])
        
        # Execute aggregation
        catalog_products = list(vendor_products_collection().aggregate(pipeline))
        
        # Format products
        formatted_products = []
        for catalog_entry in catalog_products:
            product = catalog_entry["product_info"]
            
            # Use custom price if set, otherwise use product price
            price = catalog_entry.get("custom_price", product.get("price", 0))
            
            formatted_products.append(ProductResponse(
                id=str(product["_id"]),
                name=product.get("name", ""),
                sku=product.get("sku", ""),
                description=catalog_entry.get("description_override") or product.get("description", ""),
                price=float(price),
                warehouse_qty=catalog_entry.get("warehouse_qty", 0),
                image=product.get("image", ""),
                category=product.get("category", "")
            ))
        
        # Get total count for pagination
        count_pipeline = [
            {"$match": {"is_active": True}},
            {
                "$lookup": {
                    "from": "products",
                    "localField": "inventory_product_id",
                    "foreignField": "_id",
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"},
            {
                "$lookup": {
                    "from": "stock",
                    "localField": "inventory_product_id",
                    "foreignField": "product_id",
                    "as": "stock_info"
                }
            },
            {
                "$addFields": {
                    "warehouse_qty": {
                        "$sum": {
                            "$map": {
                                "input": {
                                    "$filter": {
                                        "input": "$stock_info",
                                        "cond": {"$eq": [{"$toLower": "$$this.location"}, "warehouse"]}
                                    }
                                },
                                "as": "stock",
                                "in": "$$stock.quantity"
                            }
                        }
                    }
                }
            },
            {"$match": {"warehouse_qty": {"$gt": 0}}}
        ]
        
        if search:
            count_pipeline.insert(-1, {"$match": {
                "$or": [
                    {"product_info.name": {"$regex": search, "$options": "i"}},
                    {"product_info.sku": {"$regex": search, "$options": "i"}},
                    {"product_info.description": {"$regex": search, "$options": "i"}},
                    {"product_info.category": {"$regex": search, "$options": "i"}}
                ]
            }})
        
        count_pipeline.append({"$count": "total"})
        
        total_result = list(vendor_products_collection().aggregate(count_pipeline))
        total = total_result[0]["total"] if total_result else 0
        
        pagination = PaginationInfo(
            page=page,
            limit=limit,
            total=total,
            pages=(total + limit - 1) // limit,
            has_next=page * limit < total,
            has_prev=page > 1
        )
        
        return ProductListResponse(
            products=formatted_products,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error(f"Error getting products: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading products: {str(e)}")


@customer_portal_router.post("/orders", response_model=OrderSuccessResponse)
async def place_order(
    order_data: OrderSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Place a new order"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Validate order data
        if not order_data.items:
            raise HTTPException(status_code=400, detail="Order items are required")
        
        items = order_data.items
        total_amount = 0
        order_items = []
        
        # Process each item and calculate total
        for item in items:
            product_id = item.product_id
            quantity = item.quantity
            
            if quantity <= 0:
                continue
                
            # Get product details
            product = products_collection().find_one({"_id": ObjectId(product_id)})
            if not product:
                raise HTTPException(status_code=400, detail=f"Product {product_id} not found")
            
            # Check stock availability
            stock = stock_collection().find_one({"product_id": ObjectId(product_id)})
            if not stock or stock.get("quantity", 0) < quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock for {product.get('name', 'product')}"
                )
            
            item_total = float(product.get("price", 0)) * quantity
            total_amount += item_total
            
            order_items.append({
                "product_id": product_id,
                "product_name": product.get("name", ""),
                "sku": product.get("sku", ""),
                "quantity": quantity,
                "unit_price": float(product.get("price", 0)),
                "total_price": item_total
            })
        
        if not order_items:
            raise HTTPException(status_code=400, detail="No valid items in order")
        
        # Generate order ID
        last_order = orders_collection().find_one({}, sort=[("created_at", -1)])
        order_number = 1
        if last_order and last_order.get("order_id"):
            try:
                order_number = int(last_order["order_id"].replace("ord-", "")) + 1
            except:
                order_number = 1
        
        order_id = f"ord-{order_number:03d}"
        
        # Create order document
        order_doc = {
            "order_id": order_id,
            "customer_id": customer_id,
            "customer_name": customer.get("name", ""),
            "customer_email": customer.get("email", ""),
            "items": order_items,
            "total_amount": total_amount,
            "status": "pending",
            "payment_status": "pending",
            "shipping_address": order_data.shipping_address or customer.get("address", ""),
            "notes": order_data.notes,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Insert order
        result = orders_collection().insert_one(order_doc)
        order_doc["_id"] = result.inserted_id
        
        # Update stock for each item
        for item in order_items:
            try:
                await update_stock_logic(
                    stock=StockModel(
                        product_id=item["product_id"],
                        location="Warehouse",
                        quantity=item["quantity"],
                        by="customer",
                        customer_id=customer_id,
                        customer_name=customer.get("name", ""),
                        customer_city=customer.get("city", "")
                    ),
                    type="out",
                    remarks=f"Stock out for order {order_id}",
                    stock_collection=stock_collection,
                    products_collection=products_collection,
                    stock_logs_collection=stock_logs_collection,
                    customers_collection=customers_collection
                )
            except Exception as stock_error:
                logger.error(f"Stock update error for item {item['product_id']}: {stock_error}")
                # Continue with other items even if one fails
        
        # Update customer stats
        customers_collection().update_one(
            {"id": customer_id},
            {
                "$inc": {
                    "orders": 1,
                    "revenue": total_amount,
                    "lifetime_value": total_amount
                },
                "$set": {
                    "updated_at": datetime.now(),
                    "last_purchase": datetime.now()
                }
            }
        )
        
        # Add activity log
        activity_logs_collection().insert_one({
            "customer_id": customer_id,
            "action": "order_placed",
            "description": f"Order {order_id} placed with {len(order_items)} items",
            "performed_by": customer.get("name", "Customer"),
            "timestamp": datetime.now(),
            "metadata": {
                "order_id": order_id,
                "total_amount": total_amount,
                "items_count": len(order_items)
            }
        })
        
        # Send confirmation email (async)
        try:
            await send_order_confirmation_email(customer.get("email"), order_doc)
        except Exception as email_error:
            logger.error(f"Error sending confirmation email: {email_error}")
        
        return OrderSuccessResponse(
            success=True,
            message="Order placed successfully",
            order_id=order_id,
            total_amount=total_amount
        )
        
    except Exception as e:
        logger.error(f"Error placing order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error placing order: {str(e)}")


# === SUPPORT ENDPOINTS ===

@customer_portal_router.post("/support/tickets", response_model=SuccessResponse)
async def submit_support_ticket(
    ticket_data: SupportTicketRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Submit a support ticket"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Create as complaint for now (could create separate tickets collection)
        ticket_doc = {
            "customer_id": customer_id,
            "subject": ticket_data.subject,
            "description": ticket_data.message,
            "vendor": "Support",
            "product": "General Support",
            "status": "open",
            "priority": ticket_data.priority,
            "type": "support_ticket",
            "created_at": datetime.now(),
            "date": datetime.now(),
            "updated_at": datetime.now()
        }
        
        result = complaints_collection().insert_one(ticket_doc)
        ticket_doc["id"] = str(result.inserted_id)
        
        # Add activity log
        activity_logs_collection().insert_one({
            "customer_id": customer_id,
            "action": "support_ticket_submitted",
            "description": f"Support ticket submitted: {ticket_data.subject}",
            "performed_by": customer.get("name", "Customer"),
            "timestamp": datetime.now()
        })
        
        return SuccessResponse(
            success=True,
            message="Support ticket submitted successfully",
            id=ticket_doc["id"]
        )
        
    except Exception as e:
        logger.error(f"Error submitting support ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error submitting support ticket: {str(e)}")


@customer_portal_router.get("/vendors", response_model=VendorsResponse)
async def get_vendors_for_feedback():
    """Get list of vendors for feedback/complaints"""
    try:
        # Mock vendor data - replace with actual vendor collection if available
        vendor_data = [
            {"id": "V001", "name": "TechTrend Innovations", "products": ["Premium Laptop Stand", "Wireless Mouse Pro"]},
            {"id": "V002", "name": "GadgetPro Ltd", "products": ["Wireless Mouse Pro", "USB-C Hub Adapter"]},
            {"id": "V003", "name": "ConnectHub Solutions", "products": ["USB-C Hub Adapter"]},
        ]
        
        vendors = [VendorInfo(**vendor) for vendor in vendor_data]
        
        return VendorsResponse(vendors=vendors)
    
    except Exception as e:
        logger.error(f"Error getting vendors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching vendors")


# === CART MANAGEMENT ENDPOINTS ===

@customer_portal_router.get("/cart", response_model=CartResponse)
async def get_customer_cart(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer's shopping cart"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # For now, we'll use a simple approach - cart items stored in a cart collection
        # You could also store cart in Redis for better performance
        cart_collection = lambda: db.cart
        
        cart_items = list(cart_collection().find({"customer_id": customer_id}))
        
        formatted_items = []
        total_value = 0
        total_items = 0
        
        for cart_item in cart_items:
            # Get product details
            product = products_collection().find_one({"_id": ObjectId(cart_item["product_id"])})
            if not product:
                continue
                
            # Get current stock status
            stock = stock_collection().find_one({"product_id": ObjectId(cart_item["product_id"])})
            stock_qty = stock.get("quantity", 0) if stock else 0
            
            status = "In Stock" if stock_qty > 0 else "Out of Stock"
            if stock_qty > 0 and stock_qty <= 5:
                status = "Low Stock"
            
            item = CartItem(
                id=str(cart_item["_id"]),
                product_id=str(product["_id"]),
                name=product.get("name", ""),
                sku=product.get("sku", ""),
                quantity=cart_item["quantity"],
                price=float(product.get("price", 0)),
                status=status,
                image=product.get("image", "")
            )
            
            formatted_items.append(item)
            total_value += item.price * item.quantity
            total_items += item.quantity
        
        return CartResponse(
            items=formatted_items,
            total_items=total_items,
            total_value=total_value
        )
        
    except Exception as e:
        logger.error(f"Error getting cart: {e}", exc_info=True)
        # Return empty cart on error
        return CartResponse(items=[], total_items=0, total_value=0.0)


@customer_portal_router.post("/cart", response_model=SuccessResponse)
async def add_to_cart(
    cart_item: CartItemRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Add item to cart"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Check if product exists
        product = products_collection().find_one({"_id": ObjectId(cart_item.product_id)})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check stock availability
        stock = stock_collection().find_one({"product_id": ObjectId(cart_item.product_id)})
        if not stock or stock.get("quantity", 0) < cart_item.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        
        # Create cart collection reference
        cart_collection = lambda: db.cart
        
        # Check if item already exists in cart
        existing_item = cart_collection().find_one({
            "customer_id": customer_id,
            "product_id": cart_item.product_id
        })
        
        if existing_item:
            # Update quantity
            new_quantity = existing_item["quantity"] + cart_item.quantity
            if stock.get("quantity", 0) < new_quantity:
                raise HTTPException(status_code=400, detail="Total quantity exceeds available stock")
            
            cart_collection().update_one(
                {"_id": existing_item["_id"]},
                {
                    "$set": {
                        "quantity": new_quantity,
                        "updated_at": datetime.now()
                    }
                }
            )
        else:
            # Add new item
            cart_collection().insert_one({
                "customer_id": customer_id,
                "product_id": cart_item.product_id,
                "quantity": cart_item.quantity,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            })
        
        return SuccessResponse(
            success=True,
            message="Item added to cart successfully"
        )
        
    except Exception as e:
        logger.error(f"Error adding to cart: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding to cart: {str(e)}")


@customer_portal_router.put("/cart/{item_id}", response_model=SuccessResponse)
async def update_cart_item(
    item_id: str,
    update_data: CartUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update cart item quantity or remove item"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        cart_collection = lambda: db.cart
        
        # Find cart item
        cart_item = cart_collection().find_one({
            "_id": ObjectId(item_id),
            "customer_id": customer_id
        })
        
        if not cart_item:
            raise HTTPException(status_code=404, detail="Cart item not found")
        
        if update_data.quantity == 0:
            # Remove item from cart
            cart_collection().delete_one({"_id": ObjectId(item_id)})
            return SuccessResponse(
                success=True,
                message="Item removed from cart"
            )
        else:
            # Update quantity
            # Check stock availability
            stock = stock_collection().find_one({"product_id": ObjectId(cart_item["product_id"])})
            if not stock or stock.get("quantity", 0) < update_data.quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
            
            cart_collection().update_one(
                {"_id": ObjectId(item_id)},
                {
                    "$set": {
                        "quantity": update_data.quantity,
                        "updated_at": datetime.now()
                    }
                }
            )
            
            return SuccessResponse(
                success=True,
                message="Cart updated successfully"
            )
        
    except Exception as e:
        logger.error(f"Error updating cart: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error updating cart: {str(e)}")


@customer_portal_router.delete("/cart", response_model=SuccessResponse)
async def clear_cart(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Clear all items from cart"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        cart_collection = lambda: db.cart
        cart_collection().delete_many({"customer_id": customer_id})
        
        return SuccessResponse(
            success=True,
            message="Cart cleared successfully"
        )
        
    except Exception as e:
        logger.error(f"Error clearing cart: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error clearing cart: {str(e)}")


@customer_portal_router.post("/cart/checkout", response_model=OrderSuccessResponse)
async def checkout_cart(
    checkout_data: CheckoutRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Checkout cart and create order"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        cart_collection = lambda: db.cart
        
        # Get cart items
        cart_items = list(cart_collection().find({"customer_id": customer_id}))
        
        if not cart_items:
            raise HTTPException(status_code=400, detail="Cart is empty")
        
        # Prepare order items
        order_items = []
        total_amount = 0
        
        for cart_item in cart_items:
            product = products_collection().find_one({"_id": ObjectId(cart_item["product_id"])})
            if not product:
                continue
            
            # Check stock
            stock = stock_collection().find_one({"product_id": ObjectId(cart_item["product_id"])})
            if not stock or stock.get("quantity", 0) < cart_item["quantity"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.get('name', 'product')}"
                )
            
            item_total = float(product.get("price", 0)) * cart_item["quantity"]
            total_amount += item_total
            
            order_items.append({
                "product_id": str(product["_id"]),
                "product_name": product.get("name", ""),
                "sku": product.get("sku", ""),
                "quantity": cart_item["quantity"],
                "unit_price": float(product.get("price", 0)),
                "total_price": item_total
            })
        
        # Generate order ID
        last_order = orders_collection().find_one({}, sort=[("created_at", -1)])
        order_number = 1
        if last_order and last_order.get("order_id"):
            try:
                order_number = int(last_order["order_id"].replace("ord-", "")) + 1
            except:
                order_number = 1
        
        order_id = f"ord-{order_number:03d}"
        
        # Create order
        order_doc = {
            "order_id": order_id,
            "customer_id": customer_id,
            "customer_name": customer.get("name", ""),
            "customer_email": customer.get("email", ""),
            "items": order_items,
            "total_amount": total_amount,
            "status": "pending",
            "payment_status": "pending",
            "payment_method": checkout_data.payment_method,
            "shipping_address": checkout_data.shipping_address or customer.get("address", ""),
            "notes": checkout_data.notes,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        result = orders_collection().insert_one(order_doc)
        
        # Update stock and clear cart (same logic as place_order)
        for item in order_items:
            try:
                await update_stock_logic(
                    stock=StockModel(
                        product_id=item["product_id"],
                        location="Warehouse",
                        quantity=item["quantity"],
                        by="customer",
                        customer_id=customer_id,
                        customer_name=customer.get("name", ""),
                        customer_city=customer.get("city", "")
                    ),
                    type="out",
                    remarks=f"Stock out for order {order_id}",
                    stock_collection=stock_collection,
                    products_collection=products_collection,
                    stock_logs_collection=stock_logs_collection,
                    customers_collection=customers_collection
                )
            except Exception as stock_error:
                logger.error(f"Stock update error for item {item['product_id']}: {stock_error}")
        
        # Clear cart
        cart_collection().delete_many({"customer_id": customer_id})
        
        # Update customer stats
        customers_collection().update_one(
            {"id": customer_id},
            {
                "$inc": {
                    "orders": 1,
                    "revenue": total_amount,
                    "lifetime_value": total_amount
                },
                "$set": {
                    "updated_at": datetime.now(),
                    "last_purchase": datetime.now()
                }
            }
        )
        
        return OrderSuccessResponse(
            success=True,
            message="Order placed successfully",
            order_id=order_id,
            total_amount=total_amount
        )
        
    except Exception as e:
        logger.error(f"Error during checkout: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


# === ORDER DETAILS ENDPOINT ===

@customer_portal_router.get("/orders/{order_id}", response_model=OrderDetailResponse)
async def get_order_details(
    order_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get detailed order information"""
    try:
        customer = get_customer_from_user(current_user)
        customer_id = customer["id"]
        
        # Find order
        order = orders_collection().find_one({
            "customer_id": customer_id,
            "$or": [
                {"order_id": order_id},
                {"_id": ObjectId(order_id) if ObjectId.is_valid(order_id) else None}
            ]
        })
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = obj_id_to_str(order)
        
        # Format order items
        formatted_items = []
        for item in order.get("items", []):
            formatted_items.append(OrderDetailItem(
                name=item.get("product_name", item.get("name", "")),
                quantity=item.get("quantity", 0),
                price=float(item.get("unit_price", item.get("price", 0))),
                sku=item.get("sku", "")
            ))
        
        # Format shipping details
        shipping = ShippingDetails(
            address=order.get("shipping_address", customer.get("address", "")),
            contact=customer.get("phone", ""),
            method=order.get("shipping_method", "Standard Delivery")
        )
        
        # Format payment details
        payment = PaymentDetails(
            method=order.get("payment_method", "COD"),
            transaction_id=order.get("transaction_id", "")
        )
        
        # Support details
        support = SupportDetails(
            contact="+91-1800-123-456",
            email="support@ratilalcrm.com"
        )
        
        return OrderDetailResponse(
            id=order.get("order_id", order["id"]),
            date=order.get("created_at", datetime.now()).strftime("%d %b %Y"),
            amount=float(order.get("total_amount", 0)),
            status=order.get("status", "pending"),
            items=formatted_items,
            shipping=shipping,
            payment=payment,
            support=support,
            invoice_url="#"  # You can generate actual invoice URLs here
        )
        
    except Exception as e:
        logger.error(f"Error getting order details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading order details: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error getting vendors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading vendors: {str(e)}")