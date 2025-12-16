# server.py
import os
import time
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from process_audio import process_uploaded_audio
import mongodb

# -------------------------------------------------------
# APP
# -------------------------------------------------------
app = FastAPI(
    title="Voice AI Backend",
    description="Audio processing backend using FastAPI + MongoDB",
    version="1.0.1"
)

# -------------------------------------------------------
# CORS
# -------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------
# STARTUP
# -------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    try:
        db = mongodb.get_db()
        await db.command("ping")
        print("✅ MongoDB Connected")

        # Auto-delete after expiry
        await db.calls.create_index("expiresAt", expireAfterSeconds=0)
    except Exception as e:
        print("❌ MongoDB NOT Connected:", e)

# -------------------------------------------------------
# WEEK START (MONDAY 00:00 UTC)
# -------------------------------------------------------
def start_of_current_week():
    now = datetime.utcnow()
    start = now - timedelta(days=now.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)

# -------------------------------------------------------
# PROCESS AUDIO
# -------------------------------------------------------
@app.post("/process-audio")
async def process_audio_api(file: UploadFile = File(...)):
    temp_path = None
    try:
        timestamp = int(time.time() * 1000)
        temp_path = f"temp_{timestamp}_{file.filename}"

        with open(temp_path, "wb") as f:
            f.write(await file.read())

        # Run CPU-heavy work in threadpool
        result = await run_in_threadpool(process_uploaded_audio, temp_path)

        now = datetime.utcnow()
        call_id = f"call_{timestamp}"

        doc = {
            "call_id": call_id,
            "customer_id": result.get("customer_id", "NA"),
            "sentiment": str(result.get("sentiment", "neutral")).lower(),
            "emotion": result.get("emotion"),
            "summary": result.get("summary"),
            "transcript": result.get("transcript"),
            "tags": list(set(result.get("intents", []))),
            "analysis": result.get("analysis", {}),
            "created_at": now,
            "expiresAt": now + timedelta(days=30)
        }

        db = mongodb.get_db()
        await db.calls.insert_one(doc)

        return {"status": "ok", "call_id": call_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# -------------------------------------------------------
# SUMMARY STATS
# -------------------------------------------------------
@app.get("/stats/summary")
async def get_summary():
    db = mongodb.get_db()

    total_calls = await db.calls.count_documents({})
    positive_calls = await db.calls.count_documents({"sentiment": "positive"})

    rate = round((positive_calls / total_calls) * 100, 2) if total_calls else 0

    return {
        "total_calls": total_calls,
        "positive_calls": positive_calls,
        "conversion_rate": rate
    }

# -------------------------------------------------------
# WEEKLY STATS + TRENDING TOPICS (FIXED)
# -------------------------------------------------------
@app.get("/stats/weekly")
async def get_weekly_stats():
    db = mongodb.get_db()
    start_week = start_of_current_week()
    now = datetime.utcnow()

    total = await db.calls.count_documents({"created_at": {"$gte": start_week}})
    positive = await db.calls.count_documents({
        "created_at": {"$gte": start_week},
        "sentiment": "positive"
    })

    rate = round((positive / total) * 100, 2) if total else 0

    pipeline = [
        {"$match": {"created_at": {"$gte": start_week}}},
        {"$project": {"unique_tags": {"$setUnion": ["$tags", []]}}},
        {"$unwind": "$unique_tags"},
        {"$group": {"_id": "$unique_tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]

    topics = await db.calls.aggregate(pipeline).to_list(length=10)

    return {
        "period": "current_week",
        "week_start": start_week.isoformat() + "Z",
        "week_end": now.isoformat() + "Z",
        "total_calls": total,
        "positive_calls": positive,
        "conversion_rate": rate,
        "topics": topics
    }

# -------------------------------------------------------
# CALL LIST (CURRENT WEEK)
# -------------------------------------------------------
@app.get("/calls")
async def get_calls(limit: int = 50, skip: int = 0):
    db = mongodb.get_db()
    start_week = start_of_current_week()

    cursor = (
        db.calls.find({"created_at": {"$gte": start_week}})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    results = []
    async for doc in cursor:
        doc["_id"] = None
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat() + "Z"
        results.append(doc)

    return results

# -------------------------------------------------------
# SINGLE CALL
# -------------------------------------------------------
@app.get("/calls/{call_id}")
async def get_call(call_id: str):
    db = mongodb.get_db()
    doc = await db.calls.find_one({"call_id": call_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Call not found")

    doc["_id"] = None
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat() + "Z"

    return doc

# -------------------------------------------------------
# CALLS BY TOPIC
# -------------------------------------------------------
@app.get("/calls/topic/{topic_name}")
async def get_calls_by_topic(topic_name: str):
    db = mongodb.get_db()
    start_week = start_of_current_week()

    cursor = db.calls.find({
        "created_at": {"$gte": start_week},
        "tags": topic_name
    }).sort("created_at", -1)

    results = []
    async for doc in cursor:
        doc["_id"] = None
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat() + "Z"
        results.append(doc)

    return {
        "topic": topic_name,
        "count": len(results),
        "calls": results
    }

# -------------------------------------------------------
# RUN (RENDER SAFE)
# -------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port
    )
