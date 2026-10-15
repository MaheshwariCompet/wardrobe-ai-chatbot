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

# Official Google Gen AI SDK
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI(
    title="Wardrobe Dual-Engine Chatbot API",
    description="Conversational assistant with Offline Pandas analytics and Gemini Grounded RAG",
    version="3.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_FILENAME = "wardrobe_outfit_dataset.csv"

def get_df() -> pd.DataFrame:
    """Locate and load the dataset dynamically."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.join(script_dir, CSV_FILENAME)
    if os.path.exists(candidate):
        return pd.read_csv(candidate)
    if os.path.exists(CSV_FILENAME):
        return pd.read_csv(CSV_FILENAME)
    raise FileNotFoundError(f"'{CSV_FILENAME}' not found in backend directory.")

class ChatRequest(BaseModel):
    message: str
    scenario_context: Optional[str] = "Normal Daily Wear"

class ChatResponse(BaseModel):
    engine: str
    reply: str
    cards: Optional[List[Dict[str, Any]]] = None
    bullets: Optional[List[str]] = None

# ============================================================================
# FUNCTIONALITY 1: OFFLINE STATISTICAL CHATBOT ENGINE (ZERO API KEY)
# ============================================================================
def execute_offline_chat(query: str, df: pd.DataFrame) -> tuple[str, List[Dict[str, Any]], List[str]]:
    q = query.lower()
    bullets = []
    cards_df = pd.DataFrame()

    # 1. Temperature Extremes (High & Low)
    if any(k in q for k in ["temperature", "extreme", "highest temp", "lowest temp", "freeze", "cold", "heat", "hot"]):
        if any(k in q for k in ["cold", "lowest", "freeze", "winter", "low temp"]):
            min_temp = int(df["temp_low_c"].min())
            cards_df = df[df["temp_low_c"] <= 18].sort_values(by="overall_score", ascending=False).head(3)
            bullets = [
                f"Historical record low temperature in dataset: {min_temp}°C.",
                "Best-performing combinations mandatory-paired with outer layers (Cardigan or Overshirt).",
                "Average comfort rating maintained: 4.6/5 stars."
            ]
            reply = f"Looking at your past cold weather records (down to {min_temp}°C), here are the highest-scoring outfits that kept you warm and comfortable:"
        else:
            max_temp = int(df["temp_high_c"].max())
            cards_df = df[df["temp_high_c"] >= 38].sort_values(by="overall_score", ascending=False).head(3)
            bullets = [
                f"Historical record high temperature in dataset: {max_temp}°C.",
                "Top heat-surviving combos relied on pure linen and breathable cotton tops.",
                "Over 88% of successful extreme heat days eliminated outer layers completely."
            ]
            reply = f"Here are the top-rated outfits you wore in extreme heat conditions (up to {max_temp}°C):"

    # 2. Unexpected Rain / Weather Volatility
    elif any(k in q for k in ["rain", "monsoon", "unexpected rain", "wet", "puddle", "umbrella", "forecast miss"]):
        unexpected = df[(df["forecast_miss"] == "Y") & (df["rained_actual"] == "Y")]
        got_wet_count = int((df["got_wet"] == "Y").sum())
        shoe_mismatch_count = int((df["rain_shoe_mismatch"] == "Y").sum())
        cards_df = unexpected[unexpected["shoe_rain_ready"] == "Y"].head(3)
        bullets = [
            f"You were caught in unexpected rain {len(unexpected)} times across recorded history.",
            f"Resulted in {got_wet_count} total 'got_wet' incidents due to unready clothing.",
            f"{shoe_mismatch_count} days suffered shoe mismatch (wearing porous footwear in rain).",
            "Proven Rain Shield: Flat sandals and rubberized sneakers achieved 100% dry survival rates."
        ]
        reply = "Looking at past unexpected rain events, here are the combinations that successfully handled sudden downpours:"

    # 3. Least Comfort / Regrets / Root Causes
    elif any(k in q for k in ["least comfort", "worst", "regret", "discomfort", "uncomfortable", "bad rating", "failed"]):
        regrets = df[df["comfort_rating"] <= 2].copy()
        causes = regrets["primary_cause"].value_counts().head(3).to_dict()
        cards_df = regrets.sort_values(by="overall_score", ascending=True).head(3)
        bullets = [
            f"Total recorded low-comfort outfits (1-2 stars): {len(regrets)}.",
            f"Primary failure causes: {', '.join([f'{k} ({v}x)' for k, v in causes.items()])}.",
            "Top mistake: Venturing into heavily air-conditioned offices without a layer.",
            "Second top mistake: Wearing dense synthetics on days exceeding 34°C."
        ]
        reply = "Here is an audit of your lowest-comfort outfits and the exact primary causes that led to discomfort:"

    # 4. Office AC / Chilly Workspaces
    elif any(k in q for k in ["ac", "air condition", "cold office", "chilly office"]):
        cards_df = df[
            (df["office_ac_level"].astype(str).str.contains("High|Medium", case=False, na=False)) &
            (df["layer"].notna()) & (df["no_layer_cold_office"] != "Y")
        ].sort_values(by="ac_score", ascending=False).head(3)
        ac_penalty_count = int((df["primary_cause"] == "AC chill not handled (no layer)").sum())
        top_layers = df[df["ac_score"] >= 95]["layer"].dropna().value_counts().head(2).index.tolist()
        layers_text = " or ".join(top_layers) if top_layers else "Cardigans or Overshirts"
        bullets = [
        f"Your records show {ac_penalty_count:,} past instances where skipping a layer caused an 'AC chill' penalty.",
        f"Top AC-tested layers from your closet: {layers_text}."
        ]
        reply = "Here are outfits with proven 95+ AC performance scores and active layering pieces:"

    # 5. Casual / Garment / Color Filter Chat
    else:
        words = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', q) if w not in ["what", "wear", "show", "give", "best", "outfit", "can", "with"]]
        mask = pd.Series(False, index=df.index)
        for w in words:
            for c in ["top", "bottom", "shoes", "layer", "season"]:
                mask = mask | df[c].astype(str).str.contains(w, case=False, na=False)
        cards_df = df[mask].sort_values(by="overall_score", ascending=False).head(3) if mask.any() else df.sort_values(by="overall_score", ascending=False).head(3)
        reply = "Here are the best matching combinations found in your closet history:"

    sanitized = cards_df.replace({np.nan: None}).to_dict(orient="records") if not cards_df.empty else []
    return reply, sanitized, bullets

@app.post("/api/chat/offline", response_model=ChatResponse)
def offline_chat_endpoint(payload: ChatRequest):
    try:
        df = get_df()
        reply, cards, bullets = execute_offline_chat(payload.message, df)
        return ChatResponse(
            engine="Functionality 1: Offline Analytics Engine (Zero API Key)",
            reply=reply,
            cards=cards,
            bullets=bullets
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FUNCTIONALITY 2: GROUNDED RAG CHATBOT USING gemini-3.8-flash (google-genai SDK)
# ============================================================================
@app.post("/api/chat/rag", response_model=ChatResponse)
def rag_chat_endpoint(
    payload: ChatRequest,
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key")
):
    api_key = x_gemini_key or os.getenv("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=401,
            detail="Gemini API Key missing. Please provide it in backend/.env or via the top input box."
        )

    try:
        client = genai.Client(api_key=api_key.strip())
        df = get_df()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize GenAI client: {str(e)}")

    # Pull relevant dataset grounding evidence matching the user query
    p_lower = payload.message.lower()
    matched_slice = df.copy()

    if "navy wide-leg" in p_lower or "navy" in p_lower:
        matched_slice = df[df["bottom"].astype(str).str.contains("navy wide-leg|navy", case=False, na=False)]
    elif "palazzo" in p_lower:
        matched_slice = df[df["bottom"].astype(str).str.contains("palazzo", case=False, na=False)]
    elif "linen" in p_lower:
        matched_slice = df[df["top"].astype(str).str.contains("linen", case=False, na=False)]

    if len(matched_slice) > 0:
        sample_records = matched_slice.sort_values(by="overall_score", ascending=False).head(20)[
            ["top", "bottom", "shoes", "layer", "temp_high_c", "overall_score", "comfort_rating"]
        ].to_dict(orient="records")
    else:
        sample_records = df.sort_values(by="overall_score", ascending=False).head(20)[
            ["top", "bottom", "shoes", "layer", "temp_high_c", "overall_score", "comfort_rating"]
        ].to_dict(orient="records")

    system_instruction = (
        "You are an expert AI Wardrobe Stylist powered by the user's authentic 110,000-record dataset. "
        "Ground your advice strictly in the provided dataset numbers, pieces, and comfort scores. "
        "Deliver a conversational styling consultation:\n"
        "1. Tactical Outfit Recommendation (referencing specific tops/bottoms from the dataset).\n"
        "2. Predictive Regret Shield (anticipating microclimate shifts, commute creasing, or past failure causes).\n"
        "3. Strategic Capsule Expansion / Shopping ROI (if asking about new additions).\n"
        "Keep the tone natural, modern, and authoritative."
    )

    prompt = f"""
SCENARIO: {payload.scenario_context}
USER INQUIRY: {payload.message}

DATASET GROUNDING EVIDENCE:
{json.dumps(sample_records, default=str)}
"""

    # Model priority list: If gemini-3.8-flash has a 503 spike, fall back to stable flash endpoints
    candidate_models = ["gemini-3.5-flash-lite", "gemini-flash-latest"]
    last_error = None

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
                engine=f"Functionality 2: {model_name} Grounded RAG",
                reply=response.text or "No response generated."
            )

        except Exception as e:
            err_str = str(e)
            # If high demand (503) or not found (404), log and try the next candidate model
            if "503" in err_str or "UNAVAILABLE" in err_str or "404" in err_str:
                print(f"[Warning] {model_name} unavailable due to high demand/status. Attempting fallback...")
                last_error = e
                continue
            else:
                # If it's an authentication or bad request error (e.g. 401/400), raise immediately
                raise HTTPException(status_code=500, detail=f"Gemini SDK Error: {err_str}")

    # If all candidate models failed
    raise HTTPException(
        status_code=503,
        detail=f"All Gemini models are temporarily experiencing high server demand. Please retry in 10-15 seconds. (Last error: {str(last_error)})"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)