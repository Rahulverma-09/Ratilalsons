import os
import logging
from pymongo import MongoClient, IndexModel, ASCENDING, DESCENDING, ReturnDocument
from pymongo.database import Database
from pymongo.errors import ServerSelectionTimeoutError, OperationFailure
from bson import ObjectId
from datetime import datetime
from typing import Dict, Any, Optional, List

from dotenv import load_dotenv
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection settings
MONGO_URI = os.getenv("DATABASE_URL", "mongodb+srv://errahulverma:NBscZYSOYG1P07qZ@vmax-cluster09.tqrpt4d.mongodb.net/")
DB_NAME = os.getenv("DB_NAME", "test_crm_db")
_client = None  # Global MongoDB client

CURRENT_TIMESTAMP = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Always current time

def get_database():
    """Get MongoDB database connection with connection pooling"""
    global _client
    if _client is None:
        try:
            logger.info(f"Connecting to MongoDB at {MONGO_URI}")
            _client = MongoClient(MONGO_URI)
            _client.admin.command('ping')
            logger.info("MongoDB connection successful")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {str(e)}", exc_info=True)
            raise
    return _client[DB_NAME]

client = MongoClient(MONGO_URI)
db: Database = client[DB_NAME]

# ✅ ADDED: NEW COLLECTION FUNCTIONS FOR TICKETS + INVOICES MODULE
def tickets_collection():
    """Tickets collection for Support module"""
    return db.tickets

def invoices_collection():
    """Invoices collection for Billing module"""
    return db.invoices

def vendors_collection():
    """Vendors collection for Vendor Management"""
    return db.vendors

def vendor_orders_collection():
    """Vendor Orders collection for Vendor Management"""
    return db.vendor_orders

def vendor_transactions_collection():
    """Vendor Transactions collection for Vendor Management"""
    return db.vendor_transactions

def vendor_notes_collection():
    """Vendor Notes collection for Vendor Management"""
    return db.vendor_notes

def vendor_activity_logs_collection():
    """Vendor Activity Logs collection for Vendor Management"""
    return db.vendor_activity_logs

# Collection references (YOUR ORIGINAL CODE - UNCHANGED)
def alerts_inactivity_collection():
    return db.alerts_inactivity
def alerts_anomaly_collection():
    return db.alerts_anomaly
def generators_collection():
    return db.generators
def vehicles_collection():
    return db.vehicles
def generator_usage_collection():
    return db.generator_usage
def electricity_readings_collection():
    return db.electricity_readings
def maintenance_logs_collection():
    return db.maintenance_logs
def sites_collection():
    return db.sites 
def users_collection():
    return db.users
roles_collection = db.roles
permissions_collection = db.permissions
access_logs_collection = db.access_logs
def franchises_collection():
    return db.franchises
def orders_collection(): 
    return db.orders
activities_collection = db.activities
feedbacks_collection = db.feedbacks
logs_collection = db.comm_logs
transactions_collection = db.transactions
employees_collection = db.employees
notes_collection = db.notes
loyalty_collection = db.loyalty
complaints_collection = db.complaints
def attendance_collection():
    return db.attendance
def daily_reports_collection():
    return db.daily_reports
def leave_requests_collection():
    return db.leave_requests
def products_collection():
    return db.products
def stock_collection():
    return db.stock
def stock_logs_collection():
    return db.stock_logs
def payments_collection():
    return db.payments
def expenses_collection():
    return db.expenses
def tasks_collection():
    return db.tasks
def notes_collection():
    return db.notes
def customers_collection():
    return db.customers
def feedbacks_collection():
    return db.feedbacks
def transactions_collection():
    return db.transactions
def loyalty_collection():
    return db.loyalty
def complaints_collection():
    return db.complaints
def activity_logs_collection():
    return db.activity_logs
def document_collection():
    return db.documents

# YOUR ORIGINAL FUNCTIONS - UNCHANGED
def find_user_by_id_or_user_id(identifier: str):
    """
    Find a user by either MongoDB _id (ObjectId) or business user_id.
    """
    try:
        collection = users_collection()
        try:
            object_id = ObjectId(identifier)
            user = collection.find_one({"_id": object_id})
            if user:
                return user
        except Exception:
            pass
        user = collection.find_one({"user_id": identifier})
        if user:
            return user
        user = collection.find_one({"id": identifier})
        if user:
            return user
        return None
    except Exception as e:
        logger.error(f"Error finding user by identifier {identifier}: {str(e)}")
        return None

def get_next_role_id(db):
    """Get next incremental role ID like Ro-001."""
    next_seq = db.counters.find_one_and_update(
        {"_id": "role_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )["seq"]
    return f"Ro-{str(next_seq).zfill(3)}"

def get_next_sequence(db, name):
    counter = db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return counter["seq"]

def safe_create_index(collection, keys, **kwargs):
    """Safely create an index, handling existing indexes."""
    try:
        existing_indexes = collection.list_indexes()
        index_names = [idx['name'] for idx in existing_indexes]
        if 'name' not in kwargs:
            key_str = '_'.join(f"{k}_{v}" for k, v in keys)
            if 'sparse' in kwargs and kwargs['sparse']:
                key_str += '_sparse'
            if 'unique' in kwargs and kwargs['unique']:
                key_str += '_unique'
            kwargs['name'] = key_str
        if kwargs['name'] in index_names:
            logger.info(f"Index {kwargs['name']} already exists on {collection.name}")
            return True
        collection.create_index(keys, **kwargs)
        logger.info(f"Created index {kwargs.get('name', 'unnamed')} on {collection.name}")
        return True
    except OperationFailure as e:
        if "already exists" in str(e) or "same name" in str(e) or "IndexOptionsConflict" in str(e):
            logger.warning(f"Index on {collection.name} already exists with different options: {e}")
            return False
        else:
            logger.error(f"Failed to create index on {collection.name}: {e}")
            return False

def initialize_db():
    """Initialize database connection and setup, seed all key roles."""
    try:
        client.server_info()
        logger.info(f"Connected to MongoDB: {MONGO_URI}")
        create_indexes()
        initialize_default_data()
        logger.info(f"[{CURRENT_TIMESTAMP}] Database initialized successfully")
        return True
    except ServerSelectionTimeoutError:
        logger.error(f"Failed to connect to MongoDB: {MONGO_URI}")
        raise

# ✅ UPDATED: Added TICKETS + INVOICES INDEXES (Your original + new)
def create_indexes():
    """Create necessary database indexes safely."""
    logger.info("Creating database indexes")
    safe_create_index(users_collection(), [("username", ASCENDING)], unique=True)

    # Migrate email index to sparse so multiple employees without email can coexist
    try:
        users_col = users_collection()
        existing_indexes = {idx['name']: idx for idx in users_col.list_indexes()}
        old_name = 'email_1_unique'
        if old_name in existing_indexes and not existing_indexes[old_name].get('sparse', False):
            users_col.drop_index(old_name)
            logger.info("Dropped non-sparse email_1_unique index — recreating as sparse")
    except Exception as _e:
        logger.warning(f"Could not migrate email index: {_e}")
    safe_create_index(users_collection(), [("email", ASCENDING)], unique=True, sparse=True)

    safe_create_index(roles_collection, [("name", ASCENDING)], unique=True)
    safe_create_index(tasks_collection(), [("id", ASCENDING)], unique=True)
    safe_create_index(db.counters, [("_id", ASCENDING)], unique=True)
    
    # ✅ NEW: TICKETS MODULE INDEXES
    safe_create_index(tickets_collection(), [("status", ASCENDING), ("priority", DESCENDING)], name="ticket_status_priority")
    safe_create_index(tickets_collection(), [("raised_by.user_id", ASCENDING)], name="ticket_raised_by")
    safe_create_index(tickets_collection(), [("ticket_number", ASCENDING)], unique=True)
    safe_create_index(tickets_collection(), [("linked_invoice", ASCENDING)], name="ticket_linked_invoice")
    
    # ✅ NEW: INVOICES MODULE INDEXES
    safe_create_index(invoices_collection(), [("customer_id", ASCENDING)], name="invoice_customer")
    safe_create_index(invoices_collection(), [("status", ASCENDING)], name="invoice_status")
    safe_create_index(invoices_collection(), [("due_date", ASCENDING)], name="invoice_due_date")
    safe_create_index(invoices_collection(), [("invoice_number", ASCENDING)], unique=True)

# YOUR ORIGINAL FUNCTIONS - UNCHANGED (initialize_default_data, assign_admin_role, etc.)
def initialize_default_data():
    """Initialize default data in the database with custom incremental Ro-XXX ids and key roles."""
    logger.info("Initializing default data")
    default_roles = [
        {"name": "admin", "description": "System administrator with full access"},
        {"name": "employee", "description": "Company employee"},
        {"name": "hr", "description": "HR team member"},
        {"name": "manager", "description": "Team manager"},
        {"name": "user", "description": "General user"},
        # ✅ NEW: SUPPORT ROLES FOR TICKETS MODULE
        {"name": "support", "description": "Support team member - can manage tickets"},
    ]
    for role in default_roles:
        existing_role = roles_collection.find_one({"name": role["name"]})
        if not existing_role:
            role_id = get_next_role_id(db)
            role_doc = role.copy()
            role_doc["id"] = role_id
            role_doc["created_at"] = datetime.now()
            role_doc["created_by"] = "system"
            roles_collection.insert_one(role_doc)
            logger.info(f"Created role: {role['name']} with id {role_id}")
        else:
            # If already exists but does not have Ro-XXX id, assign one (migration)
            if not existing_role.get("id") or str(existing_role["id"]).startswith("691f"):
                max_existing = list(db.roles.aggregate([
                    {"$match": {"id": {"$regex": "^Ro-\\d{3}$"}}},
                    {"$project": {"num": {"$toInt": {"$substr": ["$id", 3, 3]}}}},
                    {"$sort": {"num": -1}},
                    {"$limit": 1}
                ]))
                next_num = max_existing[0]["num"] + 1 if max_existing else 1
                new_id = f"Ro-{str(next_num).zfill(3)}"
                roles_collection.update_one(
                    {"_id": existing_role["_id"]},
                    {"$set": {"id": new_id}}
                )
                logger.info(f"Updated role {role['name']} id to {new_id}")

# ... [ALL YOUR OTHER ORIGINAL FUNCTIONS REMAIN EXACTLY THE SAME] ...

def assign_admin_role(username):
    """Assign admin role to the specified user."""
    admin_role = roles_collection.find_one({"name": "admin"})
    if not admin_role:
        logger.error("Admin role not found, this shouldn't happen")
        return False
    admin_role_id = admin_role.get("id") or str(admin_role["_id"])
    users_coll = users_collection()
    user = users_coll.find_one({"username": username})
    if not user:
        user_id = str(ObjectId())
        users_coll.insert_one({
            "id": user_id,
            "username": username,
            "email": f"{username}@crm.com",
            "created_at": datetime.now(),
            "role_ids": [admin_role_id],
            "is_active": True
        })
        logger.info(f"Created user {username} with admin role")
        return True
    role_ids = user.get("role_ids", [])
    if admin_role_id not in role_ids:
        role_ids.append(admin_role_id)
        users_coll.update_one(
            {"_id": user["_id"]},
            {"$set": {"role_ids": role_ids}}
        )
        logger.info(f"Added admin role to user {username}")
        return True
    else:
        logger.info(f"User {username} already has admin role")
        return True

def close_db_connection():
    """Close database connection."""
    if client:
        client.close()
        logger.info("MongoDB connection closed")

def serialize_id(document):
    if document and "_id" in document:
        document["id"] = str(document["_id"])
        del document["_id"]
    return document

def get_object_id(id_str):
    """Convert string ID to ObjectId."""
    try:
        return ObjectId(id_str)
    except Exception:
        return None

try:
    initialize_db()
except Exception as e:
    logger.error(f"Error initializing database: {e}")
    print(f"Database initialization error: {e}")
    print("Application will continue but some features may not work properly")

try:
    from .async_db import async_db
    logger.info("Async database imported successfully")
except Exception as e:
    logger.error(f"Error importing async database: {e}")
    async_db = None

__all__ = [
    'get_database',
    'async_db'
]
