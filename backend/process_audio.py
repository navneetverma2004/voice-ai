# process_audio.py
import os
import json
import re
import openpyxl
from datetime import datetime
import subprocess

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
    return os.path.join(RESULTS_DIR, f"weekly_calls_{year}_W{week_num}.xlsx")

def get_weekly_sales_file():
    now = datetime.utcnow()
    year, week_num, _ = now.isocalendar()
    return os.path.join(RESULTS_DIR, f"weekly_sales_{year}_W{week_num}.xlsx")

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
# TRANSCRIPTION
# -----------------------------------------
def transcribe_file(filepath):
    try:
        import whisper
        model = whisper.load_model("small")
        result = model.transcribe(filepath)
        return result.get("text", "") or ""
    except Exception as e:
        print("❌ Transcription failed:", e)
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
    scores = {}
    for intent, keywords in INTENTS.items():
        score = sum(1 for k in keywords if k in text)
        if score > 0:
            scores[intent] = score
    return [max(scores, key=scores.get)] if scores else ["general_call"]

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
# LOCAL SUMMARY (SAFE FALLBACK)
# -----------------------------------------
# def local_summary(text, max_sentences=5):
    # if not text:
        # return ""
    # sentences = re.split(r'(?<=[.!?])\s+', text)
    # sentences = [s for s in sentences if len(s.strip()) > 20]
    # return " ".join(sentences[:max_sentences])
def local_summary(text):
    if not text:
        return ""

    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    summary = {
        "purpose": sentences[0] if sentences else "General inquiry.",
        "discussion": sentences[:3],
        "concerns": [],
        "actions": [],
        "outcome": []
    }

    for s in sentences:
        sl = s.lower()
        if any(k in sl for k in ["problem", "issue", "concern", "refund"]):
            summary["concerns"].append(s)
        if any(k in sl for k in ["send", "email", "schedule", "call", "follow up"]):
            summary["actions"].append(s)
        if any(k in sl for k in ["agreed", "scheduled", "confirmed"]):
            summary["outcome"].append(s)

    return f"""
Call Purpose:
- {summary['purpose']}

Key Discussion Points:
- {' '.join(summary['discussion'])}

Customer Concerns:
- {summary['concerns'][0] if summary['concerns'] else 'No major concerns expressed.'}

Agent Response:
- {' '.join(summary['actions']) if summary['actions'] else 'Agent provided information.'}

Final Outcome:
- {summary['outcome'][0] if summary['outcome'] else 'Customer agreed to review information.'}

Follow-up Required:
- {'Yes' if summary['actions'] else 'No'}
""".strip()

# def local_summary(text):
#     if not text:
#         return ""

#     t = text.lower()

#     # Remove IVR / system messages
#     ignore_phrases = [
#         "this call may be monitored",
#         "press one",
#         "press zero",
#         "thank you for calling"
#     ]

#     sentences = re.split(r'(?<=[.!?])\s+', text)
#     clean = []
#     for s in sentences:
#         if not any(p in s.lower() for p in ignore_phrases):
#             clean.append(s.strip())

#     # -------- Extract Insights --------
#     purpose = []
#     concerns = []
#     actions = []
#     outcome = []

#     for s in clean:
#         sl = s.lower()

#         if any(k in sl for k in ["calling about", "on behalf of", "we do have", "program"]):
#             purpose.append(s)

#         if any(k in sl for k in ["problem", "issue", "challenge", "concern", "refund"]):
#             concerns.append(s)

#         if any(k in sl for k in ["send", "email", "schedule", "call you", "follow up"]):
#             actions.append(s)

#         if any(k in sl for k in ["agreed", "scheduled", "will call", "next week", "confirmed"]):
#             outcome.append(s)

#     # -------- Build Executive Summary --------
#     summary = []

#     summary.append("Call Purpose:")
#     summary.append(purpose[0] if purpose else "General inquiry and information sharing.")

#     summary.append("\nKey Discussion Points:")
#     summary.append(" ".join(clean[:3]))

#     summary.append("\nCustomer Concerns:")
#     summary.append(concerns[0] if concerns else "No major concerns expressed.")

#     summary.append("\nAgent Response:")
#     summary.append(" ".join(actions[:2]) if actions else "Agent provided information and clarification.")

#     summary.append("\nFinal Outcome:")
#     summary.append(outcome[0] if outcome else "Customer agreed to review information.")

#     summary.append("\nFollow-up Required:")
#     summary.append("Follow-up call or email scheduled." if actions else "No follow-up required.")

#     return "\n".join(summary)

# -----------------------------------------
# OLLAMA SUMMARY (FIXED)
# -----------------------------------------
# def ollama_summary(text):
#     if not text.strip():
#         return ""

#     try:
#         prompt = f"""
# Summarize the following customer call:

# Call Purpose:
# Key Discussion Points:
# Customer Concerns:
# Agent Response:
# Final Outcome:

# Transcript:
# {text}
# """

#         result = subprocess.run(
#             ["ollama", "run", "llama3.1:1b"],  # ✅ LIGHT MODEL
#             input=prompt.encode("utf-8"),
#             stdout=subprocess.PIPE,
#             stderr=subprocess.PIPE,
#             timeout=60000  # ✅ INCREASED TIMEOUT
#         )

#         output = result.stdout.decode("utf-8").strip()
#         return output if output else ""

#     except subprocess.TimeoutExpired:
#         print("⚠️ Ollama timed out, using local summary")
#         return ""

#     except Exception as e:
#         print("❌ Ollama summary failed:", e)
#         return ""
def ollama_summary(text):
    """
    High-quality executive summary using Ollama
    Falls back cleanly if Ollama fails
    """

    if not text.strip():
        return ""

    prompt = f"""
You are an enterprise call analysis AI.

STRICT RULES:
- Do NOT invent information
- ONLY use facts present in the transcript
- Be concise and professional
- Use bullet points
- No filler text

OUTPUT FORMAT (MANDATORY):

Call Purpose:
- <one clear sentence>

Key Discussion Points:
- <point 1>
- <point 2>
- <point 3>

Customer Concerns:
- <concern or 'No major concerns expressed'>

Agent Response:
- <actions taken by agent>

Final Outcome:
- <result of the call>

Follow-up Required:
- <Yes/No + brief detail>

Transcript:
{text}
"""

    try:
        result = subprocess.run(
            ["ollama", "run", "llama3.1:1b"],   # You can swap to mistral/qwen
            input=prompt.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=45  # ⏱ much safer timeout
        )

        output = result.stdout.decode("utf-8").strip()

        # Basic validation
        if "Call Purpose:" not in output:
            return ""

        return output

    except subprocess.TimeoutExpired:
        print("⚠️ Ollama timeout — using local summary")
        return ""

    except Exception as e:
        print("❌ Ollama error:", e)
        return ""

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

    summary = ollama_summary(transcript) or local_summary(transcript)
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

    write_excel(EXCEL_FILE, row)
    if is_converted:
        write_excel(CONVERTED_EXCEL_FILE, row)
    if is_sales_call:
        write_excel(SALES_CRM_FILE, row)

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
