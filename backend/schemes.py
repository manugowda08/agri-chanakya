

from pydantic import BaseModel, Field  # type: ignore[import]
from typing import List, Optional


# ─── /recommend ───────────────────────────────────────────────

class RecommendRequest(BaseModel):
    N: float = Field(..., description="Nitrogen content in soil (kg/ha)")
    P: float = Field(..., description="Phosphorus content in soil (kg/ha)")
    K: float = Field(..., description="Potassium content in soil (kg/ha)")
    temperature: float = Field(..., description="Average temperature (°C)")
    humidity: float = Field(..., description="Relative humidity (%)")
    ph: float = Field(6.5, description="Soil pH value")
    rainfall: float = Field(200.0, description="Annual rainfall (mm)")
    location: str = Field("Karnataka", description="Location / state")


class CropSuggestion(BaseModel):
    name: str
    score: float = Field(..., description="Confidence score 0-1")
    reason: str = Field(..., description="Human-readable explanation")


class RecommendResponse(BaseModel):
    crops: List[CropSuggestion]


# ─── /disease ─────────────────────────────────────────────────

class DiseaseRequest(BaseModel):
    crop: str
    symptoms: str = Field(..., description="Comma-separated symptoms observed")
    image_url: Optional[str] = Field(None, description="Optional image link")


class DiseaseResponse(BaseModel):
    disease: str
    confidence: float
    treatment: str


# ─── /profit ──────────────────────────────────────────────────

class ProfitRequest(BaseModel):
    crop: str
    land_acres: float
    seed_cost: float = Field(..., description="Total seed cost in ₹")
    fertilizer_cost: float = Field(..., description="Total fertilizer cost in ₹")
    labor_cost: float = Field(..., description="Total labor cost in ₹")


class ProfitResponse(BaseModel):
    expected_revenue: float
    total_cost: float
    net_profit: float
    break_even_acres: float
    profit_margin_percent: float


# ─── /schemes ─────────────────────────────────────────────────

class SchemesRequest(BaseModel):
    crop: str
    state: Optional[str] = Field("Karnataka", description="State for regional schemes")


class Scheme(BaseModel):
    name: str
    description: str
    benefit: str
    eligibility: str


class SchemesResponse(BaseModel):
    schemes: List[Scheme]
    crop: str
