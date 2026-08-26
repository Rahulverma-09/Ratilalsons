from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from bson import ObjectId
from pymongo.collection import Collection
from app.database.schemas.ticket_schema import TicketCreate, StatusEnum, PriorityEnum

class TicketRepository:
    def __init__(self, collection: Collection):
        self.collection = collection

    def create_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        ticket_data.update({
            "status": StatusEnum.open.value,
            "priority": ticket_data.get("priority", PriorityEnum.medium.value),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "total_comments": 0,
            "days_open": 0,
            "linked_documents": ticket_data.get("linked_documents", []),
            "linked_invoices": ticket_data.get("linked_invoices", []),
        })
        result = self.collection.insert_one(ticket_data)
        # Convert _id to id for response model compatibility
        ticket_data["id"] = str(result.inserted_id)
        if "_id" in ticket_data:
            del ticket_data["_id"]
        return ticket_data

    def get_ticket_by_id(self, ticket_id: str) -> Optional[Dict[str, Any]]:
        ticket = self.collection.find_one({"_id": ObjectId(ticket_id)})
        if ticket:
            ticket["id"] = str(ticket["_id"])
            del ticket["_id"]
        return ticket

    def update_ticket(self, ticket_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        update_data["updated_at"] = datetime.utcnow()
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data},
            return_document=True
        )
        if result:
            result["id"] = str(result["_id"])
            del result["_id"]
        return result

    def delete_ticket(self, ticket_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(ticket_id)})
        return result.deleted_count > 0

    def list_tickets(
        self,
        filters: Dict[str, Any],
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = {}

        # Filtering by status
        if filters.get("status"):
            query["status"] = {"$in": filters["status"]}

        # Filtering by priority
        if filters.get("priority"):
            query["priority"] = {"$in": filters["priority"]}

        # Filtering by raised_by user ID
        if filters.get("raised_by"):
            query["raised_by.user_id"] = filters["raised_by"]

        # Filtering by assigned_to_vendor
        if filters.get("assigned_to_vendor"):
            query["assigned_to_vendor"] = filters["assigned_to_vendor"]

        # Text search on title/description/ticket_number
        if filters.get("search"):
            search_regex = {"$regex": filters["search"], "$options": "i"}
            query["$or"] = [
                {"title": search_regex},
                {"description": search_regex},
                {"ticket_number": search_regex}
            ]

        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", -1)

        tickets = []
        for ticket in cursor:
            ticket["id"] = str(ticket["_id"])
            del ticket["_id"]
            tickets.append(ticket)

        return tickets, total

    def add_response(self, ticket_id: str, response_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Add a response to ticket's resolution log"""
        response_entry = {
            "timestamp": datetime.utcnow(),
            "author_id": response_data.get("author_id"),
            "author_role": response_data.get("author_role"),
            "message": response_data.get("message"),
            "internal": response_data.get("internal", False)
        }
        
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"resolution_log": response_entry},
                "$inc": {"total_comments": 1},
                "$set": {"updated_at": datetime.utcnow()}
            },
            return_document=True
        )
        
        if result:
            result["id"] = str(result["_id"])
            del result["_id"]
        return result

    def update_status(self, ticket_id: str, new_status: str, changed_by: str) -> Optional[Dict[str, Any]]:
        """Update ticket status and add to history"""
        status_entry = {
            "status": new_status,
            "changed_by": changed_by,
            "timestamp": datetime.utcnow()
        }
        
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {"status": new_status, "updated_at": datetime.utcnow()},
                "$push": {"status_history": status_entry}
            },
            return_document=True
        )
        
        if result:
            result["id"] = str(result["_id"])
            del result["_id"]
        return result
