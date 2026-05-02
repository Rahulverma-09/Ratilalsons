from datetime import datetime
from typing import Dict, List, Optional, Any
from bson import ObjectId
from pymongo.collection import Collection
from app.database import roles_collection, users_collection
import logging

# Set up logging
logger = logging.getLogger(__name__)

def convert_objectid_to_string(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert all ObjectId fields in a document to strings for JSON serialization"""
    if not doc:
        return doc

    # Convert _id to id field
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]

    for key, value in doc.items():
        if isinstance(value, ObjectId):
            doc[key] = str(value)
        elif isinstance(value, list):
            doc[key] = [str(item) if isinstance(item, ObjectId) else item for item in value]
        elif isinstance(value, dict):
            doc[key] = convert_objectid_to_string(value)
    return doc

class UserRepository:
    def __init__(self):
        self.collection: Collection = users_collection()
        try:
            from app.database import safe_create_index
            safe_create_index(self.collection, [("username", 1)], unique=True, name="username_unique_idx")
            # Migrate email index to sparse so employees without email can coexist
            existing = {idx['name']: idx for idx in self.collection.list_indexes()}
            if 'email_unique_idx' in existing and not existing['email_unique_idx'].get('sparse', False):
                self.collection.drop_index('email_unique_idx')
                logger.info("Dropped non-sparse email_unique_idx for migration")
            safe_create_index(self.collection, [("email", 1)], unique=True, sparse=True, name="email_unique_idx")
        except Exception as e:
            logger.warning(f"Could not create indexes for users collection: {e}")

    def _generate_next_user_id(self):
        """Generate a new unique user_id like USR-001, USR-002, ..."""
        last_user = self.collection.find_one(
            {"user_id": {"$regex": "^USR-\\d{3,}$"}},
            sort=[("user_id", -1)]
        )
        if last_user and "user_id" in last_user:
            try:
                next_num = int(last_user["user_id"].split("-")[-1]) + 1
            except Exception:
                next_num = 1
        else:
            next_num = 1
        return f"USR-{str(next_num).zfill(3)}"

    def create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            user_data["created_at"] = datetime.now()
            user_data["updated_at"] = datetime.now()

            if "user_id" not in user_data or not user_data["user_id"]:
                user_data["user_id"] = self._generate_next_user_id()

            # --- FIX: Map role_ids to human-readable names for "roles" ---
            role_ids = user_data.get("role_ids", [])
            if isinstance(role_ids, str):
                role_ids = [role_ids]
            # fetch role names for the ids
            role_map = {r['id']: r['name'] for r in roles_collection.find({}, {'id': 1, 'name': 1})}
            user_data["roles"] = [role_map.get(rid, rid) for rid in role_ids]

            # Insert user
            result = self.collection.insert_one(user_data)
            if result.acknowledged:
                created_user = self.collection.find_one({"_id": result.inserted_id})
                if created_user:
                    return self.user_entity(created_user)
            return None
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error creating user: {str(e)}")
            return None

    def user_entity(self, user) -> Dict[str, Any]:
        user = convert_objectid_to_string(user)
        roles = user.get("roles", [])
        if isinstance(roles, str):
            roles = [roles] if roles else []
        elif not isinstance(roles, list):
            roles = []
        return {
            "id": user.get("id", str(user.get("_id", ""))),
            "user_id": user.get("user_id"),
            "username": user["username"],
            "email": user["email"],
            "full_name": user.get("full_name", ""),
            "phone": user.get("phone"),
            "department": user.get("department"),
            "roles": roles,  # This is a list of NAMES now
            "role_ids": user.get("role_ids", []),
            "is_active": user.get("is_active", True),
            "reporting_user_id": user.get("reporting_user_id"),
            "created_at": user.get("created_at", datetime.now()),
            "updated_at": user.get("updated_at")
        }

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            logger.info(f"Looking up user by user_id: {user_id}")
            user = self.collection.find_one({"user_id": user_id})
            if not user and ObjectId.is_valid(user_id):
                user = self.collection.find_one({"_id": ObjectId(user_id)})
            logger.info(f"get_user_by_id result: {user}")
            if user:
                user = convert_objectid_to_string(user)
                if "created_at" not in user:
                    user["created_at"] = datetime.now()
                if "updated_at" not in user:
                    user["updated_at"] = datetime.now()
            return user
        except Exception as e:
            print(f"Error in get_user_by_id: {e}")
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        try:
            user = self.collection.find_one({"username": username})
            if user:
                user = convert_objectid_to_string(user)
                return user
            return None
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error getting user by username {username}: {str(e)}")
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        user = self.collection.find_one({"email": email})
        if user:
            user = convert_objectid_to_string(user)
        return user

    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user information"""
        if not ObjectId.is_valid(user_id):
            return False
        # --- FIX: Map role_ids to names always on update ---
        role_ids = update_data.get("role_ids")
        if role_ids is not None:
            if isinstance(role_ids, str):
                role_ids = [role_ids]
            role_map = {r['id']: r['name'] for r in roles_collection.find({}, {'id': 1, 'name': 1})}
            update_data["roles"] = [role_map.get(rid, rid) for rid in role_ids]
        # "roles" fallback normalization (should never be ids now)
        if "roles" in update_data:
            if isinstance(update_data["roles"], str):
                update_data["roles"] = [update_data["roles"]]
            elif not isinstance(update_data["roles"], list):
                update_data["roles"] = []

        result = self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def update_last_login(self, user_id: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now()}}
        )
        return result.modified_count > 0

    def delete_user(self, user_id: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    def list_users(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        cursor = self.collection.find().skip(skip).limit(limit)
        users = []
        for user in cursor:
            user = convert_objectid_to_string(user)
            if "password" in user:
                del user["password"]
            users.append(user)
        return users

    def get_user_id_by_object_id(self, object_id: str) -> Optional[str]:
        if not ObjectId.is_valid(object_id):
            return None
        user = self.collection.find_one({"_id": ObjectId(object_id)})
        if user:
            return str(user.get("user_id") or user["_id"])
        return None

# Alias UserRepositorySync to UserRepository for compatibility
UserRepositorySync = UserRepository
