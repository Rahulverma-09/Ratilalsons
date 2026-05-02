from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, Request
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.routes.auth import get_current_user
from pydantic import BaseModel
import logging

customer_router = APIRouter(prefix="/api/customer", tags=["customer"])

class OrderRequest(BaseModel):
    delivery_address: str
    payment_method: str = "Credit Card"
    notes: Optional[str] = None

class FeedbackRequest(BaseModel):
    text: str
    rating: int = 5
    vendor: Optional[str] = "General"
    product: Optional[str] = "General"

class FeedbackResponse(BaseModel):
    id: str
    vendor: str
    product: str
    rating: int
    text: str
    date: str

@customer_router.get("/dashboard")
async def get_customer_dashboard(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer dashboard data"""
    try:
        # Mock dashboard data for customer
        dashboard_data = {
            "total_orders": 12,
            "pending_orders": 2,
            "completed_orders": 10,
            "total_spent": 45000,
            "recent_orders": [
                {
                    "id": "ORD001",
                    "date": "2024-11-25",
                    "status": "Delivered",
                    "amount": 2500
                },
                {
                    "id": "ORD002", 
                    "date": "2024-11-28",
                    "status": "Pending",
                    "amount": 1800
                }
            ],
            "favorite_products": [
                {
                    "id": "PROD001",
                    "name": "Solar Panel 100W",
                    "price": 5000,
                    "category": "Solar Equipment"
                },
                {
                    "id": "PROD002",
                    "name": "Inverter 1KW", 
                    "price": 8000,
                    "category": "Inverters"
                }
            ]
        }
        
        return dashboard_data
        
    except Exception as e:
        logging.error(f"Error getting customer dashboard: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading dashboard data"
        )

@customer_router.get("/products")
async def get_customer_products(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get products available to customer"""
    try:
        # Mock products data
        products = [
            {
                "id": "PROD001",
                "name": "Solar Panel 100W",
                "description": "High efficiency monocrystalline solar panel",
                "price": 5000,
                "category": "Solar Panels",
                "in_stock": True,
                "stock_quantity": 25,
                "image_url": "/static/images/solar-panel.jpg"
            },
            {
                "id": "PROD002", 
                "name": "Inverter 1KW",
                "description": "Pure sine wave solar inverter",
                "price": 8000,
                "category": "Inverters",
                "in_stock": True,
                "stock_quantity": 15,
                "image_url": "/static/images/inverter.jpg"
            },
            {
                "id": "PROD003",
                "name": "Solar Battery 100Ah",
                "description": "Deep cycle solar battery",
                "price": 12000,
                "category": "Batteries",
                "in_stock": True,
                "stock_quantity": 10,
                "image_url": "/static/images/battery.jpg"
            },
            {
                "id": "PROD004",
                "name": "Charge Controller MPPT 30A",
                "description": "Maximum power point tracking charge controller",
                "price": 3500,
                "category": "Controllers",
                "in_stock": True,
                "stock_quantity": 20,
                "image_url": "/static/images/controller.jpg"
            }
        ]
        
        # Apply filters
        filtered_products = products
        if category:
            filtered_products = [p for p in filtered_products if p["category"].lower() == category.lower()]
        if search:
            filtered_products = [p for p in filtered_products if search.lower() in p["name"].lower() or search.lower() in p["description"].lower()]
        
        # Pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_products = filtered_products[start_idx:end_idx]
        
        return {
            "products": paginated_products,
            "total": len(filtered_products),
            "page": page,
            "limit": limit,
            "total_pages": (len(filtered_products) + limit - 1) // limit
        }
        
    except Exception as e:
        logging.error(f"Error getting customer products: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading products"
        )

@customer_router.get("/orders")
async def get_customer_orders(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer orders"""
    try:
        # Mock orders data
        orders = [
            {
                "order_id": "ORD001",
                "order_number": "ORD-2024-001",
                "order_date": "2024-11-25",
                "status": "Delivered",
                "total_amount": 2500,
                "items": [
                    {
                        "product_name": "Solar Panel 100W",
                        "quantity": 1,
                        "price": 5000,
                        "total": 5000
                    }
                ],
                "delivery_address": "123 Main St, City, State",
                "tracking_number": "TRK123456789"
            },
            {
                "order_id": "ORD002",
                "order_number": "ORD-2024-002", 
                "order_date": "2024-11-28",
                "status": "Processing",
                "total_amount": 1800,
                "items": [
                    {
                        "product_name": "Charge Controller MPPT 30A",
                        "quantity": 2,
                        "price": 3500,
                        "total": 7000
                    }
                ],
                "delivery_address": "456 Oak Ave, City, State",
                "tracking_number": None
            },
            {
                "order_id": "ORD003",
                "order_number": "ORD-2024-003",
                "order_date": "2024-11-20",
                "status": "Delivered", 
                "total_amount": 12000,
                "items": [
                    {
                        "product_name": "Solar Battery 100Ah",
                        "quantity": 1,
                        "price": 12000,
                        "total": 12000
                    }
                ],
                "delivery_address": "789 Pine St, City, State",
                "tracking_number": "TRK987654321"
            }
        ]
        
        return {"orders": orders}
        
    except Exception as e:
        logging.error(f"Error getting customer orders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading orders"
        )

@customer_router.post("/orders")
async def create_order(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create new order from cart"""
    try:
        # Handle both form data and JSON
        content_type = request.headers.get("content-type", "")
        
        if "application/x-www-form-urlencoded" in content_type:
            form = await request.form()
            delivery_address = form.get("delivery_address", "Default Address")
            payment_method = form.get("payment_method", "Credit Card")
            notes = form.get("notes")
        else:
            # JSON data
            data = await request.json()
            delivery_address = data.get("delivery_address", "Default Address")
            payment_method = data.get("payment_method", "Credit Card")
            notes = data.get("notes")
        
        # Mock order creation
        order_id = f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return {
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_amount": 15000,
            "delivery_address": delivery_address,
            "payment_method": payment_method,
            "notes": notes,
            "order_date": datetime.now().isoformat(),
            "status": "Processing"
        }
        
    except Exception as e:
        logging.error(f"Error creating order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating order"
        )

@customer_router.get("/cart")
async def get_customer_cart(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get customer shopping cart"""
    try:
        # Mock cart data
        cart = {
            "items": [
                {
                    "id": "CART001",
                    "product_id": "PROD001",
                    "product_name": "Solar Panel 100W",
                    "price": 5000,
                    "quantity": 2,
                    "total": 10000,
                    "added_date": "2024-11-28"
                },
                {
                    "id": "CART002",
                    "product_id": "PROD004", 
                    "product_name": "Charge Controller MPPT 30A",
                    "price": 3500,
                    "quantity": 1,
                    "total": 3500,
                    "added_date": "2024-11-28"
                }
            ],
            "total_items": 3,
            "total_amount": 13500,
            "estimated_tax": 1350,
            "estimated_shipping": 500,
            "estimated_total": 15350
        }
        
        return cart
        
    except Exception as e:
        logging.error(f"Error getting customer cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading cart"
        )

@customer_router.post("/cart/add")
async def add_to_cart(
    product_id: str,
    quantity: int = 1,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Add item to customer cart"""
    try:
        # Mock response
        return {
            "message": "Item added to cart successfully",
            "cart_item": {
                "product_id": product_id,
                "quantity": quantity,
                "added_date": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logging.error(f"Error adding to cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error adding item to cart"
        )

@customer_router.delete("/cart/{item_id}")
async def remove_from_cart(
    item_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Remove item from customer cart"""
    try:
        return {"message": "Item removed from cart successfully"}
        
    except Exception as e:
        logging.error(f"Error removing from cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error removing item from cart"
        )

@customer_router.put("/cart/{item_id}")
async def update_cart_item(
    item_id: str,
    quantity: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update cart item quantity"""
    try:
        return {
            "message": "Cart item updated successfully",
            "item": {
                "id": item_id,
                "quantity": quantity,
                "updated_date": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logging.error(f"Error updating cart item: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating cart item"
        )

@customer_router.post("/checkout")
async def checkout_cart(
    delivery_address: str = Query(...),
    payment_method: str = Query("Credit Card"),
    notes: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Checkout customer cart"""
    try:
        # Mock checkout process
        order_id = f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return {
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_amount": 15000,
            "delivery_address": delivery_address,
            "payment_method": payment_method,
            "notes": notes,
            "order_date": datetime.now().isoformat(),
            "status": "Processing"
        }
        
    except Exception as e:
        logging.error(f"Error during checkout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Checkout failed"
        )

@customer_router.delete("/cart/clear")
async def clear_cart(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Clear customer cart"""
    try:
        return {"message": "Cart cleared successfully"}
        
    except Exception as e:
        logging.error(f"Error clearing cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error clearing cart"
        )

@customer_router.get("/orders/{order_id}")
async def get_order_details(
    order_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get specific order details"""
    try:
        # Mock order details
        order_details = {
            "order_id": order_id,
            "customer_name": current_user.get("name", "Customer"),
            "customer_email": current_user.get("email", "customer@example.com"),
            "order_date": "2024-11-29",
            "status": "Processing",
            "delivery_address": "123 Main St, City, State",
            "payment_method": "Credit Card",
            "total_amount": 15000,
            "items": [
                {
                    "name": "Solar Panel 100W",
                    "sku": "SP100W",
                    "quantity": 2,
                    "unit_price": 5000,
                    "total_price": 10000
                },
                {
                    "name": "Inverter 1KW",
                    "sku": "INV1KW",
                    "quantity": 1,
                    "unit_price": 8000,
                    "total_price": 8000
                }
            ],
            "tracking_info": {
                "tracking_number": "TRK123456789",
                "carrier": "Blue Dart",
                "estimated_delivery": "2024-12-05"
            },
            "payment_details": {
                "transaction_id": "TXN123456789",
                "payment_status": "Paid"
            }
        }
        
        return order_details
        
    except Exception as e:
        logging.error(f"Error getting order details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading order details"
        )

@customer_router.post("/invoice/generate")
async def generate_customer_invoice(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate invoice for customer order"""
    try:
        data = await request.json()
        
        # Generate invoice ID
        invoice_id = f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Mock invoice generation with PDF URL
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
        pdf_filename = f"invoice_{invoice_number.lower()}.pdf"
        
        invoice_response = {
            "message": "Invoice generated successfully",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "customer_name": data.get("customer_name", "Customer"),
            "customer_email": data.get("customer_email", ""),
            "order_id": data.get("order_id", ""),
            "total_amount": data.get("total_amount", 0),
            "tax_amount": data.get("tax_amount", 0),
            "subtotal": data.get("subtotal", 0),
            "status": "generated",
            "issue_date": datetime.now().isoformat(),
            "due_date": data.get("due_date", datetime.now().isoformat()),
            "items": data.get("items", []),
            "pdf_url": f"http://localhost:8000/api/invoices/{invoice_id}/download",
            "download_url": f"http://localhost:8000/api/customer/invoice/{invoice_id}/download"
        }
        
        return invoice_response
        
    except Exception as e:
        logging.error(f"Error generating invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating invoice"
        )

@customer_router.get("/invoice/{invoice_id}/download")
async def download_customer_invoice(
    invoice_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Download invoice PDF for customer"""
    try:
        from fastapi.responses import Response
        import io
        import os
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import Table, TableStyle
        
        # Create a professional PDF invoice
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Add Logo
        logo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "Ratilal & Sons Logo.png"))
        
        if os.path.exists(logo_path):
            p.drawImage(logo_path, 40, height - 120, width=130, height=90, preserveAspectRatio=True, mask='auto')
        else:
            p.setFont("Helvetica-Bold", 24)
            p.drawString(40, height - 80, "RATILAL & SONS")

        # Company Header Info
        p.setFont("Helvetica-Bold", 10)
        p.drawRightString(width - 40, height - 60, "Ramesh Sorathiya")
        p.drawRightString(width - 40, height - 75, "Mo. 81601 19891")

        p.setFont("Helvetica-Bold", 20)
        p.setFillColor(colors.HexColor("#2a5c8a"))
        p.drawString(180, height - 60, "RATILAL & SONS")
        
        p.setFont("Helvetica-Oblique", 10)
        p.setFillColor(colors.black)
        p.drawString(180, height - 75, "Govt. Approved Contractor & Engineers")
        p.drawString(180, height - 90, '" Ratilal & Sons House "')
        
        p.setFont("Helvetica", 9)
        p.drawString(180, height - 105, "Add: Plot No. 49, Opp. Hanuman Temple,G.I.D.C., Anjar - Kutch.(Gujarat) 370110")
        p.drawString(180, height - 120, "Email ID : rsinfraprojects2014@gmail.com")
        
        p.setFont("Helvetica-Bold", 9)
        p.drawString(180, height - 135, "Gujarat GST No. : 24BFIPS0859D1ZF, Maharastra GST No. : 27BFIPS0859D1Z9")

        # Line Separator
        p.setStrokeColor(colors.HexColor("#2a5c8a"))
        p.setLineWidth(1.5)
        p.line(40, height - 150, width - 40, height - 150)

        # Title
        p.setFont("Helvetica-Bold", 16)
        p.drawString(40, height - 180, "TAX INVOICE")

        # Layout Column 1: Invoice Details
        p.setFont("Helvetica-Bold", 10)
        p.drawString(40, height - 210, "Invoice Number:")
        p.setFont("Helvetica", 10)
        p.drawString(130, height - 210, str(invoice_id))

        p.setFont("Helvetica-Bold", 10)
        p.drawString(40, height - 230, "Date:")
        p.setFont("Helvetica", 10)
        p.drawString(130, height - 230, str(datetime.now().strftime('%Y-%m-%d')))
        
        # Layout Column 2: Billed To (Very Distinct)
        p.setFillColor(colors.HexColor("#f8fafc"))
        p.rect(width/2 - 20, height - 260, width/2 - 20, 95, fill=True, stroke=False)
        p.setFillColor(colors.black)
        
        p.setFont("Helvetica-Bold", 11)
        p.drawString(width / 2, height - 180, "BILL TO:")
        p.setFont("Helvetica-Bold", 11)
        p.drawString(width / 2, height - 200, str(current_user.get('full_name', 'Customer')))
        
        p.setFont("Helvetica", 10)
        p.setFillColor(colors.HexColor("#475569"))
        p.drawString(width / 2, height - 215, str(current_user.get('email', '')))
        
        p.setFillColor(colors.black)

        # Table Items
        y_position = height - 290
        
        data = [["#", "Item Description", "Qty", "Unit Price", "Total"]]
        
        # Mock customer data (normally fetched from DB)
        data.append(["1", "Solar Panel 100W", "2", "Rs.5,000.00", "Rs.10,000.00"])
        data.append(["2", "Installation Service", "1", "Rs.5,000.00", "Rs.5,000.00"])

        table = Table(data, colWidths=[30, 260, 50, 80, 95])
        style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2a5c8a")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('ALIGN', (0,1), (0,-1), 'CENTER'),
            ('ALIGN', (1,1), (1,-1), 'LEFT'),
            ('ALIGN', (2,1), (2,-1), 'CENTER'),
            ('ALIGN', (3,1), (4,-1), 'RIGHT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 10),
            ('BACKGROUND', (0,1), (-1,-1), colors.white),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e5e7eb")),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('PADDING', (0,0), (-1,-1), 8),
        ])
        table.setStyle(style)
        
        w, h = table.wrapOn(p, width, height)
        table.drawOn(p, 40, y_position - h)

        # Totals
        totals_y = y_position - h - 30
        
        p.setFont("Helvetica-Bold", 10)
        p.drawRightString(width - 140, totals_y, "Subtotal:")
        p.setFont("Helvetica", 10)
        p.drawRightString(width - 40, totals_y, f"Rs.15,000.00")
        
        totals_y -= 25
        p.setFont("Helvetica-Bold", 10)
        p.drawRightString(width - 140, totals_y, f"Tax (18%):")
        p.setFont("Helvetica", 10)
        p.drawRightString(width - 40, totals_y, f"Rs.2,700.00")
        
        totals_y -= 30
        p.setFillColor(colors.HexColor("#f0fdf4")) # Soft green
        p.rect(width - 200, totals_y - 12, 160, 30, fill=True, stroke=False)
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 12)
        p.drawRightString(width - 140, totals_y - 2, "Total:")
        p.setFillColor(colors.HexColor("#0f766e")) # Teal
        p.setFont("Helvetica-Bold", 14)
        p.drawRightString(width - 40, totals_y - 4, f"Rs.17,700.00")

        # Footer
        p.setFillColor(colors.black)
        p.setFont("Helvetica", 10)
        p.drawString(40, 40, "Thank you for your business!")
        p.setFont("Helvetica-Oblique", 8)
        p.drawRightString(width - 40, 40, "Generated by Ratilal & Sons Portal")
        
        p.showPage()
        p.save()
        buffer.seek(0)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        logging.info(f"Generated PDF for invoice {invoice_id}, size: {len(pdf_content)} bytes")
        
        # Return PDF response
        return Response(
            pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=invoice_{invoice_id}.pdf",
                "Content-Length": str(len(pdf_content))
            }
        )
        
    except Exception as e:
        logging.error(f"Error downloading invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error downloading invoice"
        )

@customer_router.post("/feedback")
async def submit_customer_feedback(
    feedback_data: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Submit customer feedback"""
    try:
        # Mock feedback submission - replace with actual database insert
        feedback_id = f"FB-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Here you would save to your feedbacks collection:
        # from app.database import feedbacks_collection
        # result = feedbacks_collection().insert_one({
        #     "customer_id": current_user.get("id"),
        #     "vendor": feedback_data.vendor,
        #     "product": feedback_data.product,
        #     "rating": feedback_data.rating,
        #     "comment": feedback_data.text,
        #     "created_at": datetime.now(),
        #     "user_id": current_user.get("name", "Customer")
        # })
        
        return {
            "success": True,
            "message": "Feedback submitted successfully",
            "feedback_id": feedback_id,
            "rating": feedback_data.rating,
            "text": feedback_data.text,
            "vendor": feedback_data.vendor,
            "product": feedback_data.product
        }
        
    except Exception as e:
        logging.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error submitting feedback"
        )

@customer_router.get("/feedback")
async def get_customer_feedback(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(None)
):
    """Get customer feedback history"""
    try:
        # Mock feedback data - replace with actual database query
        feedbacks = [
            {
                "id": "FB001",
                "vendor": "Madhav Kaushal", 
                "product": "Solar Panel 100W",
                "rating": 5,
                "text": "Excellent product quality and service!",
                "date": "2024-11-25",
                "created_at": "2024-11-25T10:30:00"
            },
            {
                "id": "FB002",
                "vendor": "Rajesh Kumar",
                "product": "Inverter 1KW", 
                "rating": 4,
                "text": "Good installation service, prompt delivery.",
                "date": "2024-11-20",
                "created_at": "2024-11-20T14:45:00"
            },
            {
                "id": "FB003",
                "vendor": "Priya Sharma",
                "product": "Battery System",
                "rating": 5,
                "text": "Outstanding battery performance, highly recommended!",
                "date": "2024-11-15",
                "created_at": "2024-11-15T09:15:00"
            }
        ]
        
        # Filter by search if provided
        if search:
            search_lower = search.lower()
            feedbacks = [
                fb for fb in feedbacks 
                if search_lower in fb["vendor"].lower() 
                or search_lower in fb["product"].lower()
                or search_lower in fb["text"].lower()
            ]
        
        # Format response
        formatted_feedbacks = [
            FeedbackResponse(
                id=fb["id"],
                vendor=fb["vendor"],
                product=fb["product"],
                rating=fb["rating"],
                text=fb["text"],
                date=fb["date"]
            )
            for fb in feedbacks
        ]
        
        return {
            "feedbacks": formatted_feedbacks,
            "total": len(formatted_feedbacks),
            "message": "Feedback retrieved successfully"
        }
        
    except Exception as e:
        logging.error(f"Error getting feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading feedback"
        )

@customer_router.get("/vendors")
async def get_customer_vendors(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get available vendors for customer feedback and orders"""
    try:
        # Mock vendors data - replace with actual database query
        vendors = [
            {
                "id": "USR-419",
                "user_id": "USR-419", 
                "name": "Madhav Kaushal",
                "username": "madhav",
                "email": "madhav23@gmail.com",
                "full_name": "Madhav Kaushal",
                "company": "Solar Solutions Pvt Ltd",
                "phone": "+91 9876543210",
                "rating": 4.5,
                "total_orders": 125,
                "specialization": "Solar Panels & Equipment"
            },
            {
                "id": "USR-520",
                "user_id": "USR-520",
                "name": "Rajesh Kumar", 
                "username": "rajesh_solar",
                "email": "rajesh@solartechindo.com",
                "full_name": "Rajesh Kumar",
                "company": "SolarTech India",
                "phone": "+91 8765432109",
                "rating": 4.2,
                "total_orders": 89,
                "specialization": "Installation & Maintenance"
            },
            {
                "id": "USR-621", 
                "user_id": "USR-621",
                "name": "Priya Sharma",
                "username": "priya_green",
                "email": "priya@greenenergy.co.in", 
                "full_name": "Priya Sharma",
                "company": "Green Energy Solutions",
                "phone": "+91 7654321098",
                "rating": 4.8,
                "total_orders": 156,
                "specialization": "Battery & Storage Systems"
            }
        ]
        
        return {
            "vendors": vendors,
            "total_vendors": len(vendors),
            "message": "Vendors retrieved successfully"
        }
        
    except Exception as e:
        logging.error(f"Error getting vendors: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading vendors"
        )

class ComplaintRequest(BaseModel):
    subject: str
    description: str
    vendor: Optional[str] = None
    product: Optional[str] = None
    priority: str = "medium"
    category: str = "support"

@customer_router.get("/complaints")
async def get_customer_complaints(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get customer complaints/support tickets"""
    try:
        # Mock complaints data - replace with actual database query
        complaints = [
            {
                "id": "COMP001",
                "ticket_number": "TKT-001",
                "subject": "Installation Issue",
                "title": "Installation Issue",
                "description": "The solar panels were not installed properly, causing efficiency issues.",
                "status": "open",
                "priority": "high",
                "category": "technical",
                "vendor": "Madhav Kaushal",
                "product": "Solar Panel 100W",
                "created_at": "2024-11-25T10:30:00",
                "date": "2024-11-25",
                "raised_by": {
                    "user_id": current_user.get("user_id", "customer"),
                    "full_name": current_user.get("full_name", "Customer"),
                    "role": "customer"
                },
                "assigned_to_vendor": "USR-419"
            },
            {
                "id": "COMP002",
                "ticket_number": "TKT-002",
                "subject": "Billing Discrepancy",
                "title": "Billing Discrepancy",
                "description": "There is an error in the billing calculation for my recent order.",
                "status": "in-progress",
                "priority": "medium",
                "category": "billing",
                "vendor": "Rajesh Kumar",
                "product": "Inverter 1KW",
                "created_at": "2024-11-20T14:45:00",
                "date": "2024-11-20",
                "raised_by": {
                    "user_id": current_user.get("user_id", "customer"),
                    "full_name": current_user.get("full_name", "Customer"),
                    "role": "customer"
                }
            },
            {
                "id": "COMP003",
                "ticket_number": "TKT-003",
                "subject": "Product Quality Issue",
                "title": "Product Quality Issue",
                "description": "The inverter delivered has some manufacturing defects.",
                "status": "resolved",
                "priority": "high",
                "category": "support",
                "vendor": "Priya Sharma",
                "product": "Battery System 100Ah",
                "created_at": "2024-11-15T09:15:00",
                "date": "2024-11-15",
                "raised_by": {
                    "user_id": current_user.get("user_id", "customer"),
                    "full_name": current_user.get("full_name", "Customer"),
                    "role": "customer"
                },
                "assigned_to_vendor": "USR-621"
            }
        ]
        
        # Apply filters
        filtered_complaints = complaints
        if status:
            filtered_complaints = [c for c in filtered_complaints if c["status"] == status]
        if priority:
            filtered_complaints = [c for c in filtered_complaints if c["priority"] == priority]
        
        # Pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_complaints = filtered_complaints[start_idx:end_idx]
        
        return {
            "complaints": paginated_complaints,
            "tickets": paginated_complaints,  # For compatibility with ticket system
            "total": len(filtered_complaints),
            "page": page,
            "limit": limit,
            "total_pages": (len(filtered_complaints) + limit - 1) // limit
        }
        
    except Exception as e:
        logging.error(f"Error getting customer complaints: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error loading complaints"
        )

@customer_router.post("/complaints")
async def create_customer_complaint(
    complaint_data: ComplaintRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create new customer complaint/support ticket"""
    try:
        # Generate complaint ID
        complaint_id = f"COMP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        ticket_number = f"TKT-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
        
        # Create complaint record - replace with actual database insert
        complaint = {
            "id": complaint_id,
            "ticket_number": ticket_number,
            "subject": complaint_data.subject,
            "title": complaint_data.subject,  # For compatibility
            "description": complaint_data.description,
            "status": "open",
            "priority": complaint_data.priority,
            "category": complaint_data.category,
            "vendor": complaint_data.vendor or "General",
            "product": complaint_data.product or "General",
            "raised_by": {
                "user_id": current_user.get("user_id", "customer"),
                "full_name": current_user.get("full_name", "Customer"),
                "role": "customer",
                "email": current_user.get("email", "")
            },
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        # Here you would save to your complaints/tickets collection:
        # from app.database import complaints_collection
        # result = complaints_collection().insert_one(complaint)
        
        return {
            "success": True,
            "message": "Complaint submitted successfully!",
            "complaint_id": complaint_id,
            "ticket_number": ticket_number,
            "complaint": complaint
        }
        
    except Exception as e:
        logging.error(f"Error creating customer complaint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating complaint"
        )