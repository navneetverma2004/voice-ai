# mongodb.py
import os
from typing import Optional
from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime

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
    client = get_client()
    return client[MONGO_DB_NAME]

# -------------------------------------------------------
# INDEX SETUP (SYNC VERSION OF YOUR OLD LOGIC)
# -------------------------------------------------------
def ensure_indexes():
    """
    Create required indexes on startup.
    Equivalent to your previous async Motor version.
    """
    db = get_db()
    calls = db.calls

    # Unique call_id (same as before)
    calls.create_index("call_id", unique=True)

    # Sort optimization
    calls.create_index([("created_at", DESCENDING)])

    # ✅ TTL auto-delete (same behavior you had)
    calls.create_index(
        "expiresAt",
        expireAfterSeconds=0
    )
