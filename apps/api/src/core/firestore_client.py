import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from apps.api.src.core.config import settings

logger = logging.getLogger("firestore_client")

class MockDocumentSnapshot:
    def __init__(self, doc_id: str, data: Dict[str, Any]):
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> Dict[str, Any]:
        return self._data.copy() if self._data else {}

class MockCollectionReference:
    def __init__(self, name: str, storage: Dict[str, Dict[str, Any]]):
        self.name = name
        self.storage = storage

    def document(self, doc_id: Optional[str] = None):
        return MockDocumentReference(self.name, doc_id, self.storage)

    def add(self, data: Dict[str, Any]):
        import uuid
        doc_id = str(uuid.uuid4())
        self.document(doc_id).set(data)
        return None, MockDocumentReference(self.name, doc_id, self.storage)

    def where(self, field: str, op: str, value: Any):
        return MockQuery(self.name, self.storage, [(field, op, value)])

    def order_by(self, field: str, direction: str = "ASCENDING"):
        return MockQuery(self.name, self.storage, [], order_by_field=field, direction=direction)

    def stream(self):
        col_data = self.storage.get(self.name, {})
        for doc_id, data in col_data.items():
            yield MockDocumentSnapshot(doc_id, data)

class MockDocumentReference:
    def __init__(self, col_name: str, doc_id: Optional[str], storage: Dict[str, Dict[str, Any]]):
        import uuid
        self.col_name = col_name
        self.id = doc_id or str(uuid.uuid4())
        self.storage = storage

    def get(self) -> MockDocumentSnapshot:
        col = self.storage.get(self.col_name, {})
        data = col.get(self.id)
        return MockDocumentSnapshot(self.id, data)

    def set(self, data: Dict[str, Any], merge: bool = False):
        if self.col_name not in self.storage:
            self.storage[self.col_name] = {}
        if merge and self.id in self.storage[self.col_name]:
            self.storage[self.col_name][self.id].update(data)
        else:
            self.storage[self.col_name][self.id] = data.copy()

    def update(self, data: Dict[str, Any]):
        if self.col_name in self.storage and self.id in self.storage[self.col_name]:
            self.storage[self.col_name][self.id].update(data)
        else:
            self.set(data)

    def delete(self):
        if self.col_name in self.storage and self.id in self.storage[self.col_name]:
            del self.storage[self.col_name][self.id]

class MockQuery:
    def __init__(self, col_name: str, storage: Dict[str, Dict[str, Any]], filters: List[tuple], order_by_field: Optional[str] = None, direction: str = "ASCENDING", limit_val: Optional[int] = None):
        self.col_name = col_name
        self.storage = storage
        self.filters = filters
        self.order_by_field = order_by_field
        self.direction = direction
        self.limit_val = limit_val

    def where(self, field: str, op: str, value: Any):
        new_filters = list(self.filters)
        new_filters.append((field, op, value))
        return MockQuery(self.col_name, self.storage, new_filters, self.order_by_field, self.direction, self.limit_val)

    def order_by(self, field: str, direction: str = "ASCENDING"):
        return MockQuery(self.col_name, self.storage, self.filters, order_by_field=field, direction=direction, limit_val=self.limit_val)

    def limit(self, count: int):
        return MockQuery(self.col_name, self.storage, self.filters, self.order_by_field, self.direction, limit_val=count)

    def stream(self):
        col = self.storage.get(self.col_name, {})
        results = []
        for doc_id, data in col.items():
            matches = True
            for field, op, val in self.filters:
                doc_val = data.get(field)
                if op == "==" and doc_val != val:
                    matches = False
                    break
                elif op == "!=" and doc_val == val:
                    matches = False
                    break
                elif op == "in" and doc_val not in val:
                    matches = False
                    break
                elif op == ">" and not (doc_val is not None and doc_val > val):
                    matches = False
                    break
                elif op == "<" and not (doc_val is not None and doc_val < val):
                    matches = False
                    break
            if matches:
                results.append((doc_id, data))

        if self.order_by_field:
            reverse = (self.direction == "DESCENDING")
            results.sort(key=lambda x: x[1].get(self.order_by_field, ""), reverse=reverse)

        if self.limit_val is not None:
            results = results[:self.limit_val]

        for doc_id, data in results:
            yield MockDocumentSnapshot(doc_id, data)

class FirestoreService:
    def __init__(self):
        self._is_live = False
        self._live_client = None
        self._in_memory_store: Dict[str, Dict[str, Any]] = {}

        # Attempt to initialize live Google Cloud Firestore if ADC or credentials exist
        try:
            from google.cloud import firestore
            # Check if environment is configured for real GCP
            if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("K_SERVICE"):
                self._live_client = firestore.Client(project=settings.PROJECT_ID)
                self._is_live = True
                logger.info("Connected to live Google Cloud Firestore.")
        except Exception as e:
            logger.info(f"Using local in-memory Firestore simulator: {e}")
            self._is_live = False

    def collection(self, name: str):
        if self._is_live and self._live_client:
            return self._live_client.collection(name)
        return MockCollectionReference(name, self._in_memory_store)

    @property
    def is_live(self) -> bool:
        return self._is_live

db = FirestoreService()
