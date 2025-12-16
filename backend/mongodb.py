# mongodb.py
import os
from typing import Optional
from pymongo import MongoClient, DESCENDING

# -------------------------------------------------------
# CONFIG
# -------------------------------------------------------
MONGO_URI = os.environ.get("MONGODB_URI")
MONGO_DB_NAME = os.environ.get("MONGODB_DB", "voiceai")

if not MONGO_URI:
    raise RuntimeError("Please set the MONGODB_URI environment variable.")

_client: Optional[MongoClient] = None

# -------------------------------------------------------
# CLIENT / DB
# -------------------------------------------------------
def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client

def get_db():
    return get_client()[MONGO_DB_NAME]

# -------------------------------------------------------
# INDEX SETUP
# -------------------------------------------------------
def ensure_indexes():
    """
    Create required indexes on startup.
    Same logic as your previous Motor-based version.
    """
    db = get_db()
    calls = db.calls

    # Unique call_id
    calls.create_index("call_id", unique=True)

    # Sort optimization
    calls.create_index([("created_at", DESCENDING)])

    # TTL auto-delete
    calls.create_index(
        "expiresAt",
        expireAfterSeconds=0
    )
