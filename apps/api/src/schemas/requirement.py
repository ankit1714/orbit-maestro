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
    orchestrator_strategy: Optional[dict] = None
    decomposition_summary: Optional[dict] = None
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

# =========================================================================
# 3-Agent Requirements-to-Stories Pipeline Schemas
# =========================================================================

class LeadOrchestratorStrategy(BaseModel):
    project_name: str
    core_problem_statement: str
    target_audience: List[str] = Field(default_factory=list)
    key_functional_themes: List[str] = Field(default_factory=list)
    execution_strategy: dict = Field(default_factory=dict)
    sprint_guidelines: dict = Field(default_factory=dict)

class DecomposedUserStory(BaseModel):
    title: str
    description: str
    origin: Optional[str] = None
    acceptance_criteria: List[dict] = Field(default_factory=list)
    non_functional_constraints: List[str] = Field(default_factory=list)

class DecomposedEpic(BaseModel):
    title: str
    description: str
    stories: List[DecomposedUserStory] = Field(default_factory=list)

class ProductOwnerDecomposition(BaseModel):
    epics: List[DecomposedEpic] = Field(default_factory=list)

class InvestCriteria(BaseModel):
    independent: bool = True
    negotiable: bool = True
    valuable: bool = True
    estimable: bool = True
    small: bool = True
    testable: bool = True
    invest_notes: Optional[str] = None

class TechnicalValidatedStory(BaseModel):
    title: str
    epic_title: str
    description: str
    issue_type: str = "Story"
    story_points: int = 5
    priority: str = "High"
    invest_validation: InvestCriteria = Field(default_factory=InvestCriteria)
    acceptance_criteria: List[dict] = Field(default_factory=list)
    tasks: List[dict] = Field(default_factory=list)

class TechnicalSprintPlan(BaseModel):
    validated_epics: List[dict] = Field(default_factory=list)
    total_stories: int = 0
    total_points: int = 0

class RequirementDecompositionResponse(BaseModel):
    project_id: str
    project_name: str
    sprint_goal: str
    orchestrator_strategy: LeadOrchestratorStrategy
    po_decomposition: ProductOwnerDecomposition
    technical_sprint_plan: TechnicalSprintPlan
    total_epics: int = 0
    total_stories: int = 0
    total_points: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
