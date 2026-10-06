from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Persona(BaseModel):
    name: str
    role_description: str
    pain_points: List[str] = Field(default_factory=list)

class SystemCapability(BaseModel):
    id: str
    title: str
    description: str
    section_ref: Optional[str] = None

class DocumentClause(BaseModel):
    clause_id: str
    section_title: str
    text: str
    clause_type: str = "FUNCTIONAL" # FUNCTIONAL, AMBIGUITY, ASSUMPTION, CONSTRAINT
    flagged: bool = False
    flagged_reason: Optional[str] = None

class PRDUploadRequest(BaseModel):
    project_id: str
    file_name: str
    file_content_base64: Optional[str] = None
    file_text: Optional[str] = None
    file_url: Optional[str] = None
    use_sample_doc: bool = False

class PRDExtractResult(BaseModel):
    project_id: str
    document_title: str
    page_count: int
    business_goal: str
    personas: List[Persona] = Field(default_factory=list)
    capabilities: List[SystemCapability] = Field(default_factory=list)
    clauses: List[DocumentClause] = Field(default_factory=list)
    open_questions_count: int
    assumptions_count: int
    gcs_uri: Optional[str] = None
    notebooklm_source_id: Optional[str] = None
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
