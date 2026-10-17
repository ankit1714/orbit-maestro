from enum import Enum
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime

class UserRole(str, Enum):
    SCRUM_MASTER = "SCRUM_MASTER"
    DEVELOPER = "DEVELOPER"
    QA_ENGINEER = "QA_ENGINEER"
    EXECUTIVE = "EXECUTIVE"
    ADMIN = "ADMIN"
    PRODUCT_OWNER = "PRODUCT_OWNER"  # Legacy role retained for seamless backward-compatibility mapping

class UserBase(BaseModel):
    name: str = Field(..., description="Full name of user")
    email: str = Field(..., description="Corporate or system email address")
    role: UserRole = Field(..., description="Assigned organizational role")
    title: Optional[str] = Field(None, description="Job title, e.g. Staff Engineer, VP Engineering")
    avatar_url: Optional[str] = Field(None, description="Optional profile image URL")
    project_ids: List[str] = Field(default_factory=list, description="IDs of projects assigned to this user")

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        if v == "PRODUCT_OWNER" or (hasattr(v, "value") and v.value == "PRODUCT_OWNER"):
            return UserRole.SCRUM_MASTER
        return v

class UserCreate(UserBase):
    id: Optional[str] = Field(None, description="Optional custom user ID. If not provided, UUID will be generated.")

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    project_ids: Optional[List[str]] = None
    status: Optional[str] = None

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        if v == "PRODUCT_OWNER" or (hasattr(v, "value") and v.value == "PRODUCT_OWNER"):
            return UserRole.SCRUM_MASTER
        return v

class UserRoleUpdate(BaseModel):
    role: UserRole = Field(..., description="Updated role enum")

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        if v == "PRODUCT_OWNER" or (hasattr(v, "value") and v.value == "PRODUCT_OWNER"):
            return UserRole.SCRUM_MASTER
        return v

class User(UserBase):
    id: str = Field(..., description="Unique User ID in Firestore")
    status: str = Field("ACTIVE", description="Account status: ACTIVE, INACTIVE, SUSPENDED")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
