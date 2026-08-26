from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from bson import ObjectId
from pymongo.collection import Collection
from app.database.schemas.invoice_schema import InvoiceCreate, InvoiceStatusEnum

class InvoiceRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def create_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        invoice_data.update({
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "linked_tickets": invoice_data.get("linked_tickets", []),
        })
        result = self.collection.insert_one(invoice_data)
        invoice_data["id"] = str(result.inserted_id)
        # Remove the MongoDB _id to avoid confusion
        if "_id" in invoice_data:
            del invoice_data["_id"]
        return invoice_data

    def get_invoice(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        invoice = self.collection.find_one({"_id": ObjectId(invoice_id)})
        if invoice:
            invoice["id"] = str(invoice["_id"])
            del invoice["_id"]
            
            # Only auto-fill from customers collection for real Customer-type invoices
            ctype = invoice.get("customer_type", "Customer")
            if not invoice.get("customer_name") and invoice.get("customer_id") and ctype in (None, "Customer", "regular"):
                try:
                    from app.database import customers_collection
                    customer = customers_collection().find_one({"_id": ObjectId(invoice["customer_id"])})
                    if customer:
                        invoice["customer_name"] = customer.get("name", "N/A")
                        invoice["customer_email"] = customer.get("email")
                        invoice["customer_phone"] = customer.get("phone")
                        invoice["customer_address"] = customer.get("address")
                except Exception:
                    pass
        return invoice

    def update_invoice(self, invoice_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        update_data["updated_at"] = datetime.utcnow()
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(invoice_id)},
            {"$set": update_data},
            return_document=True
        )
        if result:
            result["id"] = str(result["_id"])
            del result["_id"]
        return result

    def mark_paid(self, invoice_id: str, paid_at: Optional[datetime] = None) -> bool:
        update_data = {"status": InvoiceStatusEnum.paid.value, "updated_at": datetime.utcnow()}
        if paid_at:
            update_data["paid_at"] = paid_at
        result = self.collection.update_one({"_id": ObjectId(invoice_id)}, {"$set": update_data})
        return result.modified_count > 0

    def delete_invoice(self, invoice_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(invoice_id)})
        return result.deleted_count > 0

    def list_invoices(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = {}

        if filters.get("customer_id"):
            query["customer_id"] = filters["customer_id"]

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

        invoices = []
        for invoice in cursor:
            invoice["id"] = str(invoice["_id"])
            del invoice["_id"]
            
            # If customer information is missing, try to fetch from customers collection
            if not invoice.get("customer_name") and invoice.get("customer_id") and invoice["customer_id"] != "dummy-customer-id":
                try:
                    from app.database import customers_collection
                    from bson import ObjectId
                    customer = customers_collection().find_one({"_id": ObjectId(invoice["customer_id"])})
                    if customer:
                        invoice["customer_name"] = customer.get("name", "N/A")
                        invoice["customer_email"] = customer.get("email")
                        invoice["customer_phone"] = customer.get("phone")
                        invoice["customer_address"] = customer.get("address")
                except Exception:
                    pass
            
            invoices.append(invoice)

        return invoices, total

    def add_linked_ticket(self, invoice_id: str, ticket_id: str) -> bool:
        result = self.collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$addToSet": {"linked_tickets": ticket_id}}
        )
        return result.modified_count > 0
