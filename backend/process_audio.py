# process_audio.py
import os
import json
import re
import time
import openpyxl
from datetime import datetime

# -----------------------------------------
# CONFIG
# -----------------------------------------
TRANSCRIPT_DIR = "transcripts"
RESULTS_DIR = "results"

EXCEL_FILE = os.path.join(RESULTS_DIR, "analytics_results.xlsx")
CONVERTED_EXCEL_FILE = os.path.join(RESULTS_DIR, "converted_calls.xlsx")
SALES_CRM_FILE = os.path.join(RESULTS_DIR, "sales_crm.xlsx")

# -----------------------------------------
# WEEKLY FILE HELPERS
# -----------------------------------------
def get_weekly_excel_file():
    now = datetime.utcnow()
    year, week_num, _ = now.isocalendar()
    filename = f"weekly_calls_{year}_W{week_num}.xlsx"
    return os.path.join(RESULTS_DIR, filename)

def get_weekly_sales_file():
    now = datetime.utcnow()
    year, week_num, _ = now.isocalendar()
    filename = f"weekly_sales_{year}_W{week_num}.xlsx"
    return os.path.join(RESULTS_DIR, filename)

# -----------------------------------------
# HELPERS
# -----------------------------------------
def _now_ts():
    return datetime.utcnow().isoformat() + "Z"

def safe_write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text or "")
    return path

def write_excel(path, row):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    new_file = not os.path.exists(path)

    wb = openpyxl.Workbook() if new_file else openpyxl.load_workbook(path)
    ws = wb.active

    if new_file:
        ws.append(list(row.keys()))

    ws.append(list(row.values()))
    wb.save(path)

# -----------------------------------------
# TRANSCRIPTION (FAST + CACHED)
# -----------------------------------------
_WHISPER_MODEL = None

def transcribe_file(filepath):
    global _WHISPER_MODEL
    try:
        import whisper
        if _WHISPER_MODEL is None:
            # small = best balance for Render
            _WHISPER_MODEL = whisper.load_model("small")

        result = _WHISPER_MODEL.transcribe(filepath)
        return result.get("text", "") or ""
    except Exception as e:
        print("Transcription failed:", e)
        return ""

# -----------------------------------------
# HINDI NORMALIZATION
# -----------------------------------------
HINDI_MAP = {
    "paisa": "money",
    "refund chahiye": "refund",
    "daam": "price",
    "khareedna": "buy",
    "booking": "booking",
    "delivery": "delivery",
}

def normalize_language(text):
    t = text.lower()
    for hi, en in HINDI_MAP.items():
        t = t.replace(hi, en)
    return t

# -----------------------------------------
# INTENT DETECTION
# -----------------------------------------
INTENTS = {
    "real_estate_sales": ["property", "flat", "villa", "floor plan"],
    "software_sales": ["software", "subscription", "demo"],
    "insurance_sales": ["insurance", "policy", "premium"],
    "automobile_sales": ["car", "vehicle", "test drive"],
    "generic_sales": ["buy", "purchase", "order"],
}

def detect_intents(text):
    intent_scores = {}
    for intent, keywords in INTENTS.items():
        score = sum(1 for k in keywords if k in text)
        if score > 0:
            intent_scores[intent] = score

    if not intent_scores:
        return ["general_call"]

    return [max(intent_scores, key=intent_scores.get)]

# -----------------------------------------
# SENTIMENT
# -----------------------------------------
def analyze_sentiment(text):
    t = text.lower()
    pos = len(re.findall(r"(good|great|happy|resolved|thank)", t))
    neg = len(re.findall(r"(bad|angry|problem|issue|refund)", t))

    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"

# -----------------------------------------
# FAST LOCAL SUMMARY (NO OLLAMA)
# -----------------------------------------
def local_summary(text, max_sentences=5):
    if not text:
        return ""

    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    summary = sentences[:max_sentences]
    return " ".join(summary)

# -----------------------------------------
# MAIN
# -----------------------------------------
def process_uploaded_audio(audio_path):
    filename = os.path.basename(audio_path)
    base = os.path.splitext(filename)[0]

    transcript = transcribe_file(audio_path)
    safe_write(os.path.join(TRANSCRIPT_DIR, base + ".txt"), transcript)

    normalized = normalize_language(transcript)
    intents = detect_intents(normalized)

    summary = local_summary(transcript)
    sentiment = analyze_sentiment(transcript)

    conversion_words = ["purchase", "order", "buy", "confirmed"]
    is_converted = any(w in normalized for w in conversion_words)
    is_sales_call = any(i.endswith("_sales") for i in intents)

    row = {
        "file": filename,
        "call_id": base,
        "processed_at": _now_ts(),
        "summary": summary,
        "sentiment": sentiment,
        "intents": json.dumps(intents),
        "converted": is_converted,
    }

    # MASTER FILES
    write_excel(EXCEL_FILE, row)

    if is_converted:
        write_excel(CONVERTED_EXCEL_FILE, row)

    if is_sales_call:
        write_excel(SALES_CRM_FILE, row)

    # WEEKLY FILES
    write_excel(get_weekly_excel_file(), row)

    if is_sales_call:
        write_excel(get_weekly_sales_file(), row)

    return {
        "call_id": base,
        "transcript": transcript,
        "summary": summary,
        "sentiment": sentiment,
        "intents": intents,
        "converted": is_converted,
        "sales_call": is_sales_call,
    }

if __name__ == "__main__":
    print("process_audio.py ready ✔")
