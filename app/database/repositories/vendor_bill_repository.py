from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from bson import ObjectId
from pymongo.collection import Collection
from app.database.schemas.vendor_bill_schema import VendorBillStatusEnum

class VendorBillRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def _populate_vendor_info(self, bill: Dict[str, Any]) -> Dict[str, Any]:
        """Helper method to populate vendor information from vendor profiles"""
        if bill.get("vendor_id") and bill["vendor_id"] != "dummy-vendor-id":
            try:
                from app.database import get_database
                db = get_database()
                vendors_collection = db["vendors"]
                
                # Try by custom vendor ID first (VND-001 format)
                vendor = vendors_collection.find_one({"id": bill["vendor_id"]})
                
                # If not found, try by ObjectId
                if not vendor:
                    try:
                        vendor = vendors_collection.find_one({"_id": ObjectId(bill["vendor_id"])})
                    except:
                        pass
                
                if vendor:
                    bill["vendor_name"] = vendor.get("name", bill.get("vendor_name", "N/A"))
                    bill["vendor_email"] = vendor.get("email", bill.get("vendor_email"))
                    bill["vendor_phone"] = vendor.get("phone", bill.get("vendor_phone"))
                    bill["vendor_address"] = vendor.get("address", bill.get("vendor_address"))
                    bill["vendor_company"] = vendor.get("company", bill.get("vendor_company"))
            except Exception:
                pass
        return bill

    def create_bill(self, bill_data: Dict[str, Any], uploaded_by: str = None) -> Dict[str, Any]:
        """Create new vendor bill (usually by vendor upload)"""
        bill_data.update({
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "uploaded_by": uploaded_by,
            "status": VendorBillStatusEnum.uploaded.value
        })
        result = self.collection.insert_one(bill_data)
        bill_data["id"] = str(result.inserted_id)
        if "_id" in bill_data:
            del bill_data["_id"]
        return bill_data

    def get_bill(self, bill_id: str) -> Optional[Dict[str, Any]]:
        """Get single vendor bill"""
        bill = self.collection.find_one({"_id": ObjectId(bill_id)})
        if bill:
            bill["id"] = str(bill["_id"])
            del bill["_id"]
            
            # Always populate vendor information from vendor profiles
            if bill.get("vendor_id"):
                bill = self._populate_vendor_info(bill)
        return bill

    def update_bill(self, bill_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update vendor bill"""
        update_data["updated_at"] = datetime.utcnow()
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(bill_id)},
            {"$set": update_data},
            return_document=True
        )
        if result:
            result["id"] = str(result["_id"])
            del result["_id"]
        return result

    def approve_bill(self, bill_id: str, approved_by: str, approval_data: Dict[str, Any]) -> bool:
        """Approve vendor bill"""
        update_data = {
            "status": VendorBillStatusEnum.approved.value,
            "approved_by": approved_by,
            "approved_at": datetime.utcnow(),
            "reviewed_by": approved_by,
            "updated_at": datetime.utcnow()
        }
        
        if approval_data.get("approval_notes"):
            update_data["approval_notes"] = approval_data["approval_notes"]
        if approval_data.get("payment_due_date"):
            update_data["payment_due_date"] = approval_data["payment_due_date"]
            
        result = self.collection.update_one(
            {"_id": ObjectId(bill_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0

    def reject_bill(self, bill_id: str, reviewed_by: str, rejection_reason: str) -> bool:
        """Reject vendor bill"""
        update_data = {
            "status": VendorBillStatusEnum.rejected.value,
            "reviewed_by": reviewed_by,
            "rejection_reason": rejection_reason,
            "updated_at": datetime.utcnow()
        }
        result = self.collection.update_one(
            {"_id": ObjectId(bill_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0

    def record_payment(self, bill_id: str, paid_by: str, payment_data: Dict[str, Any]) -> bool:
        """Record payment for vendor bill"""
        update_data = {
            "status": VendorBillStatusEnum.paid.value,
            "paid_by": paid_by,
            "paid_at": payment_data.get("payment_date", datetime.utcnow()),
            "payment_amount": payment_data["payment_amount"],
            "payment_method": payment_data["payment_method"],
            "updated_at": datetime.utcnow()
        }
        
        if payment_data.get("payment_reference"):
            update_data["payment_reference"] = payment_data["payment_reference"]
        if payment_data.get("payment_notes"):
            update_data["payment_notes"] = payment_data["payment_notes"]
            
        result = self.collection.update_one(
            {"_id": ObjectId(bill_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0

    def set_under_review(self, bill_id: str, reviewed_by: str) -> bool:
        """Mark bill as under review"""
        update_data = {
            "status": VendorBillStatusEnum.under_review.value,
            "reviewed_by": reviewed_by,
            "updated_at": datetime.utcnow()
        }
        result = self.collection.update_one(
            {"_id": ObjectId(bill_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0

    def delete_bill(self, bill_id: str) -> bool:
        """Delete vendor bill"""
        result = self.collection.delete_one({"_id": ObjectId(bill_id)})
        return result.deleted_count > 0

    def list_bills(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List vendor bills with filters"""
        query = {}

        if filters.get("vendor_id"):
            query["vendor_id"] = filters["vendor_id"]

        if filters.get("status"):
            query["status"] = {"$in": filters["status"]}

        if filters.get("date_from") or filters.get("date_to"):
            date_query = {}
            if filters.get("date_from"):
                date_query["$gte"] = filters["date_from"]
            if filters.get("date_to"):
                date_query["$lte"] = filters["date_to"]
            query["due_date"] = date_query

        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", -1)

        bills = []
        for bill in cursor:
            bill["id"] = str(bill["_id"])
            del bill["_id"]
            
            # Populate vendor information using helper
            bill = self._populate_vendor_info(bill)
            bills.append(bill)

        return bills, total

    def get_bills_for_vendor(self, vendor_id: str, skip: int = 0, limit: int = 20) -> Tuple[List[Dict[str, Any]], int]:
        """Get bills for specific vendor"""
        query = {"vendor_id": vendor_id}
        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
        
        bills = []
        for bill in cursor:
            bill["id"] = str(bill["_id"])
            del bill["_id"]
            bills.append(bill)
        
        return bills, total

    def get_stats(self) -> Dict[str, Any]:
        """Get vendor bills statistics"""
        # Get status counts
        pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        status_results = list(self.collection.aggregate(pipeline))
        status_stats = {result["_id"]: result["count"] for result in status_results}
        
        # Get pending payment amount
        pending_pipeline = [
            {"$match": {"status": {"$in": ["approved"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        pending_results = list(self.collection.aggregate(pending_pipeline))
        pending_amount = pending_results[0]["total"] if pending_results else 0
        
        # Get total paid amount
        paid_pipeline = [
            {"$match": {"status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$payment_amount"}}}
        ]
        paid_results = list(self.collection.aggregate(paid_pipeline))
        total_paid = paid_results[0]["total"] if paid_results else 0
        
        return {
            "total_bills": sum(status_stats.values()),
            "uploaded": status_stats.get("uploaded", 0),
            "under_review": status_stats.get("under_review", 0),
            "approved": status_stats.get("approved", 0),
            "paid": status_stats.get("paid", 0),
            "rejected": status_stats.get("rejected", 0),
            "pending_payment_amount": pending_amount,
            "total_paid_amount": total_paid
        }