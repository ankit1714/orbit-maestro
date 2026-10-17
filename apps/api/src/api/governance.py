import io
import csv
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Response
from apps.api.src.schemas.governance import (
    GovernanceApproval,
    ApprovalActionRequest,
    ActivityLogEntry,
    ActionDecisionItem,
    ActionDecisionCreate,
    ActionDecisionUpdate
)
from apps.api.src.schemas.common import AuditActionType, GovernanceTier
from apps.api.src.core.firestore_client import db

try:
    from packages.agents.src.orchestrator import orchestrator
except ImportError:
    pass

router = APIRouter(prefix="/governance", tags=["Action Center & Human Governance"])

def _sync_meetings_to_actions_and_decisions(project_id: str):
    """
    Ensures that any decisions or action items already stored in 'meetings'
    are synchronized into 'actions_and_decisions' so nothing is missed.
    """
    try:
        existing_docs = list(db.collection("actions_and_decisions").where("project_id", "==", project_id).stream())
        existing_keys = set()
        for doc in existing_docs:
            d = doc.to_dict()
            m_id = d.get("meeting_id")
            title = d.get("title", "")
            if m_id:
                existing_keys.add((m_id, title))

        meeting_docs = list(db.collection("meetings").where("project_id", "==", project_id).stream())
        for m in meeting_docs:
            m_data = m.to_dict()
            m_id = m.id
            m_title = m_data.get("title", "Meeting")
            m_type = m_data.get("meeting_type", "STANDUP")
            m_date = m_data.get("date") or m_data.get("created_at")
            if isinstance(m_date, datetime):
                m_date = m_date.isoformat()
            elif not m_date:
                m_date = datetime.utcnow().isoformat()
            entered_by = m_data.get("entered_by", "Team Member")

            for dec in m_data.get("decisions", []):
                d_text = dec.get("decision_text") or dec.get("text") or ""
                short_title = d_text[:90] + ("..." if len(d_text) > 90 else "")
                if (m_id, short_title) not in existing_keys and d_text:
                    ad_id = f"dec-{uuid.uuid4().hex[:8]}"
                    db.collection("actions_and_decisions").document(ad_id).set({
                        "id": ad_id,
                        "project_id": project_id,
                        "type": "DECISION",
                        "title": short_title,
                        "description": d_text,
                        "status": "APPROVED",
                        "meeting_id": m_id,
                        "meeting_title": m_title,
                        "meeting_date": str(m_date),
                        "meeting_type": str(m_type),
                        "decision_maker": dec.get("speaker") or entered_by or "Meeting Participants",
                        "assignee": None,
                        "due_date": None,
                        "created_at": str(m_date),
                        "created_by": entered_by,
                        "updated_at": datetime.utcnow().isoformat(),
                        "notes": f"Extracted from {m_title}"
                    })
                    existing_keys.add((m_id, short_title))

            for act in m_data.get("actions", []):
                a_desc = act.get("description") or act.get("text") or ""
                short_title = a_desc[:90] + ("..." if len(a_desc) > 90 else "")
                if (m_id, short_title) not in existing_keys and a_desc:
                    ad_id = f"act-{uuid.uuid4().hex[:8]}"
                    db.collection("actions_and_decisions").document(ad_id).set({
                        "id": ad_id,
                        "project_id": project_id,
                        "type": "ACTION_ITEM",
                        "title": short_title,
                        "description": a_desc,
                        "status": "PENDING",
                        "meeting_id": m_id,
                        "meeting_title": m_title,
                        "meeting_date": str(m_date),
                        "meeting_type": str(m_type),
                        "decision_maker": None,
                        "assignee": act.get("assignee") or "Unassigned",
                        "due_date": None,
                        "created_at": str(m_date),
                        "created_by": entered_by,
                        "updated_at": datetime.utcnow().isoformat(),
                        "notes": f"Extracted from {m_title}"
                    })
                    existing_keys.add((m_id, short_title))
    except Exception:
        pass

@router.get("/actions-decisions/{project_id}", response_model=List[ActionDecisionItem])
def list_actions_and_decisions(project_id: str):
    """
    List all action items and decisions for the project.
    Automatically synchronizes any legacy items from meeting minutes.
    """
    _sync_meetings_to_actions_and_decisions(project_id)
    docs = list(db.collection("actions_and_decisions").where("project_id", "==", project_id).stream())
    items = []
    for d in docs:
        try:
            items.append(ActionDecisionItem(**d.to_dict()))
        except Exception:
            pass

    items.sort(key=lambda x: str(x.meeting_date or x.created_at or ""), reverse=True)
    return items

@router.post("/actions-decisions", response_model=ActionDecisionItem, status_code=201)
def create_action_or_decision(req: ActionDecisionCreate):
    """Log an ad-hoc action item or decision."""
    ad_id = f"{'dec' if req.type == 'DECISION' else 'act'}-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    data = req.dict()
    data["id"] = ad_id
    data["created_at"] = now
    data["updated_at"] = now
    db.collection("actions_and_decisions").document(ad_id).set(data)
    return ActionDecisionItem(**data)

@router.put("/actions-decisions/{item_id}", response_model=ActionDecisionItem)
def update_action_or_decision(item_id: str, req: ActionDecisionUpdate):
    """Update an action item or decision (accessible to Scrum Master / Admin)."""
    doc_ref = db.collection("actions_and_decisions").document(item_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail=f"Action or decision '{item_id}' not found")

    data = snap.to_dict()
    updates = req.dict(exclude_unset=True)
    updates["updated_at"] = datetime.utcnow().isoformat()
    doc_ref.update(updates)
    data.update(updates)
    return ActionDecisionItem(**data)

@router.delete("/actions-decisions/{item_id}")
def delete_action_or_decision(item_id: str):
    """Delete an action item or decision (accessible to Scrum Master / Admin)."""
    doc_ref = db.collection("actions_and_decisions").document(item_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail=f"Action or decision '{item_id}' not found")
    doc_ref.delete()
    return {"status": "SUCCESS", "message": f"Item '{item_id}' deleted from database."}

@router.get("/actions-decisions/{project_id}/csv")
def export_actions_decisions_csv(project_id: str):
    """Export all actions and decisions for a project as CSV."""
    items = list_actions_and_decisions(project_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Type",
        "Title",
        "Description",
        "Status",
        "Assignee",
        "Decision Maker",
        "Due Date",
        "Meeting Source",
        "Meeting Date & Time",
        "Created At",
        "Notes"
    ])
    for item in items:
        writer.writerow([
            item.id,
            item.type,
            item.title,
            item.description,
            item.status,
            item.assignee or "",
            item.decision_maker or "",
            item.due_date or "",
            item.meeting_title or "",
            item.meeting_date or "",
            item.created_at,
            item.notes or ""
        ])
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=actions_and_decisions_{project_id}.csv"
        }
    )

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
