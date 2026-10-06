from typing import List
from fastapi import APIRouter
from apps.api.src.schemas.knowledge import KnowledgeSearchQuery, KnowledgeSearchResponse, NotebookLMReference, KnowledgeItem
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.firestore_client import db

router = APIRouter(prefix="/knowledge", tags=["Google NotebookLM & Project Knowledge Center"])

@router.post("/search", response_model=KnowledgeSearchResponse)
def search_project_knowledge(query: KnowledgeSearchQuery):
    """Grounded semantic Q&A with exact source citations (FR-18 & NotebookLM engine)."""
    provider = provider_factory.get_knowledge_provider(query.project_id)
    return provider.search(query.project_id, query.query, query.limit)

@router.get("/notebooklm/{project_id}", response_model=NotebookLMReference)
def get_notebooklm_details(project_id: str):
    """Get project Google NotebookLM workspace link, source count, and audio briefing summary."""
    provider = provider_factory.get_knowledge_provider(project_id)
    return provider.get_notebooklm_reference(project_id)

@router.get("/items/{project_id}", response_model=List[KnowledgeItem])
def list_knowledge_items(project_id: str):
    """List indexed project knowledge assets (PRDs, ADRs, Meeting Decisions)."""
    docs = list(db.collection("knowledge_items").where("project_id", "==", project_id).stream())
    return [KnowledgeItem(**d.to_dict()) for d in docs]

@router.post("/items", response_model=KnowledgeItem)
def add_knowledge_item(item: KnowledgeItem):
    """Add a new source document, decision, or note to the project's knowledge base."""
    provider = provider_factory.get_knowledge_provider(item.project_id)
    return provider.add_knowledge_item(item.project_id, item.title, item.content, item.source_type, item.source_uri)
