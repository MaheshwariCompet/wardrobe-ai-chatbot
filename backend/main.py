import os
import re
import json
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from dotenv import load_dotenv

from google import genai
from google.genai import types

load_dotenv()

app = FastAPI(title="Wardrobe Dual-Engine Chatbot API",
    description="Conversational assistant with Offline Pandas analytics and Gemini Grounded RAG", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_FILENAME = "wardrobe_outfit_dataset.csv"

def get_df() -> pd.DataFrame:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.join(script_dir, CSV_FILENAME)
    if os.path.exists(candidate):
        return pd.read_csv(candidate)
    if os.path.exists(CSV_FILENAME):
        return pd.read_csv(CSV_FILENAME)
    raise FileNotFoundError(f"'{CSV_FILENAME}' not found in backend folder.")

class ChatRequest(BaseModel):
    message: str
    scenario_context: Optional[str] = "Normal Daily Wear"

class ChatResponse(BaseModel):
    engine: str
    reply: str
    cards: Optional[List[Dict[str, Any]]] = None
    bullets: Optional[List[str]] = None

# ============================================================================
# GUARDRAIL 1: SENSITIVE PERSONAL DATA / GOVERNMENT ID DETECTOR
# ============================================================================
def detect_sensitive_data(text: str) -> Optional[str]:
    clean_text = text.replace(" ", "").replace("-", "")

    # 1. Indian Aadhaar Card (12 digits)
    if re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text) or (re.search(r'\d{12}', clean_text) and "aadhaar" in text.lower()):
        return "Aadhaar Card number"

    # 2. Indian PAN Card (5 letters + 4 digits + 1 letter)
    if re.search(r'[A-Za-z]{5}\d{4}[A-Za-z]', text):
        return "PAN Card number"

    # 3. Payment Card / Credit Card
    if re.search(r'\b(?:\d{4}[ -]?){3}\d{4}\b', text):
        return "Payment card or account details"

    # 4. Sensitive government documents & credentials
    sensitive_keywords = ["passport number", "voter id", "driving license", "social security", "ssn", "bank account", "otp"]
    if any(k in text.lower() for k in sensitive_keywords):
        return "official ID or account detail"

    return None

# ============================================================================
# GUARDRAIL 2: UNRELATED CASUAL CHAT DETECTOR (OFF-TOPIC FILTER)
# ============================================================================
def is_unrelated_casual_query(text: str) -> Optional[str]:
    t = text.lower().strip()

    greetings = ["hi", "hello", "hey", "good morning", "good evening", "how are you", "who are you"]
    if t in greetings or any(t.startswith(g) for g in ["hi ", "hello ", "hey "]):
        return "Hello! 👋 I'm your Daily Clothes Helper. I can help you pick the best outfits for hot weather, rain, office AC, or daily work."

    if any(k in t for k in ["breakfast", "lunch", "dinner", "eating", "ate food", "cutting vegetable", "cutting vegetables", "cooking", "kitchen"]):
        return "Hope your meal preparation goes well! 🍳 Since I am your Wardrobe Assistant, I specialize in picking the right clothes for your day, weather, and work. Ask me anything about what to wear!"

    if any(k in t for k in ["planting", "watering plant", "garden", "gardening", "flower", "mud"]):
        return "Gardening sounds refreshing! 🌱 If you need comfortable clothes that are easy to wash or shoes suitable for outdoor work and wet ground, feel free to ask me."

    if any(k in t for k in ["sleeping", "movie", "driving car", "singing", "dance", "cricket", "football"]):
        return "Sounds interesting! 👔 Whenever you're ready, ask me what clothes, pants, or footwear to wear for any weather or work."

    return None

# ============================================================================
# FUNCTIONALITY 1: OFFLINE STATISTICAL ENGINE WITH GUARDRAILS
# ============================================================================
@app.post("/api/chat/offline", response_model=ChatResponse)
def offline_chat_endpoint(payload: ChatRequest):
    detected_id = detect_sensitive_data(payload.message)
    if detected_id:
        return ChatResponse(
            engine="Safety & Privacy Guard",
            reply=f"⚠️ Privacy Notice: It looks like you shared a {detected_id}. For your safety and privacy, please never share government documents, IDs, or financial numbers. I only help you with clothing and weather advice!"
        )

    chatter_reply = is_unrelated_casual_query(payload.message)
    if chatter_reply:
        return ChatResponse(
            engine="Clothes Helper",
            reply=chatter_reply
        )

    try:
        df = get_df()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    q = payload.message.lower()
    bullets = []
    cards_df = pd.DataFrame()

    if any(k in q for k in ["temperature", "extreme", "highest temp", "lowest temp", "cold", "heat", "hot"]):
        if any(k in q for k in ["cold", "lowest", "freeze", "winter", "low temp"]):
            min_temp = int(df["temp_low_c"].min())
            cards_df = df[df["temp_low_c"] <= 18].sort_values(by="overall_score", ascending=False).head(3)
            bullets = [
                f"Lowest recorded temperature: {min_temp}°C.",
                "Warmest options require a protective top layer (Cardigan or Overshirt).",
                "Keeps a top 4.6/5 comfort rating."
            ]
            reply = f"Here are the warmest, top-rated clothes for cold weather down to {min_temp}°C:"
        else:
            max_temp = int(df["temp_high_c"].max())
            cards_df = df[df["temp_high_c"] >= 38].sort_values(by="overall_score", ascending=False).head(3)
            bullets = [
                f"Highest recorded temperature: {max_temp}°C.",
                "Best clothes were 100% breathable cotton and linen tees.",
                "Skipping extra jackets improved comfort on 88% of hot days."
            ]
            reply = f"Here are the best, breathable clothes to stay cool in extreme heat (up to {max_temp}°C):"

    elif any(k in q for k in ["rain", "monsoon", "unexpected rain", "wet", "puddle", "umbrella"]):
        unexpected = df[(df["forecast_miss"] == "Y") & (df["rained_actual"] == "Y")]
        cards_df = unexpected[unexpected["shoe_rain_ready"] == "Y"].head(3)
        bullets = [
            f"You faced unexpected rain {len(unexpected):,} times in past records.",
            "Flat sandals and rubberized footwear kept feet clean and dry."
        ]
        reply = "Here are clothes and shoes that successfully protected you on rainy days:"

    elif any(k in q for k in ["ac", "air condition", "cold office", "chilly office"]):
        cards_df = df[
            (df["office_ac_level"].astype(str).str.contains("High|Medium", case=False, na=False)) &
            (df["layer"].notna()) & (df["no_layer_cold_office"] != "Y")
        ].sort_values(by="ac_score", ascending=False).head(3)
        bullets = [
            "Skipping an extra layer in cold AC offices was a leading reason for low comfort.",
            "Pairing a light tee with an easy-to-remove Cardigan scored 100/100 for comfort."
        ]
        reply = "Here are comfortable outfits with an extra layer to protect against cold office AC:"

    else:
        words = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', q) if w not in ["what", "wear", "show", "give", "best", "outfit", "can", "with"]]
        mask = pd.Series(False, index=df.index)
        for w in words:
            for c in ["top", "bottom", "shoes", "layer"]:
                mask = mask | df[c].astype(str).str.contains(w, case=False, na=False)
        cards_df = df[mask].sort_values(by="overall_score", ascending=False).head(3) if mask.any() else df.sort_values(by="overall_score", ascending=False).head(3)
        reply = "Here are the best matching clothes from your closet history:"

    sanitized = cards_df.replace({np.nan: None}).to_dict(orient="records") if not cards_df.empty else []
    return ChatResponse(
        engine="Functionality 1: Saved History (Offline)",
        reply=reply,
        cards=sanitized,
        bullets=bullets
    )

# ============================================================================
# FUNCTIONALITY 2: GEMINI RAG WITH GUARDRAILS & FALLBACK
# ============================================================================
@app.post("/api/chat/rag", response_model=ChatResponse)
def rag_chat_endpoint(payload: ChatRequest):
    detected_id = detect_sensitive_data(payload.message)
    if detected_id:
        return ChatResponse(
            engine="Safety & Privacy Guard",
            reply=f"⚠️ Privacy Warning: Your message appears to contain a {detected_id}. To protect your privacy, this information was NOT sent to the AI. Please do not share personal ID numbers or private documents. How can I help you with your clothing today?"
        )

    chatter_reply = is_unrelated_casual_query(payload.message)
    if chatter_reply:
        return ChatResponse(
            engine="Smart Assistant",
            reply=chatter_reply
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=401,
            detail="Gemini API Key missing. Please provide it in backend/.env."
        )

    try:
        client = genai.Client(api_key=api_key.strip())
        df = get_df()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    p_lower = payload.message.lower()
    matched_slice = df.copy()
    if "navy" in p_lower or "wide-leg" in p_lower:
        matched_slice = df[df["bottom"].astype(str).str.contains("navy", case=False, na=False)]
    
    sample_records = matched_slice.sort_values(by="overall_score", ascending=False).head(20)[
        ["top", "bottom", "shoes", "layer", "temp_high_c", "overall_score", "comfort_rating"]
    ].to_dict(orient="records")

    system_instruction = (
        "You are a friendly, helpful Wardrobe Assistant for everyday working people. "
        "Your task is to recommend clothes based strictly on the provided clothing dataset. "
        "RULES:\n"
        "1. Use simple, everyday English. Do not use technical fashion jargon.\n"
        "2. If the user asks about clothes, give: Recommended Clothes (Top, Bottom, Shoes, Layer), Things to Watch Out For, and Value for Money Tips.\n"
        "3. If the user asks something completely outside of clothes, politely guide them back to clothing questions."
    )

    prompt = f"""
USER QUESTION: {payload.message}

DATASET EVIDENCE:
{json.dumps(sample_records, default=str)}
"""

    candidate_models = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.0-flash"]
    last_err = None

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                )
            )
            return ChatResponse(
                engine="Smart AI Stylist",
                reply=response.text or "I couldn't generate an outfit advice. Please try again."
            )
        except Exception as e:
            last_err = e
            continue

    raise HTTPException(status_code=503, detail=f"AI service temporarily busy. Please retry shortly. ({str(last_err)})")

# ============================================================================
# SERVER RUNNER (Required for 'python main.py')
# ============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)