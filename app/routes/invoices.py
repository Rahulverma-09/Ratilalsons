# app/routers/invoices.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, date
from app.database.schemas.invoice_schema import (
    InvoiceCreate, InvoiceUpdate, InvoiceModel, InvoiceFilter, InvoiceStatusEnum
)
from app.database.repositories.invoice_repoistory import InvoiceRepository
from app.dependencies import get_invoice_repo, accounts_required, get_current_user
from app.database import customers_collection
from pydantic import BaseModel

invoice_router = APIRouter(prefix="/api/invoices", tags=["Invoices & Billing"])

@invoice_router.get("/stats", response_model=dict)
async def invoice_stats(
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Billing dashboard statistics"""
    try:
        # Get status counts
        pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        status_results = list(repo.collection.aggregate(pipeline))
        status_stats = {result["_id"]: result["count"] for result in status_results}
        
        # Get overdue count
        overdue_count = repo.collection.count_documents({
            "status": {"$in": ["sent", "partial"]},
            "due_date": {"$lt": datetime.utcnow()}
        })
        
        # Get total paid amount
        paid_pipeline = [
            {"$match": {"status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        paid_results = list(repo.collection.aggregate(paid_pipeline))
        total_paid = paid_results[0]["total"] if paid_results else 0
        
        return {
            "total_draft": status_stats.get("draft", 0),
            "total_overdue": overdue_count,
            "total_unpaid": status_stats.get("sent", 0) + status_stats.get("partial", 0),
            "total_paid": total_paid
        }
    except Exception as e:
        # Return empty stats if there's an error or no invoices exist
        return {
            "total_draft": 0,
            "total_overdue": 0,
            "total_unpaid": 0,
            "total_paid": 0
        }

@invoice_router.get("/statistics", response_model=dict)
async def invoice_statistics(
    period: Optional[str] = Query("monthly", description="monthly or yearly"),
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(get_current_user)
):
    """Invoice statistics for dashboard"""
    try:
        # Get current month and previous month revenue
        current_date = datetime.now()
        current_month_start = current_date.replace(day=1)
        
        if current_date.month == 1:
            prev_month = current_date.replace(year=current_date.year - 1, month=12, day=1)
        else:
            prev_month = current_date.replace(month=current_date.month - 1, day=1)
        
        # Get next month first day to calculate current month end
        if current_date.month == 12:
            next_month = current_date.replace(year=current_date.year + 1, month=1, day=1)
        else:
            next_month = current_date.replace(month=current_date.month + 1, day=1)
        
        # Calculate current month revenue
        current_month_pipeline = [
            {
                "$match": {
                    "status": "paid",
                    "paid_at": {
                        "$gte": current_month_start,
                        "$lt": next_month
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$total_amount"}
                }
            }
        ]
        
        current_month_result = list(repo.collection.aggregate(current_month_pipeline))
        current_month_revenue = current_month_result[0]["total"] if current_month_result else 0
        
        # Calculate previous month revenue  
        prev_month_pipeline = [
            {
                "$match": {
                    "status": "paid",
                    "paid_at": {
                        "$gte": prev_month,
                        "$lt": current_month_start
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$total_amount"}
                }
            }
        ]
        
        prev_month_result = list(repo.collection.aggregate(prev_month_pipeline))
        prev_month_revenue = prev_month_result[0]["total"] if prev_month_result else 0
        
        # Get daily revenue trend for current month
        daily_pipeline = [
            {
                "$match": {
                    "status": "paid",
                    "paid_at": {
                        "$gte": current_month_start,
                        "$lt": next_month
                    }
                }
            },
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$paid_at"}},
                    "amount": {"$sum": "$total_amount"},
                    "orders_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        daily_result = list(repo.collection.aggregate(daily_pipeline))
        daily_trend = [{"date": item["_id"], "amount": item["amount"], "orders_count": item["orders_count"]} for item in daily_result]
        
        return {
            "success": True,
            "current_month_revenue": current_month_revenue,
            "previous_month_revenue": prev_month_revenue,
            "period": period,
            "daily_trend": daily_trend
        }
        
    except Exception as e:
        return {
            "success": True,
            "current_month_revenue": 0,
            "previous_month_revenue": 0,
            "period": period,
            "daily_trend": []
        }

@invoice_router.post("/", response_model=InvoiceModel, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice_data: InvoiceCreate,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Create new invoice (Accounts team only)"""
    # Auto-generate invoice_number
    from app.database import get_next_sequence, get_database
    db = get_database()
    invoice_number = f"INV-{get_next_sequence(db, 'invoice_number'):06d}"
    
    invoice_dict = invoice_data.dict()
    invoice_dict["invoice_number"] = invoice_number
    
    # If customer_id is provided and it's a real Customer type, try to fill details from DB
    cid = invoice_dict.get("customer_id")
    ctype = invoice_dict.get("customer_type", "Customer")
    if cid and ctype in (None, "Customer", "regular"):
        try:
            from bson import ObjectId
            customer = customers_collection().find_one({"_id": ObjectId(cid)})
            if customer:
                invoice_dict["customer_name"] = customer.get("name", invoice_dict.get("customer_name"))
                invoice_dict["customer_email"] = customer.get("email", invoice_dict.get("customer_email"))
                invoice_dict["customer_phone"] = customer.get("phone", invoice_dict.get("customer_phone"))
                invoice_dict["customer_address"] = customer.get("address", invoice_dict.get("customer_address"))
        except Exception:
            pass
    
    invoice = repo.create_invoice(invoice_dict)
    return invoice

@invoice_router.get("/{invoice_id}", response_model=InvoiceModel)
async def get_invoice(
    invoice_id: str,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Get single invoice details"""
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@invoice_router.put("/{invoice_id}", response_model=InvoiceModel)
async def update_invoice(
    invoice_id: str,
    update_data: InvoiceUpdate,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Update invoice status, notes, items"""
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check if invoice is locked (paid invoices cannot be edited)
    if invoice.get("is_locked") or invoice.get("status") == "paid":
        raise HTTPException(
            status_code=400, 
            detail="Cannot edit locked or paid invoice"
        )
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    updated_invoice = repo.update_invoice(invoice_id, update_dict)
    return updated_invoice

@invoice_router.post("/{invoice_id}/send", status_code=status.HTTP_200_OK)
async def send_invoice(
    invoice_id: str,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Send invoice to customer"""
    # Check if invoice exists
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check if invoice can be sent (not already paid or locked)
    if invoice["status"] in ["paid", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot send paid or cancelled invoice")
    
    # Update status to sent
    update_data = {
        "status": "sent",
        "sent_at": datetime.utcnow(),
        "sent_by": current_user.get("user_id")
    }
    
    # TODO: Implement actual email sending logic here
    # This could integrate with your email service
    
    success = repo.update_invoice(invoice_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update invoice status")
    
    return {"message": "Invoice sent successfully"}

@invoice_router.post("/{invoice_id}/mark-paid", status_code=status.HTTP_200_OK)
async def mark_invoice_paid(
    invoice_id: str,
    paid_at: Optional[datetime] = None,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Mark invoice as paid"""
    # Check if invoice exists
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Update to include locking
    update_data = {
        "status": "paid",
        "paid_at": paid_at or datetime.utcnow(),
        "marked_paid_by": current_user.get("user_id"),
        "is_locked": True  # Lock invoice once paid
    }
    
    success = repo.update_invoice(invoice_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice marked as paid and locked"}

@invoice_router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: str,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Delete invoice (irreversible)"""
    success = repo.delete_invoice(invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return None

@invoice_router.get("/", response_model=dict)
async def list_invoices(
    customer_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """List invoices with filters (Accounts dashboard)"""
    skip = (page - 1) * limit
    filters = {
        "customer_id": customer_id,
        "status": [status] if status and status.strip() else None,
    }
    if overdue:
        from datetime import datetime, timedelta
        overdue_date = datetime.utcnow() - timedelta(days=30)
        filters["due_date"] = {"$lt": overdue_date}
        filters["status"] = {"$in": ["sent", "partial"]}
    
    invoices, total = repo.list_invoices(filters, skip=skip, limit=limit)
    return {
        "invoices": invoices,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

# CUSTOMER-FACING ENDPOINTS (Public access)

class CustomerPaymentData(BaseModel):
    payment_method: str
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None

@invoice_router.get("/customer/{customer_id}/invoices", response_model=dict)
async def customer_view_invoices(
    customer_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    repo: InvoiceRepository = Depends(get_invoice_repo)
):
    """Customer view of their invoices (no auth required)"""
    skip = (page - 1) * limit
    filters = {"customer_id": customer_id}
    
    invoices, total = repo.list_invoices(filters, skip=skip, limit=limit)
    
    # Filter out sensitive admin information
    customer_invoices = []
    for invoice in invoices:
        customer_invoice = {
            "id": invoice["id"],
            "invoice_number": invoice["invoice_number"],
            "total_amount": invoice["total_amount"],
            "due_date": invoice["due_date"],
            "status": invoice["status"],
            "items": invoice["items"],
            "notes": invoice.get("notes"),
            "created_at": invoice["created_at"]
        }
        customer_invoices.append(customer_invoice)
    
    return {
        "invoices": customer_invoices,
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": skip + limit < total
    }

@invoice_router.get("/customer/invoice/{invoice_id}", response_model=dict)
async def customer_view_single_invoice(
    invoice_id: str,
    repo: InvoiceRepository = Depends(get_invoice_repo)
):
    """Customer view of single invoice (no auth required)"""
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Return filtered invoice data for customer
    return {
        "id": invoice["id"],
        "invoice_number": invoice["invoice_number"],
        "total_amount": invoice["total_amount"],
        "subtotal": invoice["subtotal"],
        "tax_amount": invoice["tax_amount"],
        "due_date": invoice["due_date"],
        "status": invoice["status"],
        "items": invoice["items"],
        "notes": invoice.get("notes"),
        "created_at": invoice["created_at"],
        "customer_name": invoice.get("customer_name"),
        "customer_email": invoice.get("customer_email")
    }

@invoice_router.post("/customer/invoice/{invoice_id}/payment", status_code=status.HTTP_200_OK)
async def customer_record_payment(
    invoice_id: str,
    payment_data: CustomerPaymentData,
    repo: InvoiceRepository = Depends(get_invoice_repo)
):
    """Customer records payment for invoice"""
    invoice = repo.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice["status"] in ["paid", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invoice is already paid or cancelled")
    
    # Update invoice with customer payment info
    update_data = {
        "status": "paid",
        "paid_at": datetime.utcnow(),
        "customer_payment_method": payment_data.payment_method,
        "customer_payment_reference": payment_data.payment_reference,
        "customer_payment_notes": payment_data.payment_notes,
        "is_locked": True  # Lock invoice once customer pays
    }
    
    success = repo.update_invoice(invoice_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to record payment")
    
    return {"message": "Payment recorded successfully"}


@invoice_router.get("/{invoice_id}/download")
async def download_invoice_pdf(
    invoice_id: str,
    repo: InvoiceRepository = Depends(get_invoice_repo),
    current_user: dict = Depends(accounts_required)
):
    """Download invoice PDF"""
    try:
        from fastapi.responses import Response
        import io
        import os
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import Table, TableStyle
        
        # Get invoice details
        invoice = repo.get_invoice(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Ensure customer data is present (Final Fallback)
        if not invoice.get('customer_name') and invoice.get('customer_id'):
            try:
                from app.database import customers_collection
                from bson import ObjectId
                cust = customers_collection().find_one({"_id": ObjectId(invoice['customer_id'])})
                if cust:
                    invoice['customer_name'] = cust.get('name')
                    invoice['customer_email'] = cust.get('email')
                    invoice['customer_phone'] = cust.get('phone')
                    invoice['customer_address'] = cust.get('address')
            except:
                pass
        
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
        p.drawString(130, height - 210, str(invoice.get('invoice_number', invoice_id)))

        # Helper function to format date as DD-MM-YYYY
        def format_date_ddmmyyyy(date_value):
            if not date_value:
                return 'N/A'
            if isinstance(date_value, str):
                try:
                    date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                except:
                    return date_value[:10]
            elif isinstance(date_value, datetime):
                date_obj = date_value
            else:
                return 'N/A'
            return date_obj.strftime('%d-%m-%Y')

        p.setFont("Helvetica-Bold", 10)
        p.drawString(40, height - 230, "Date:")
        p.setFont("Helvetica", 10)
        p.drawString(130, height - 230, format_date_ddmmyyyy(invoice.get('issue_date', datetime.now())))
        
        p.setFont("Helvetica-Bold", 10)
        p.drawString(40, height - 250, "Due Date:")
        p.setFont("Helvetica", 10)
        p.drawString(130, height - 250, format_date_ddmmyyyy(invoice.get('due_date')))

        # Layout Column 2: Billed To (Very Distinct)
        p.setFillColor(colors.HexColor("#f8fafc"))
        p.rect(width/2 - 20, height - 260, width/2 - 20, 95, fill=True, stroke=False)
        p.setFillColor(colors.black)
        
        p.setFont("Helvetica-Bold", 11)
        p.drawString(width / 2, height - 180, "BILL TO:")
        p.setFont("Helvetica-Bold", 11)
        p.drawString(width / 2, height - 200, str(invoice.get('customer_name', 'N/A')))
        
        p.setFont("Helvetica", 10)
        p.setFillColor(colors.HexColor("#475569"))
        p.drawString(width / 2, height - 215, str(invoice.get('customer_email', '')))
        p.drawString(width / 2, height - 230, str(invoice.get('customer_phone', '')))
        if invoice.get('customer_address'):
            p.drawString(width / 2, height - 245, str(invoice.get('customer_address', ''))[:50])

        p.setFillColor(colors.black)

        # Determine if pricing should be shown
        show_pricing = invoice.get('show_pricing', True)  # Default to True for backward compatibility
        customer_type = invoice.get('customer_type', 'Customer')
        
        # Table Items - conditional pricing display
        y_position = height - 290
        
        if show_pricing:
            # Full table with pricing for Customer invoices
            data = [["#", "Item Description", "Qty", "Unit Price", "Total"]]
            items = invoice.get('items', [])
            
            for i, item in enumerate(items):
                desc = str(item.get('description', 'N/A'))
                qty = str(item.get('quantity', 1))
                price = f"Rs.{item.get('unit_price', 0):,.2f}"
                total = f"Rs.{(item.get('quantity', 1) * item.get('unit_price', 0)):,.2f}"
                data.append([str(i+1), desc, qty, price, total])

            table = Table(data, colWidths=[30, 260, 50, 80, 95])
        else:
            # Simple table without pricing for Staff/Site/Contractor
            data = [["#", "Item Description", "Quantity"]]
            items = invoice.get('items', [])
            
            for i, item in enumerate(items):
                desc = str(item.get('description', 'N/A'))
                qty = str(item.get('quantity', 1))
                data.append([str(i+1), desc, qty])

            table = Table(data, colWidths=[30, 380, 105])
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
        
        if len(data) > 20: 
            # If too many items, let's just draw what we can
            pass
            
        table.drawOn(p, 40, y_position - h)

        # Totals - only show for Customer invoices with pricing
        if show_pricing:
            totals_y = y_position - h - 30
            
            p.setFont("Helvetica-Bold", 10)
            p.drawRightString(width - 140, totals_y, "Subtotal:")
            p.setFont("Helvetica", 10)
            p.drawRightString(width - 40, totals_y, f"Rs.{invoice.get('subtotal', 0):,.2f}")
            
            totals_y -= 25
            p.setFont("Helvetica-Bold", 10)
            p.drawRightString(width - 140, totals_y, f"Tax ({invoice.get('tax_rate', 18)}%):")
            p.setFont("Helvetica", 10)
            p.drawRightString(width - 40, totals_y, f"Rs.{invoice.get('tax_amount', 0):,.2f}")
            
            totals_y -= 30
            p.setFillColor(colors.HexColor("#f0fdf4")) # Soft green
            p.rect(width - 200, totals_y - 12, 160, 30, fill=True, stroke=False)
            p.setFillColor(colors.black)
            p.setFont("Helvetica-Bold", 12)
            p.drawRightString(width - 140, totals_y - 2, "Total:")
            p.setFillColor(colors.HexColor("#0f766e")) # Teal
            p.setFont("Helvetica-Bold", 14)
            p.drawRightString(width - 40, totals_y - 4, f"Rs.{invoice.get('total_amount', 0):,.2f}")
        else:
            # For non-Customer invoices, show a note instead of totals
            totals_y = y_position - h - 30
            p.setFont("Helvetica-Oblique", 10)
            p.setFillColor(colors.HexColor("#64748b"))
            p.drawString(40, totals_y, f"Item list for {customer_type} - No pricing details")
            p.setFillColor(colors.black)

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
        raise HTTPException(
            status_code=500,
            detail=f"Error generating PDF: {str(e)}"
        )
