import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.core.providers.base import BaseBacklogProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, AcceptanceCriteria, BacklogHierarchyResponse
from apps.api.src.schemas.common import ItemStatus, Priority, TaskType

class NativeFirestoreBacklogProvider(BaseBacklogProvider):
    def get_backlog(self, project_id: str) -> BacklogHierarchyResponse:
        # 1. Fetch epics
        epic_docs = list(db.collection("epics").where("project_id", "==", project_id).stream())
        story_docs = list(db.collection("stories").where("project_id", "==", project_id).stream())
        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())

        tasks_by_story: Dict[str, List[TaskItem]] = {}
        for td in task_docs:
            t_data = td.to_dict()
            t_item = TaskItem(**t_data)
            tasks_by_story.setdefault(t_item.story_id, []).append(t_item)

        stories_by_epic: Dict[str, List[UserStory]] = {}
        for sd in story_docs:
            s_data = sd.to_dict()
            s_item = UserStory(**s_data)
            s_item.tasks = tasks_by_story.get(s_item.id, [])
            stories_by_epic.setdefault(s_item.epic_id, []).append(s_item)

        epics: List[Epic] = []
        total_points = 0
        total_tasks_count = len(task_docs)
        for ed in epic_docs:
            e_data = ed.to_dict()
            e_item = Epic(**e_data)
            e_item.stories = stories_by_epic.get(e_item.id, [])
            e_item.total_points = sum(s.story_points for s in e_item.stories)
            total_points += e_item.total_points
            epics.append(e_item)

        return BacklogHierarchyResponse(
            project_id=project_id,
            epics=epics,
            total_epics=len(epics),
            total_stories=len(story_docs),
            total_tasks=total_tasks_count,
            total_points=total_points
        )

    def create_epic(self, project_id: str, title: str, description: str, origin: str) -> Epic:
        epic_id = f"epic-{uuid.uuid4().hex[:8]}"
        existing_count = len(list(db.collection("epics").where("project_id", "==", project_id).stream()))
        key = f"EPC-{existing_count + 1:02d}"
        
        epic = Epic(
            id=epic_id,
            key=key,
            project_id=project_id,
            title=title,
            description=description,
            requirement_origin=origin,
            status=ItemStatus.IN_PROGRESS
        )
        db.collection("epics").document(epic_id).set(epic.dict())
        return epic

    def create_story(self, project_id: str, epic_id: str, title: str, description: str, points: int, ac_list: List[Dict[str, str]], assignee: Optional[str] = None, origin: Optional[str] = None) -> UserStory:
        story_id = f"story-{uuid.uuid4().hex[:8]}"
        existing_count = len(list(db.collection("stories").where("project_id", "==", project_id).stream()))
        key = f"STY-{100 + existing_count + 1}"

        acs = [
            AcceptanceCriteria(
                id=f"ac-{uuid.uuid4().hex[:6]}",
                scenario=ac.get("scenario", "Standard Acceptance Criteria"),
                given=ac.get("given", ""),
                when=ac.get("when", ""),
                then=ac.get("then", "")
            )
            for ac in ac_list
        ]

        story = UserStory(
            id=story_id,
            key=key,
            project_id=project_id,
            epic_id=epic_id,
            title=title,
            description=description,
            requirement_origin=origin or f"PRD Section: {key}",
            story_points=points,
            assignee_name=assignee,
            acceptance_criteria=acs,
            status=ItemStatus.TODO
        )
        db.collection("stories").document(story_id).set(story.dict())
        return story

    def create_task(self, project_id: str, story_id: str, title: str, task_type: str, effort_days: float, assignee: Optional[str] = None, trace_ref: Optional[str] = None) -> TaskItem:
        task_id = f"task-{uuid.uuid4().hex[:8]}"
        existing_count = len(list(db.collection("tasks").where("project_id", "==", project_id).stream()))
        prefix = "QA" if task_type == "QA" else "TSK"
        key = f"{prefix}-{300 + existing_count + 1}"

        task = TaskItem(
            id=task_id,
            key=key,
            project_id=project_id,
            story_id=story_id,
            title=title,
            task_type=TaskType(task_type) if task_type in [t.value for t in TaskType] else TaskType.DEV,
            effort_days=effort_days,
            assignee_name=assignee,
            trace_ref=trace_ref or "AC-1",
            status=ItemStatus.TODO
        )
        db.collection("tasks").document(task_id).set(task.dict())
        return task

    def update_task_status(self, project_id: str, task_id: str, new_status: str) -> TaskItem:
        doc_ref = db.collection("tasks").document(task_id)
        snap = doc_ref.get()
        if not snap.exists:
            raise ValueError(f"Task {task_id} not found.")
        data = snap.to_dict()
        data["status"] = new_status
        data["updated_at"] = datetime.utcnow()
        doc_ref.update(data)
        return TaskItem(**data)
