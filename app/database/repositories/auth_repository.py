from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from pymongo.collection import Collection

from app.database import users_collection, roles_collection


class AuthRepository:
    def __init__(self):
        self.users_collection: Collection = users_collection
        self.roles_collection: Collection = roles_collection
    
    def create_user(self, user_data: Dict[str, Any]) -> str:
        user_data["created_at"] = datetime.now()
        result = self.users_collection.insert_one(user_data)
        return str(result.inserted_id)
    
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        user = self.users_collection.find_one({"username": username})
        return user
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        user = self.users_collection.find_one({"email": email})
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(user_id):
            return None
        user = self.users_collection.find_one({"_id": ObjectId(user_id)})
        return user
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = self.users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    def update_last_login(self, user_id: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = self.users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now()}}
        )
        return result.modified_count > 0
    
    def get_roles_by_ids(self, role_ids: List[str]) -> List[Dict[str, Any]]:
        object_ids = [ObjectId(role_id) for role_id in role_ids if ObjectId.is_valid(role_id)]
        roles = list(self.roles_collection.find({"_id": {"$in": object_ids}}))
        return roles
    
    def get_role_by_name(self, role_name: str) -> Optional[Dict[str, Any]]:
        role = self.roles_collection.find_one({"name": role_name})
        return role