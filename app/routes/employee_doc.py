from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import logging
import os
import mimetypes
import uuid

from app.services.auth_service import AuthService
get_current_user = AuthService.get_current_user
from app.dependencies import get_current_user_id
from ..database import get_database

# Set up logger
logger = logging.getLogger(__name__)

# Create router
employee_docs_router = APIRouter(
    prefix="/api/employee-docs",
    tags=["Employee Documents"]
)

# Helper function to convert MongoDB ObjectId to string
def convert_objectid_to_str(data):
    if isinstance(data, dict):
        for key in list(data.keys()):
            if isinstance(data[key], ObjectId):
                data[key] = str(data[key])
            elif isinstance(data[key], (dict, list)):
                data[key] = convert_objectid_to_str(data[key])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            data[i] = convert_objectid_to_str(item)
    return data

# Helper function to check if a user can access HR functions
async def check_hr_access(user_data, role_param=None):
    """Check if user has HR or admin access based on their roles"""
    if not user_data:
        return False
    
    # Role parameter override for testing
    if role_param and role_param.lower() in ['admin', 'hr']:
        return True
    
    # Extract roles from user data
    user_roles = []
    
    # Check role field (string)
    if user_data.get('role'):
        if isinstance(user_data['role'], str):
            user_roles.append(user_data['role'].lower())
    
    # Check roles array
    if user_data.get('roles'):
        if isinstance(user_data['roles'], list):
            for role in user_data['roles']:
                if isinstance(role, str):
                    user_roles.append(role.lower())
                elif isinstance(role, dict) and role.get('name'):
                    user_roles.append(role['name'].lower())
        elif isinstance(user_data['roles'], str):
            user_roles.append(user_data['roles'].lower())
    
    # Check role_names array
    if user_data.get('role_names') and isinstance(user_data['role_names'], list):
        user_roles.extend([r.lower() for r in user_data['role_names'] if r])
    
    # Check if any role is admin or hr
    is_admin = False
    is_hr = False
    
    for role in user_roles:
        if role == 'admin' or 'admin' in role:
            is_admin = True
        if role == 'hr' or 'hr' in role or 'human resource' in role or 'human_resources' in role:
            is_hr = True
    
    # Return True if user is either admin or hr
    if is_admin or is_hr:
        return True
    
    # Additional admin check - if reports_to is empty
    if user_data.get('reports_to') is None or user_data.get('reports_to') == "":
        return True
    
    return False

@employee_docs_router.get("/employees/{employee_id}/documents")
async def get_employee_documents(
    employee_id: str = Path(..., description="Employee ID"),
    current_user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get documents for a specific employee"""
    try:
        # Check if user has HR access or is viewing their own documents
        has_access = await check_hr_access(current_user)
        
        if not has_access and employee_id != current_user_id:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Can only view your own documents."}
            )
        
        # Get employee documents
        documents = []
        if "employee_documents" in db.list_collection_names():
            documents_cursor = db.employee_documents.find({"employee_id": employee_id}).sort("uploaded_at", -1)
            documents = list(documents_cursor)
        
        return convert_objectid_to_str({
            "success": True,
            "employee_id": employee_id,
            "documents": documents
        })
        
    except Exception as e:
        logger.error(f"Error getting employee documents: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.post("/employee/upload-document")
async def employee_upload_document(
    file: UploadFile = File(...),
    document_type: str = Query(..., description="Type of document being uploaded"),
    description: str = Query("", description="Optional description of the document"),
    current_user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Allow employees to upload their own documents"""
    try:
        print(f"[DEBUG] Employee upload started")
        print(f"[DEBUG] Current user ID: {current_user_id}")
        print(f"[DEBUG] File: {file.filename}, Type: {document_type}")
        
        if not current_user_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "Unable to identify user"}
            )
        
        # Validate file
        if not file.filename:
            return JSONResponse(
                status_code=400,
                content={"detail": "No file selected"}
            )
        
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 
                        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if file.content_type not in allowed_types:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed"}
            )
        
        # Validate file size (max 5MB)
        file_content = await file.read()
        file_size = len(file_content)
        if file_size > 5 * 1024 * 1024:
            return JSONResponse(
                status_code=400,
                content={"detail": "File size must be less than 5MB"}
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Create employee_document directory if it doesn't exist
        upload_dir = "employee_document"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        import uuid
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"USR-{current_user_id}_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Create document record
        document_record = {
            "employee_id": current_user_id,
            "document_name": file.filename,
            "document_type": document_type,
            "file_path": unique_filename,  # Store just the filename, not the full path
            "file_size": file_size,
            "uploaded_by": current_user_id,
            "uploaded_by_name": current_user.get("name") or current_user.get("full_name") or "Employee",
            "uploaded_at": datetime.now().isoformat(),
            "upload_date": datetime.now().isoformat(),
            "description": description,
            "status": "pending",
            "is_verified": False
        }
        
        # Insert document record
        result = db.employee_documents.insert_one(document_record)
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Document uploaded successfully and submitted for review",
            "document_id": str(result.inserted_id),
            "document": document_record
        })
        
    except Exception as e:
        logger.error(f"Error in employee document upload: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.post("/documents/upload")
async def upload_employee_document(
    data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Upload a document for an employee (HR only)"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. HR privileges required."}
            )
        
        # Validate required fields
        required_fields = ["employee_id", "document_name", "document_type"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required fields: {', '.join(missing_fields)}"}
            )
        
        # Create document record
        document_record = {
            "employee_id": data.get("employee_id"),
            "document_name": data.get("document_name"),
            "document_type": data.get("document_type"),
            "file_path": data.get("file_path"),
            "file_size": data.get("file_size", 0),
            "uploaded_by": current_user_id,
            "uploaded_by_name": current_user.get("name") or "HR",
            "uploaded_at": datetime.now().isoformat(),
            "description": data.get("description", ""),
            "status": "active"
        }
        
        # Insert document record
        result = db.employee_documents.insert_one(document_record)
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Document uploaded successfully",
            "document_id": str(result.inserted_id),
            "document": document_record
        })
        
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.post("/employee/upload-metadata")
async def employee_upload_document_metadata(
    data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Allow employees to upload document metadata (for pre-uploaded files)"""
    try:
        if not current_user_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "Unable to identify user"}
            )
        
        # Validate required fields
        required_fields = ["document_name", "document_type", "file_path"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required fields: {', '.join(missing_fields)}"}
            )
        
        # Create document record
        document_record = {
            "employee_id": current_user_id,
            "document_name": data.get("document_name"),
            "document_type": data.get("document_type"),
            "file_path": data.get("file_path"),
            "file_size": data.get("file_size", 0),
            "uploaded_by": current_user_id,
            "uploaded_by_name": current_user.get("name") or current_user.get("full_name") or "Employee",
            "uploaded_at": datetime.now().isoformat(),
            "upload_date": datetime.now().isoformat(),
            "description": data.get("description", ""),
            "status": "pending",
            "is_verified": False
        }
        
        # Insert document record
        result = db.employee_documents.insert_one(document_record)
        
        return convert_objectid_to_str({
            "success": True,
            "message": "Document uploaded successfully and submitted for review",
            "document_id": str(result.inserted_id),
            "document": document_record
        })
        
    except Exception as e:
        logger.error(f"Error uploading employee document metadata: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.get("/documents/all")
async def get_all_documents(
    status: str = Query(None, description="Filter by document status"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all employee documents with optional status filter"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. HR privileges required."}
            )
        
        # Build query filter
        query_filter = {}
        if status and status != 'all':
            query_filter["status"] = status
        
        # Get all documents from employee_documents collection
        documents = []
        
        # Debug: Check collections and database info
        collections = db.list_collection_names()
        print(f"[DEBUG] Available collections: {collections}")
        print(f"[DEBUG] Database name: {db.name}")
        print(f"[DEBUG] Query filter: {query_filter}")
        
        if "employee_documents" in collections:
            print("[DEBUG] employee_documents collection found")
            
            # Get collection stats
            collection_stats = db.command("collStats", "employee_documents")
            print(f"[DEBUG] Collection stats - count: {collection_stats.get('count', 0)}")
            
            # Try to get documents with detailed logging
            documents_cursor = db.employee_documents.find(query_filter).sort("upload_date", -1)
            documents = list(documents_cursor)
            
            # Debug: Show raw documents before processing
            print(f"[DEBUG] Raw documents from DB: {len(documents)}")
            for i, doc in enumerate(documents[:2]):  # Show first 2 docs
                print(f"[DEBUG] Doc {i+1}: {doc}")
            
            # Convert ObjectIds and add required fields for frontend compatibility
            for doc in documents:
                if "_id" in doc:
                    doc["id"] = str(doc["_id"])
                
                # Add default fields if missing
                if "status" not in doc:
                    doc["status"] = "pending"
                if "document_type" not in doc:
                    doc["document_type"] = doc.get("type", "Document")
                if "document_name" not in doc:
                    doc["document_name"] = doc.get("filename", doc.get("original_filename", "Unknown Document"))
                if "uploaded_by" not in doc:
                    doc["uploaded_by"] = doc.get("uploaded_by_name", "Unknown")
                if "upload_date" not in doc:
                    doc["upload_date"] = doc.get("uploaded_at", doc.get("created_at"))
                
                # Ensure employee ID is available
                if "employee_id" not in doc and "user_id" in doc:
                    doc["employee_id"] = doc["user_id"]
        else:
            print("[DEBUG] employee_documents collection NOT found!")
        
        print(f"[DEBUG] Final processed documents count: {len(documents)}")
        
        return convert_objectid_to_str({
            "success": True,
            "documents": documents,
            "count": len(documents)
        })
        
    except Exception as e:
        logger.error(f"Error getting all documents: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.get("/employee/my-documents")
async def get_my_documents(
    status: str = Query(None, description="Filter by document status"),
    current_user_id: str = Depends(get_current_user_id),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get documents for the current employee"""
    try:
        print(f"[DEBUG] My-documents endpoint called by user ID: {current_user_id}")
        print(f"[DEBUG] User object: {current_user}")
        
        if not current_user_id:
            print(f"[DEBUG] Unable to identify user")
            return JSONResponse(
                status_code=400,
                content={"detail": "Unable to identify user"}
            )
        
        # Create comprehensive list of possible user identifiers
        user_identifiers = [
            current_user_id,
            current_user.get("user_id"),
            current_user.get("id"),
            current_user.get("_id"),
            current_user.get("username"),
            current_user.get("emp_id"),
            current_user.get("employee_id"),
            # Add USR- prefixed versions
            f"USR-{current_user_id}",
            f"USR-{current_user.get('user_id', '')}",
            f"USR-{current_user.get('id', '')}",
            # Add EMP- prefixed versions
            f"EMP-{current_user_id}",
            f"EMP-{current_user.get('user_id', '')}",
            f"EMP-{current_user.get('id', '')}"
        ]
        
        # Remove empty/None values and convert to strings
        user_identifiers = [str(uid) for uid in user_identifiers if uid and str(uid) != 'None']
        
        # Remove duplicates
        user_identifiers = list(set(user_identifiers))
        
        print(f"[DEBUG] Looking for documents with employee_id matching any of: {user_identifiers}")
        
        # Build query filter with $in operator for multiple possible IDs
        query_filter = {"employee_id": {"$in": user_identifiers}}
        if status and status != 'all':
            query_filter["status"] = status
        
        # Get employee documents
        documents = []
        if "employee_documents" in db.list_collection_names():
            print(f"[DEBUG] Query filter: {query_filter}")
            documents_cursor = db.employee_documents.find(query_filter).sort("uploaded_at", -1)
            documents = list(documents_cursor)
            print(f"[DEBUG] Found {len(documents)} documents for user")
        
        return convert_objectid_to_str({
            "success": True,
            "employee_id": current_user_id,
            "user_identifiers": user_identifiers,
            "documents": documents,
            "count": len(documents)
        })
        
    except Exception as e:
        logger.error(f"Error getting employee documents: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.put("/documents/{document_id}/review")
async def review_document(
    document_id: str = Path(..., description="Document ID"),
    review_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Review and update document status"""
    try:
        # Check if user has HR access
        has_access = await check_hr_access(current_user)
        if not has_access:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. HR privileges required."}
            )
        
        # Validate status
        status = review_data.get("status")
        if status not in ['pending', 'approved', 'rejected', 'resubmit']:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid status. Must be 'pending', 'approved', 'rejected', or 'resubmit'."}
            )
        
        # Prepare update data
        update_data = {
            "status": status,
            "hr_comments": review_data.get("hr_comments", ""),
            "reviewed_by": review_data.get("reviewed_by") or current_user.get("name", "HR"),
            "reviewed_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Handle different document ID formats and try multiple collections
        document_found = False
        result = None
        
        # Try to find and update in employee_documents collection
        try:
            from bson import ObjectId
            if ObjectId.is_valid(document_id):
                # Try as ObjectId
                result = db.employee_documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": update_data}
                )
                if result.matched_count > 0:
                    document_found = True
        except:
            pass
        
        # If not found, try other ID formats in employee_documents
        if not document_found:
            result = db.employee_documents.update_one(
                {"$or": [
                    {"id": document_id},
                    {"document_id": document_id},
                    {"employee_id": document_id}
                ]},
                {"$set": update_data}
            )
            if result.matched_count > 0:
                document_found = True
        
        # If still not found, try the main documents collection
        if not document_found:
            try:
                from app.database import employee_document_collection
                collection = employee_document_collection()
                
                if ObjectId.is_valid(document_id):
                    result = collection.update_one(
                        {"_id": ObjectId(document_id)},
                        {"$set": update_data}
                    )
                else:
                    result = collection.update_one(
                        {"$or": [
                            {"id": document_id},
                            {"generated_for": document_id}
                        ]},
                        {"$set": update_data}
                    )
                
                if result.matched_count > 0:
                    document_found = True
            except Exception as e:
                print(f"Error accessing main documents collection: {e}")
        
        if not document_found:
            return JSONResponse(
                status_code=404,
                content={"detail": "Document not found in any collection"}
            )
        
        return {
            "success": True,
            "message": f"Document {status} successfully",
            "status": status,
            "updated_count": result.modified_count
        }
        
    except Exception as e:
        logger.error(f"Error reviewing document: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

@employee_docs_router.get("/documents/download/{filename}")
async def download_employee_document(
    filename: str = Path(..., description="Document filename"),
    current_user: dict = Depends(get_current_user)
):
    """Download employee document with proper CORS headers"""
    try:
        # Check if user has access (can be employee downloading their own docs or HR)
        has_hr_access = await check_hr_access(current_user)
        
        print(f"[DEBUG] Download request for filename: {filename}")
        print(f"[DEBUG] User: {current_user.get('user_id')}, HR Access: {has_hr_access}")
        
        # URL decode the filename in case it was encoded
        import urllib.parse
        decoded_filename = urllib.parse.unquote(filename)
        print(f"[DEBUG] Decoded filename: {decoded_filename}")
        
        # Try multiple possible file paths
        possible_paths = [
            os.path.join("employee_document", decoded_filename),
            os.path.join("employee_document", filename),
            decoded_filename if decoded_filename.startswith("employee_document") else None,
            filename if filename.startswith("employee_document") else None
        ]
        
        # Filter out None values
        possible_paths = [p for p in possible_paths if p is not None]
        
        file_path = None
        for path in possible_paths:
            print(f"[DEBUG] Checking path: {path}")
            if os.path.exists(path):
                file_path = path
                print(f"[DEBUG] Found file at: {file_path}")
                break
        
        if not file_path:
            print(f"[DEBUG] File not found in any of these paths: {possible_paths}")
            # List files in employee_document directory for debugging
            if os.path.exists("employee_document"):
                files = os.listdir("employee_document")
                print(f"[DEBUG] Files in employee_document directory: {files}")
            
            return JSONResponse(
                status_code=404,
                content={"detail": f"Document not found. Tried paths: {possible_paths}"}
            )
        
        # For security, check if the file is actually in the employee_document directory
        abs_file_path = os.path.abspath(file_path)
        abs_employee_dir = os.path.abspath("employee_document")
        
        if not abs_file_path.startswith(abs_employee_dir):
            print(f"[DEBUG] Security check failed. File path: {abs_file_path}, Employee dir: {abs_employee_dir}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied - file outside allowed directory"}
            )
        
        # If not HR, check if user can access this specific file
        if not has_hr_access:
            # Extract employee ID from filename (format: EMP-123_filename or USR-123_filename)
            user_id = current_user.get('user_id') or current_user.get('id')
            if not decoded_filename.startswith(f"USR-{user_id}_") and not decoded_filename.startswith(f"EMP-{user_id}_"):
                print(f"[DEBUG] Access denied. User {user_id} cannot access file {decoded_filename}")
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied. You can only download your own documents."}
                )
        
        # Determine content type
        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = "application/octet-stream"
        
        print(f"[DEBUG] Serving file: {file_path}, Content-Type: {content_type}")
        
        # Return file with proper headers for download
        response = FileResponse(
            path=file_path,
            media_type=content_type,
            filename=decoded_filename,
            headers={
                "Content-Disposition": f"attachment; filename=\"{decoded_filename}\"",
                "Access-Control-Allow-Origin": "http://localhost:4000",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
                "Access-Control-Allow-Credentials": "true"
            }
        )
        return response
        
    except Exception as e:
        logger.error(f"Error downloading document: {str(e)}")
        print(f"[DEBUG] Exception in download: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )