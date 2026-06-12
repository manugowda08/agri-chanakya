
import os
try:
    import numpy as np
    _HAVE_NUMPY = True
except ImportError:
    np = None
    _HAVE_NUMPY = False
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

try:
    from xgboost import XGBClassifier
    _HAVE_XGBOOST = True
except ImportError:
    from sklearn.ensemble import RandomForestClassifier
    XGBClassifier = RandomForestClassifier
    _HAVE_XGBOOST = False

from .crop_data import MANDI_PRICES, IDEAL_RANGES, HARVEST_SEASON

# ── Globals (populated on startup) ────────────────────────────
from typing import Optional
_label_encoder: Optional[LabelEncoder] = None
_label_encoder: LabelEncoder = None
_feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
_is_trained = False


def train_model():
    """Train the classifier on the Kaggle dataset. Called once at startup."""
    global _model, _label_encoder, _is_trained

    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "Crop_recommendation.csv")
    csv_path = os.path.normpath(csv_path)

    df = pd.read_csv(csv_path)
    print(f"[ML] Loaded dataset: {df.shape[0]} rows, {df['label'].nunique()} crops")

    X = df[_feature_cols].values
    y = df["label"].values

    _label_encoder = LabelEncoder()
    y_encoded = _label_encoder.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    if _HAVE_XGBOOST:
        _model = XGBClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            objective="multi:softprob",
            num_class=len(_label_encoder.classes_),
            eval_metric="mlogloss",
            random_state=42,
            verbosity=0,
        )
    else:
        _model = XGBClassifier(
            n_estimators=150,
            max_depth=6,
            random_state=42,
        )

    _model.fit(X_train, y_train)

    accuracy = _model.score(X_test, y_test)
    print(f"[ML] Model trained — test accuracy: {accuracy:.2%}")
    _is_trained = True


def _build_reason(crop_name: str, features: dict) -> str:
    """
    Build a human-readable reason string explaining why this crop was recommended.
    Highlights which input features fall within ideal ranges for the crop.
    """
    ideal = IDEAL_RANGES.get(crop_name, {})
    price = MANDI_PRICES.get(crop_name, 0)
    season = HARVEST_SEASON.get(crop_name, "")

    highlights = []

    # Check each feature against ideal range
    feature_labels = {
        "N": ("Nitrogen", "kg/ha"),
        "P": ("Phosphorus", "kg/ha"),
        "K": ("Potassium", "kg/ha"),
        "temperature": ("Temp", "°C"),
        "humidity": ("Humidity", "%"),
        "ph": ("pH", ""),
        "rainfall": ("Rainfall", "mm"),
    }

    matches = []
    partial = []
    for feat, (display_name, unit) in feature_labels.items():
        val = features.get(feat)
        if val is None or feat not in ideal:
            continue
        low, high = ideal[feat]
        if low <= val <= high:
            matches.append(f"{display_name}={val}{unit} (ideal range)")
        elif abs(val - low) / max(high - low, 1) < 0.25 or abs(val - high) / max(high - low, 1) < 0.25:
            partial.append(f"{display_name}={val}{unit} (close to ideal)")

    # Pick top 3 most informative highlights
    top_highlights = (matches[:2] + partial[:1]) if matches else partial[:3]
    if not top_highlights:
        top_highlights = [f"soil & climate profile is a moderate fit"]

    reason = f"Recommended {crop_name.capitalize()} because: {', '.join(top_highlights)}"

    if price:
        reason += f" — expected mandi price ₹{price}/qt"
    if season:
        reason += f" ({season})"

    return reason


def predict_top_crops(features: dict, top_n: int = 3) -> list[dict]:
    """
    Predict the top N crops for the given soil/weather features.

    Args:
        features: dict with keys N, P, K, temperature, humidity, ph, rainfall
        top_n: number of top crops to return

    Returns:
        List of dicts: [{name, score, reason}, ...]
    """
    if not _is_trained:
        raise RuntimeError("Model not trained yet. Call train_model() first.")

    # Build feature vector in correct order.
    def _safe_float(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    x = np.array([[_safe_float(features.get(col, 0.0)) for col in _feature_cols]])

    # Get probability distribution over all classes
    proba = _model.predict_proba(x)[0]

    # Get top N indices by probability
    top_indices = np.argsort(proba)[::-1][:top_n]

    results = []
    for idx in top_indices:
        crop_name = _label_encoder.classes_[idx]
        score = round(float(proba[idx]), 4)
        reason = _build_reason(crop_name, features)
        results.append({
            "name": crop_name,
            "score": score,
            "reason": reason,
        })

    return results
