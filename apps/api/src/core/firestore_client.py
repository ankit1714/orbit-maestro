import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from apps.api.src.core.config import settings

logger = logging.getLogger("firestore_client")

def _json_serial(obj):
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

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
    def __init__(self, name: str, service: "FirestoreService"):
        self.name = name
        self.service = service

    def document(self, doc_id: Optional[str] = None):
        return MockDocumentReference(self.name, doc_id, self.service)

    def add(self, data: Dict[str, Any]):
        import uuid
        doc_id = str(uuid.uuid4())
        ref = self.document(doc_id)
        ref.set(data)
        return None, ref

    def where(self, field: str, op: str, value: Any):
        return MockQuery(self.name, self.service._in_memory_store, [(field, op, value)])

    def order_by(self, field: str, direction: str = "ASCENDING"):
        return MockQuery(self.name, self.service._in_memory_store, [], order_by_field=field, direction=direction)

    def stream(self):
        col_data = self.service._in_memory_store.get(self.name, {})
        for doc_id, data in list(col_data.items()):
            yield MockDocumentSnapshot(doc_id, data)

class MockDocumentReference:
    def __init__(self, col_name: str, doc_id: Optional[str], service: "FirestoreService"):
        import uuid
        self.col_name = col_name
        self.id = doc_id or str(uuid.uuid4())
        self.service = service

    def get(self) -> MockDocumentSnapshot:
        col = self.service._in_memory_store.get(self.col_name, {})
        data = col.get(self.id)
        return MockDocumentSnapshot(self.id, data)

    def set(self, data: Dict[str, Any], merge: bool = False):
        if self.col_name not in self.service._in_memory_store:
            self.service._in_memory_store[self.col_name] = {}
        if merge and self.id in self.service._in_memory_store[self.col_name]:
            self.service._in_memory_store[self.col_name][self.id].update(data)
        else:
            self.service._in_memory_store[self.col_name][self.id] = data.copy()
        self.service.save()

    def update(self, data: Dict[str, Any]):
        if self.col_name in self.service._in_memory_store and self.id in self.service._in_memory_store[self.col_name]:
            self.service._in_memory_store[self.col_name][self.id].update(data)
        else:
            self.set(data)
        self.service.save()

    def delete(self):
        if self.col_name in self.service._in_memory_store and self.id in self.service._in_memory_store[self.col_name]:
            del self.service._in_memory_store[self.col_name][self.id]
            self.service.save()

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
        for doc_id, data in list(col.items()):
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
            results.sort(key=lambda x: str(x[1].get(self.order_by_field, "")), reverse=reverse)

        if self.limit_val is not None:
            results = results[:self.limit_val]

        for doc_id, data in results:
            yield MockDocumentSnapshot(doc_id, data)

class FirestoreService:
    def __init__(self):
        self._is_live = False
        self._live_client = None
        self._in_memory_store: Dict[str, Dict[str, Any]] = {}

        # Set persistent storage path for local file-backed mode
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "..", "data"))
        os.makedirs(data_dir, exist_ok=True)
        self._db_file = os.path.join(data_dir, "local_firestore.json")

        # Load existing data from file if present
        self.load()

        # Check if explicitly testing or offline mock
        if os.getenv("TESTING", "").lower() in ("true", "1", "yes") or os.getenv("FIRESTORE_MOCK", "").lower() in ("true", "1", "yes"):
            self._is_live = False
            logger.info("Using local persistent file-backed Firestore database (TESTING mode).")
            return

        # Attempt to initialize live Google Cloud Firestore if credentials or emulator exist
        try:
            from google.cloud import firestore
            target_project = settings.PROJECT_ID
            database = getattr(settings, "FIRESTORE_DATABASE", "(default)")

            if os.getenv("FIRESTORE_EMULATOR_HOST"):
                self._live_client = firestore.Client(project=target_project, database=database)
                self._is_live = True
                logger.info(f"Connected to Firestore emulator (project: {target_project}).")
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("K_SERVICE"):
                self._live_client = firestore.Client(project=target_project, database=database)
                self._is_live = True
                logger.info(f"Connected to live Google Cloud Firestore (project: {target_project}).")
            else:
                try:
                    import google.auth
                    creds, proj = google.auth.default()
                    target_project = settings.PROJECT_ID if settings.PROJECT_ID else proj
                    self._live_client = firestore.Client(project=target_project, credentials=creds, database=database)
                    self._is_live = True
                    logger.info(f"Connected to live Google Cloud Firestore via ADC (project: {target_project}).")
                except Exception as inner_e:
                    logger.warning(f"Could not connect via ADC: {inner_e}")
                    self._is_live = False
                    logger.info("Using local persistent file-backed Firestore database.")
        except Exception as e:
            logger.warning(f"Using local persistent file-backed Firestore database: {e}")
            self._is_live = False

    def load(self):
        if os.path.exists(self._db_file):
            try:
                with open(self._db_file, "r", encoding="utf-8") as f:
                    self._in_memory_store = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load local DB file: {e}")
                self._in_memory_store = {}
        else:
            self._in_memory_store = {}

    def save(self):
        if self._is_live:
            return
        try:
            with open(self._db_file, "w", encoding="utf-8") as f:
                json.dump(self._in_memory_store, f, indent=2, default=_json_serial)
        except Exception as e:
            logger.warning(f"Could not save local DB file: {e}")

    def clear_all(self):
        """Clears all stored collections and wipes the local storage file."""
        self._in_memory_store = {}
        self.save()
        logger.info("Cleared all collections in local Firestore database.")

    def collection(self, name: str):
        if self._is_live and self._live_client:
            return self._live_client.collection(name)
        return MockCollectionReference(name, self)

    @property
    def is_live(self) -> bool:
        return self._is_live

db = FirestoreService()
