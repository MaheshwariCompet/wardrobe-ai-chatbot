# 1. Daily Clothes Helper (Wardrobe Chatbot)
A simple, smart assistant that helps you decide what clothes to wear every day based on your past clothing history, local weather, and workspace conditions.

# 2. Picking what to wear every morning can cause daily hassles:

Weather surprises: Leaving home on a hot morning, only to get drenched by unexpected rain in the evening or freeze in a heavily air-conditioned office.

Uncomfortable clothes: Wearing heavy synthetic fabrics on hot days or forgetting an extra sweater or layer for work.

Wasted purchases: Buying clothes that do not match the pants, shirts, or shoes you already own.

# 3. What Can People Do With This Project?
Check Outfits for Hot or Cold Weather: Find proven, breathable combinations for hot days (up to 38°C+) or warm, layered outfits for chilly mornings.

Prepare for Sudden Rain: See which footwear and clothes kept you dry during past unexpected rain showers.

Survive Cold Office AC: Get suggestions for lightweight shirts paired with removable cardigans or overshirts to stay comfortable in air-conditioned rooms.

Avoid Uncomfortable Outfits: Review lowest-rated outfits from past records so you avoid making the same styling mistakes twice.

Match Specific Clothes: Ask questions like "What tops go best with my Navy wide-leg pants?" to see top-rated pairings.

Work Completely Offline: Use the full local diary without needing an internet connection.

# 4. Quick Setup Guide

Requirements
Python 3.11 installed on your computer.

Node.js (v18 or newer) installed.

Step 1: Start the Backend (Server)
cd backend
pip install fastapi uvicorn pandas numpy google-genai pydantic python-dotenv
GEMINI_API_KEY=your_api_key_here
python main.py

Step 2: Start the Frontend (User Interface)
cd frontend
npm install
npm run dev

# 5. Sample Questions to Try
"What should I wear for hot summer weather"
"Which past outfits were uncomfortable to avoid?"
"Can you tell the top 5 of tops fits for Navy wide-leg bottom?"

# 6.📖 Interactive Swagger API Documentation

This project includes standalone Swagger UI documentation bundled inside the [`docs/`](./docs) directory.

![Swagger UI Preview](./docs/swagger-ui-preview.png)

### Viewing the Swagger UI:
1. **GitHub Pages (Live in Browser):** Go to your repo **Settings > Pages > Branch: `main` > Folder: `/docs`** to host the interactive Swagger UI online for free.
2. **Local Static View:** Open [`docs/index.html`](./docs/index.html) directly in any web browser.
3. **Live FastAPI Backend:** Start `python main.py` in `backend/` and visit `http://127.0.0.1:8000/docs`.