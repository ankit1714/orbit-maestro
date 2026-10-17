import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from apps.api.src.schemas.user import User, UserCreate, UserUpdate, UserRoleUpdate, UserRole
from apps.api.src.core.firestore_client import db

router = APIRouter(prefix="/users", tags=["Users & Roles"])

@router.get("", response_model=List[User])
def list_users(
    role: Optional[UserRole] = Query(None, description="Filter users by role"),
    project_id: Optional[str] = Query(None, description="Filter users by assigned project ID")
):
    """List all users stored in the Firestore 'users' collection."""
    col = db.collection("users")
    docs = list(col.stream())
    users = [User(**d.to_dict()) for d in docs]
    
    if role:
        users = [u for u in users if u.role == role]
    if project_id:
        users = [u for u in users if project_id in u.project_ids]
        
    return users

@router.post("", response_model=User, status_code=201)
def create_user(req: UserCreate):
    """Create a new user and persist their role in the Firestore 'users' collection."""
    user_id = req.id.strip() if req.id else f"usr-{uuid.uuid4().hex[:8]}"
    
    # Check if user already exists
    existing = db.collection("users").document(user_id).get()
    if existing.exists:
        raise HTTPException(status_code=409, detail=f"User with ID '{user_id}' already exists")
    
    now = datetime.utcnow()
    user_data = {
        "id": user_id,
        "name": req.name,
        "email": req.email,
        "role": req.role.value,
        "title": req.title or req.role.value.replace("_", " ").title(),
        "avatar_url": req.avatar_url or "",
        "project_ids": req.project_ids,
        "status": "ACTIVE",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    db.collection("users").document(user_id).set(user_data)
    return User(**user_data)

@router.get("/{user_id}", response_model=User)
def get_user(user_id: str):
    """Retrieve user details and active role from Firestore."""
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    return User(**doc.to_dict())

@router.put("/{user_id}", response_model=User)
def update_user(user_id: str, req: UserUpdate):
    """Update user information in Firestore."""
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    
    current = doc.to_dict()
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.email is not None:
        updates["email"] = req.email
    if req.role is not None:
        updates["role"] = req.role.value
    if req.title is not None:
        updates["title"] = req.title
    if req.avatar_url is not None:
        updates["avatar_url"] = req.avatar_url
    if req.project_ids is not None:
        updates["project_ids"] = req.project_ids
    if req.status is not None:
        updates["status"] = req.status
        
    updates["updated_at"] = datetime.utcnow().isoformat()
    doc_ref.set(updates, merge=True)
    current.update(updates)
    return User(**current)

@router.patch("/{user_id}/role", response_model=User)
def update_user_role(user_id: str, req: UserRoleUpdate):
    """Update only the role for a specific user in Firestore."""
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    
    current = doc.to_dict()
    updates = {
        "role": req.role.value,
        "updated_at": datetime.utcnow().isoformat()
    }
    doc_ref.set(updates, merge=True)
    current.update(updates)
    return User(**current)

@router.delete("/{user_id}")
def delete_user(user_id: str):
    """Delete a user document from Firestore."""
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    doc_ref.delete()
    return {"status": "SUCCESS", "message": f"User '{user_id}' deleted from database."}

@router.post("/seed-defaults", response_model=List[User])
def seed_default_users():
    """Seeds the 5 primary persona users into the Firestore 'users' collection."""
    default_users = [
        {
            "id": "usr-david-vance",
            "name": "David Vance",
            "email": "david.vance@ai-scrum.io",
            "role": UserRole.SCRUM_MASTER.value,
            "title": "Scrum Master",
            "avatar_url": "",
            "project_ids": [],
            "status": "ACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr-alex-rivera",
            "name": "Alex Rivera",
            "email": "alex.rivera@ai-scrum.io",
            "role": UserRole.DEVELOPER.value,
            "title": "Senior Developer",
            "avatar_url": "",
            "project_ids": [],
            "status": "ACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr-samira-patel",
            "name": "Samira Patel",
            "email": "samira.patel@ai-scrum.io",
            "role": UserRole.QA_ENGINEER.value,
            "title": "QA Engineer",
            "avatar_url": "",
            "project_ids": [],
            "status": "ACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr-elena-rostova",
            "name": "Elena Rostova",
            "email": "elena.rostova@ai-scrum.io",
            "role": UserRole.EXECUTIVE.value,
            "title": "Executive / VP",
            "avatar_url": "",
            "project_ids": [],
            "status": "ACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr-admin",
            "name": "Platform Admin",
            "email": "admin@ai-scrum.io",
            "role": UserRole.ADMIN.value,
            "title": "Workspace Admin",
            "avatar_url": "",
            "project_ids": [],
            "status": "ACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
    ]

    seeded = []
    for u in default_users:
        db.collection("users").document(u["id"]).set(u)
        seeded.append(User(**u))
    return seeded
