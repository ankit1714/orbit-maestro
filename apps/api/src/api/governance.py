from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.governance import GovernanceApproval, ApprovalActionRequest, ActivityLogEntry
from apps.api.src.schemas.common import AuditActionType, GovernanceTier
from apps.api.src.core.firestore_client import db

try:
    from packages.agents.src.orchestrator import orchestrator
except ImportError:
    pass

router = APIRouter(prefix="/governance", tags=["Action Center & Human Governance"])

@router.get("/approvals/{project_id}", response_model=List[GovernanceApproval])
def list_pending_approvals(project_id: str):
    """List pending items requiring human approval (Section 30)."""
    docs = list(db.collection("governance_approvals").where("project_id", "==", project_id).where("status", "==", "PENDING").stream())
    return [GovernanceApproval(**d.to_dict()) for d in docs]

@router.post("/approvals/action", response_model=GovernanceApproval)
def act_on_approval(req: ApprovalActionRequest):
    """Execute approval or rejection with audit logging."""
    doc_ref = db.collection("governance_approvals").document(req.approval_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Approval record not found")

    data = snap.to_dict()
    data["status"] = "APPROVED" if req.action == "APPROVE" else "REJECTED"
    data["reviewed_by"] = req.reviewed_by
    data["review_notes"] = req.review_notes
    data["reviewed_at"] = datetime.utcnow()
    doc_ref.update(data)

    action_type = AuditActionType.APPROVAL_GRANTED if req.action == "APPROVE" else AuditActionType.APPROVAL_REJECTED
    orchestrator.log_activity(
        project_id=data["project_id"],
        action_type=action_type,
        actor=req.reviewed_by,
        description=f"{data['status']}: {data['title']} - {data['summary']}",
        target=data["target_entity_type"],
        tier=GovernanceTier.APPROVAL_REQUIRED
    )

    return GovernanceApproval(**data)

@router.get("/activity/{project_id}", response_model=List[ActivityLogEntry])
def get_project_activity_log(project_id: str, limit: int = 50):
    """Retrieve immutable activity audit log for the project (Section 44)."""
    docs = list(db.collection("activity_logs").where("project_id", "==", project_id).order_by("timestamp", "DESCENDING").limit(limit).stream())
    return [ActivityLogEntry(**d.to_dict()) for d in docs]
