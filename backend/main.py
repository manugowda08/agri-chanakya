from contextlib import asynccontextmanager

from fastapi import FastAPI  # type: ignore[import]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import]

from app.schemas import (
    RecommendRequest, RecommendResponse, CropSuggestion,
    DiseaseRequest, DiseaseResponse,
    ProfitRequest, ProfitResponse,
    SchemesRequest, SchemesResponse, Scheme,
)
from app.ml_model import train_model, predict_top_crops
from app.crop_data import MANDI_PRICES, YIELD_PER_ACRE, HARVEST_SEASON
from app.schemes_data import get_schemes_for_crop


# ─── Startup: train ML model once ────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Startup] Training XGBoost crop recommendation model...")
    train_model()
    print("[Startup] Model ready. All endpoints live.")
    yield
    print("[Shutdown] Agri Chanakya shutting down.")


# ─── App Setup ────────────────────────────────────────────────

app = FastAPI(
    title="Agri Chanakya",
    description="AI-powered farm advisory API — crop recommendations, disease detection, profit estimation & govt schemes",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow everything for hackathon speed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "Agri Chanakya",
        "status": "running",
        "version": "1.0.0 — all endpoints live",
        "endpoints": ["/recommend", "/disease", "/profit", "/schemes"],
    }


# ─── POST /recommend  (REAL — XGBoost) ───────────────────────

@app.post("/recommend", response_model=RecommendResponse)
def recommend_crops(req: RecommendRequest):
    """
    Returns top 3 crop recommendations using an XGBoost classifier
    trained on the Kaggle Crop Recommendation Dataset (2200 samples, 22 crops).
    Each recommendation includes a confidence score and a human-readable reason.
    """
    features = {
        "N": req.N,
        "P": req.P,
        "K": req.K,
        "temperature": req.temperature,
        "humidity": req.humidity,
        "ph": req.ph,
        "rainfall": req.rainfall,
    }

    predictions = predict_top_crops(features, top_n=3)

    return RecommendResponse(
        crops=[
            CropSuggestion(name=p["name"], score=p["score"], reason=p["reason"])
            for p in predictions
        ]
    )


# ─── POST /disease  (MOCK) ───────────────────────────────────

@app.post("/disease", response_model=DiseaseResponse)
def detect_disease(req: DiseaseRequest):
    """
    Identifies crop disease from symptoms/image.
    Currently returns mock data — extend with image classification model.
    """
    return DiseaseResponse(
        disease="Bacterial Leaf Blight",
        confidence=0.87,
        treatment="Apply Streptomycin sulphate + Tetracycline mixture (300g/ha). "
                  "Drain excess water. Use resistant varieties like IR-64.",
    )


# ─── POST /profit  (REAL — Rule-Based) ───────────────────────

@app.post("/profit", response_model=ProfitResponse)
def estimate_profit(req: ProfitRequest):
    """
    Estimates expected revenue, cost, net profit, break-even point,
    and profit margin using realistic Karnataka yield & mandi price data.

    Uses hardcoded avg yield/acre and avg mandi price per crop
    from Karnataka agricultural department data (2024-25).
    """
    crop_lower = req.crop.lower().strip()

    # Look up crop data (fallback to conservative defaults)
    price_per_quintal = MANDI_PRICES.get(crop_lower, 2000)
    yield_per_acre = YIELD_PER_ACRE.get(crop_lower, 8)
    season = HARVEST_SEASON.get(crop_lower, "")

    # Calculate revenue
    total_yield_quintals = yield_per_acre * req.land_acres
    expected_revenue = total_yield_quintals * price_per_quintal

    # Calculate costs
    total_cost = req.seed_cost + req.fertilizer_cost + req.labor_cost

    # Net profit
    net_profit = expected_revenue - total_cost

    # Profit margin
    profit_margin = (net_profit / expected_revenue * 100) if expected_revenue > 0 else 0.0

    # Break-even: how many acres needed just to cover costs
    revenue_per_acre = yield_per_acre * price_per_quintal
    break_even_acres = (total_cost / revenue_per_acre) if revenue_per_acre > 0 else 0.0

    return ProfitResponse(
        expected_revenue=round(expected_revenue, 2),
        total_cost=round(total_cost, 2),
        net_profit=round(net_profit, 2),
        break_even_acres=round(break_even_acres, 2),
        profit_margin_percent=round(profit_margin, 2),
    )


# ─── POST /schemes  (REAL — 18 schemes, category-filtered) ───

@app.post("/schemes", response_model=SchemesResponse)
def get_schemes(req: SchemesRequest):
    """
    Returns government schemes applicable to the given crop.
    Includes central (PM-KISAN, PMFBY, KCC, etc.) and
    Karnataka state schemes (Raitha Siri, Krishi Bhagya, etc.).
    Filters by crop category (cereal, pulse, horticulture, etc.).
    """
    matched = get_schemes_for_crop(req.crop, req.state or "Karnataka")

    return SchemesResponse(
        crop=req.crop,
        schemes=[
            Scheme(
                name=s["name"],
                description=s["description"],
                benefit=s["benefit"],
                eligibility=s["eligibility"],
            )
            for s in matched
        ],
    )
