"""
Script to clone MongoDB database from test_crm_db to ratilal_crm_db
"""
import pymongo
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('app/.env')

# Get database connection details
DATABASE_URL = os.getenv('DATABASE_URL')
SOURCE_DB_NAME = os.getenv('DB_NAME', 'test_crm_db')
TARGET_DB_NAME = 'ratilal_crm_db'

print(f"Connecting to MongoDB...")
print(f"Source Database: {SOURCE_DB_NAME}")
print(f"Target Database: {TARGET_DB_NAME}")

# Connect to MongoDB
client = MongoClient(DATABASE_URL)

# Get source and target databases
source_db = client[SOURCE_DB_NAME]
target_db = client[TARGET_DB_NAME]

print(f"\nStarting database clone operation...")

# Get all collection names from source database
collections = source_db.list_collection_names()
print(f"\nFound {len(collections)} collections to clone:")
for col in collections:
    print(f"  - {col}")

# Clone each collection
for collection_name in collections:
    print(f"\nCloning collection: {collection_name}")
    
    source_collection = source_db[collection_name]
    target_collection = target_db[collection_name]
    
    # Get document count
    doc_count = source_collection.count_documents({})
    print(f"  Documents to copy: {doc_count}")
    
    if doc_count > 0:
        # Drop target collection if it exists
        if collection_name in target_db.list_collection_names():
            print(f"  Dropping existing target collection...")
            target_collection.drop()
        
        # Copy all documents
        documents = list(source_collection.find({}))
        target_collection.insert_many(documents)
        print(f"  ✓ Copied {len(documents)} documents")
        
        # Copy indexes
        indexes = list(source_collection.list_indexes())
        for index in indexes:
            if index['name'] != '_id_':  # Skip default _id index
                try:
                    keys = list(index['key'].items())
                    index_options = {k: v for k, v in index.items() if k not in ['key', 'v', 'ns']}
                    target_collection.create_index(keys, **index_options)
                    print(f"  ✓ Created index: {index['name']}")
                except Exception as e:
                    print(f"  ⚠ Warning: Could not create index {index['name']}: {e}")
    else:
        print(f"  ⚠ Collection is empty, skipping...")

print(f"\n{'='*60}")
print(f"Database clone completed successfully!")
print(f"{'='*60}")
print(f"\nSource: {SOURCE_DB_NAME}")
print(f"Target: {TARGET_DB_NAME}")
print(f"Collections cloned: {len(collections)}")

# Verify the clone
print(f"\nVerifying clone...")
for collection_name in collections:
    source_count = source_db[collection_name].count_documents({})
    target_count = target_db[collection_name].count_documents({})
    status = "✓" if source_count == target_count else "✗"
    print(f"  {status} {collection_name}: {source_count} -> {target_count}")

print(f"\n{'='*60}")
print(f"Clone verification complete!")
print(f"{'='*60}")

client.close()
print(f"\nYou can now update your .env file to use DB_NAME={TARGET_DB_NAME}")
