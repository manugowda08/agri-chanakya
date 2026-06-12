import React, { useState, useRef, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";

// ─── Disease treatment database ────────────────────────────────────────────────
// Keys must match the label names in your PlantVillage model's class list.
// Add / edit entries to match your model's exact output labels.
const TREATMENT_ADVICE = {
  "Tomato___Late_blight": {
    displayName: "Tomato Late Blight",
    severity: "high",
    treatment:
      "Remove and destroy infected plant parts immediately. Apply copper-based fungicide (e.g. Blitox 50 WP @ 2.5 g/L). Avoid overhead irrigation. Ensure good air circulation between plants.",
    prevention:
      "Use certified disease-free seeds. Rotate crops every 2–3 years. Avoid waterlogging.",
  },
  "Tomato___Early_blight": {
    displayName: "Tomato Early Blight",
    severity: "medium",
    treatment:
      "Spray Mancozeb 75 WP @ 2 g/L or Chlorothalonil @ 2 mL/L every 7–10 days. Remove lower infected leaves.",
    prevention:
      "Maintain plant spacing for airflow. Mulch around plants to reduce soil splash.",
  },
  "Tomato___Bacterial_spot": {
    displayName: "Tomato Bacterial Spot",
    severity: "medium",
    treatment:
      "Apply copper-based bactericide (Copper oxychloride 50 WP @ 3 g/L). Remove heavily infected leaves. Avoid working in wet fields.",
    prevention:
      "Use disease-resistant varieties. Sanitize tools between rows.",
  },
  "Tomato___healthy": {
    displayName: "Healthy Tomato",
    severity: "none",
    treatment: "No treatment required. Plant appears healthy.",
    prevention:
      "Continue regular monitoring. Ensure balanced NPK fertilization and adequate watering.",
  },
  "Potato___Late_blight": {
    displayName: "Potato Late Blight",
    severity: "high",
    treatment:
      "Apply Metalaxyl + Mancozeb (Ridomil Gold) @ 2.5 g/L. Destroy infected haulms before harvest. Do not store infected tubers.",
    prevention:
      "Use certified seed tubers. Hill up soil around plants. Avoid excess nitrogen.",
  },
  "Potato___Early_blight": {
    displayName: "Potato Early Blight",
    severity: "medium",
    treatment:
      "Spray Mancozeb 75 WP @ 2 g/L at 10-day intervals. Remove and burn infected leaves.",
    prevention: "Maintain adequate plant nutrition. Avoid moisture stress.",
  },
  "Potato___healthy": {
    displayName: "Healthy Potato",
    severity: "none",
    treatment: "No treatment required. Plant appears healthy.",
    prevention:
      "Monitor for aphids and whiteflies. Ensure well-drained soil.",
  },
  "Corn_(maize)___Common_rust_": {
    displayName: "Maize Common Rust",
    severity: "medium",
    treatment:
      "Apply Propiconazole (Tilt 25 EC) @ 0.5 mL/L. Start sprays at first sign of infection.",
    prevention:
      "Plant rust-resistant hybrids. Early planting reduces exposure.",
  },
  "Corn_(maize)___healthy": {
    displayName: "Healthy Maize",
    severity: "none",
    treatment: "No treatment required. Plant appears healthy.",
    prevention: "Scout regularly for stem borers and fall armyworm.",
  },
  "Rice___Leaf_scald": {
    displayName: "Rice Leaf Scald",
    severity: "medium",
    treatment:
      "Apply Propiconazole or Tricyclazole-based fungicide. Drain standing water for 3–4 days.",
    prevention:
      "Avoid excess nitrogen. Maintain balanced soil nutrition.",
  },
  "Rice___Brown_spot": {
    displayName: "Rice Brown Spot",
    severity: "medium",
    treatment:
      "Spray Edifenphos (Hinosan 50 EC) @ 1 mL/L or Mancozeb 75 WP @ 2.5 g/L.",
    prevention:
      "Use balanced fertilizers; potassium deficiency increases susceptibility.",
  },
  "Rice___healthy": {
    displayName: "Healthy Rice",
    severity: "none",
    treatment: "No treatment required. Plant appears healthy.",
    prevention: "Monitor water levels and watch for blast symptoms.",
  },
};

const FALLBACK_ADVICE = {
  displayName: "Unknown Condition",
  severity: "unknown",
  treatment:
    "Disease not found in our database. Please consult your local Krishi Vigyan Kendra (KVK) or call the Kisan Call Centre at 1800-180-1551.",
  prevention:
    "Keep monitoring the plant and isolate it from healthy crops if symptoms worsen.",
};

// ─── Severity badge config ──────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  none: { label: "Healthy", bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  low: { label: "Low Risk", bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  medium: { label: "Moderate", bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  high: { label: "High Risk", bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  unknown: { label: "Unknown", bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" },
};

// ─── MODEL CONFIG ───────────────────────────────────────────────────────────────
// Place your PlantVillage TF.js model at: public/model/model.json
// and its weight shards alongside it.
const MODEL_URL = process.env.REACT_APP_MODEL_URL || "/model/model.json";
const IMAGE_SIZE = 224; // PlantVillage models typically expect 224×224

// Labels must match your model's output order exactly.
// Replace/extend this array to match your model's class list.
const CLASS_LABELS = [
  "Corn_(maize)___Common_rust_",
  "Corn_(maize)___healthy",
  "Potato___Early_blight",
  "Potato___Late_blight",
  "Potato___healthy",
  "Rice___Brown_spot",
  "Rice___Leaf_scald",
  "Rice___healthy",
  "Tomato___Bacterial_spot",
  "Tomato___Early_blight",
  "Tomato___Late_blight",
  "Tomato___healthy",
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function preprocessImage(imageElement) {
  return tf.tidy(() => {
    const tensor = tf.browser
      .fromPixels(imageElement)
      .resizeBilinear([IMAGE_SIZE, IMAGE_SIZE])
      .toFloat()
      .div(255.0)
      .expandDims(0);
    return tensor;
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function UploadZone({ onFileSelect, previewUrl, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFileSelect(file);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
        ${dragging ? "border-[#40916C] bg-green-50 scale-[1.01]" : "border-[#2D6A4F]/40 bg-white hover:border-[#40916C] hover:bg-green-50/50"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files[0]; if (f) onFileSelect(f); }}
      />

      {previewUrl ? (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
          <img
            src={previewUrl}
            alt="Uploaded leaf"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="bg-white/90 text-[#2D6A4F] text-sm font-semibold px-4 py-2 rounded-full shadow">
              Change Photo
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
          {/* Leaf icon */}
          <div className="w-16 h-16 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
            <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
              <path
                d="M8 40 C10 28, 20 12, 40 8 C40 8, 40 28, 24 36 C18 38 12 38 8 40Z"
                fill="#2D6A4F"
                opacity="0.8"
              />
              <path d="M8 40 Q18 30 30 20" stroke="#F4A261" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-[#2D6A4F] text-base">
              Upload a leaf photo
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag & drop or tap to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG or WEBP · Best results with clear, close-up shots
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <span className="text-xs bg-[#2D6A4F]/10 text-[#2D6A4F] px-3 py-1 rounded-full font-medium">📷 Camera</span>
            <span className="text-xs bg-[#2D6A4F]/10 text-[#2D6A4F] px-3 py-1 rounded-full font-medium">🖼️ Gallery</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-[#2D6A4F]/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#40916C] animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#2D6A4F">
            <path d="M4 20c1-6 5-10 10-12C14 13 10 17 4 20z" opacity="0.8"/>
          </svg>
        </div>
      </div>
      <p className="text-[#2D6A4F] font-medium text-sm animate-pulse">{message}</p>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#2D6A4F" : pct >= 55 ? "#F4A261" : "#ef4444";
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 font-medium">Confidence</span>
        <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {pct < 55 && (
        <p className="text-xs text-orange-600 mt-1">
          ⚠️ Low confidence — try a clearer, closer photo
        </p>
      )}
    </div>
  );
}

function ResultCard({ result }) {
  const advice = TREATMENT_ADVICE[result.label] || FALLBACK_ADVICE;
  const isHealthy = advice.severity === "none";

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm transition-all duration-500
      ${isHealthy ? "border-green-200 bg-green-50/40" : "border-orange-100 bg-orange-50/20"}`}
    >
      {/* Header */}
      <div className={`px-5 py-4 flex items-start justify-between gap-3
        ${isHealthy ? "bg-green-100/60" : "bg-[#F4A261]/10"}`}
      >
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Detected Condition</p>
          <h3 className="text-lg font-bold text-[#2D6A4F] leading-tight">{advice.displayName}</h3>
        </div>
        <SeverityBadge severity={advice.severity} />
      </div>

      {/* Confidence */}
      <div className="px-5 pt-4 pb-2">
        <ConfidenceBar value={result.confidence} />
      </div>

      {/* Treatment */}
      <div className="px-5 pb-5 pt-3 grid gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">💊</span>
            <span className="text-sm font-semibold text-[#2D6A4F]">Treatment</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{advice.treatment}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🛡️</span>
            <span className="text-sm font-semibold text-[#2D6A4F]">Prevention</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{advice.prevention}</p>
        </div>
      </div>

      {/* Helpline nudge */}
      {advice.severity === "high" && (
        <div className="mx-5 mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-xs text-red-700 font-medium">
            🚨 Severe infection detected — contact your local KVK or call Kisan Helpline{" "}
            <a href="tel:18001801551" className="underline font-bold">1800-180-1551</a>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function DiseaseDetector() {
  const [model, setModel] = useState(null);
  const [modelStatus, setModelStatus] = useState("idle"); // idle | loading | ready | error
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [inferenceStatus, setInferenceStatus] = useState("idle"); // idle | running | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const imgRef = useRef(null);

  // ── Load TF.js model on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      setModelStatus("loading");
      try {
        const loaded = await tf.loadLayersModel(MODEL_URL);
        if (!cancelled) {
          setModel(loaded);
          setModelStatus("ready");
        }
      } catch (err) {
        console.warn("Could not load TF.js model:", err);
        if (!cancelled) setModelStatus("error");
      }
    }
    loadModel();
    return () => { cancelled = true; };
  }, []);

  // ── Handle file selection ────────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    setImageFile(file);
    setResult(null);
    setErrorMsg("");
    setInferenceStatus("idle");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // ── Run inference ────────────────────────────────────────────────────────────
  const runInference = async () => {
    if (!imageFile || !imgRef.current) return;
    setInferenceStatus("running");
    setResult(null);
    setErrorMsg("");

    try {
      if (modelStatus !== "ready" || !model) {
        throw new Error("Model not loaded. Please wait or check your /public/model/ folder.");
      }

      const tensor = preprocessImage(imgRef.current);
      const predictions = await model.predict(tensor).data();
      tensor.dispose();

      // Get top prediction
      let maxIdx = 0;
      let maxVal = predictions[0];
      for (let i = 1; i < predictions.length; i++) {
        if (predictions[i] > maxVal) { maxVal = predictions[i]; maxIdx = i; }
      }

      const label = CLASS_LABELS[maxIdx] || `class_${maxIdx}`;
      setResult({ label, confidence: maxVal, allScores: Array.from(predictions) });
      setInferenceStatus("done");
    } catch (err) {
      console.error("Inference error:", err);
      setErrorMsg(err.message || "Analysis failed. Please try again.");
      setInferenceStatus("error");
    }
  };

  // ── Cleanup preview URL on unmount / change ──────────────────────────────────
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const isAnalyzing = inferenceStatus === "running";
  const canAnalyze = !!imageFile && modelStatus === "ready" && !isAnalyzing;

  return (
    <div className="min-h-screen bg-[#F0F7F4] py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🔬</span>
            <h1 className="text-2xl font-extrabold text-[#2D6A4F]">Disease Detector</h1>
          </div>
          <p className="text-sm text-gray-600">
            Upload a clear photo of an infected leaf. Our AI will identify the disease and suggest treatment.
          </p>
        </div>

        {/* ── Model status banner ───────────────────────────────────────────── */}
        {modelStatus === "loading" && (
          <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Loading AI model…
          </div>
        )}
        {modelStatus === "error" && (
          <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
            ⚠️ Model could not be loaded from <code className="font-mono text-xs">/public/model/model.json</code>.
            Place your PlantVillage TF.js model files there and refresh.
          </div>
        )}
        {modelStatus === "ready" && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
            AI model ready
          </div>
        )}

        {/* ── Upload Zone ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <UploadZone
            onFileSelect={handleFileSelect}
            previewUrl={previewUrl}
            disabled={isAnalyzing}
          />

          {/* Hidden img element used for tensor preprocessing */}
          {previewUrl && (
            <img
              ref={imgRef}
              src={previewUrl}
              alt="hidden-ref"
              crossOrigin="anonymous"
              className="hidden"
              width={IMAGE_SIZE}
              height={IMAGE_SIZE}
            />
          )}
        </div>

        {/* ── Analyse Button ─────────────────────────────────────────────────── */}
        {previewUrl && (
          <button
            onClick={runInference}
            disabled={!canAnalyze}
            className={`w-full py-3.5 rounded-2xl font-bold text-white text-base transition-all duration-200 shadow-sm
              ${canAnalyze
                ? "bg-[#2D6A4F] hover:bg-[#40916C] active:scale-95 cursor-pointer"
                : "bg-[#2D6A4F]/40 cursor-not-allowed"
              }`}
          >
            {isAnalyzing ? "Analysing…" : "🔍 Analyse Leaf"}
          </button>
        )}

        {/* ── Loading spinner ────────────────────────────────────────────────── */}
        {isAnalyzing && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <LoadingSpinner message="Running disease detection on device…" />
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────────── */}
        {inferenceStatus === "error" && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700">
            <p className="font-semibold mb-1">Analysis failed</p>
            <p>{errorMsg}</p>
            <button
              onClick={runInference}
              className="mt-3 text-xs font-semibold text-[#2D6A4F] underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Result Card ────────────────────────────────────────────────────── */}
        {inferenceStatus === "done" && result && (
          <div className="mt-4">
            <ResultCard result={result} />
          </div>
        )}

        {/* ── Tips card ──────────────────────────────────────────────────────── */}
        {!previewUrl && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs font-semibold text-[#2D6A4F] uppercase tracking-wide mb-3">Tips for best results</p>
            <ul className="space-y-2">
              {[
                "Photograph a single leaf with clear visible symptoms",
                "Ensure good lighting — avoid shadows on the leaf",
                "Get close (15–20 cm away) so details are sharp",
                "Avoid wet leaves; dry surfaces give better readings",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-[#F4A261] font-bold shrink-0">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Reset ──────────────────────────────────────────────────────────── */}
        {previewUrl && inferenceStatus !== "running" && (
          <button
            onClick={() => {
              setImageFile(null);
              setPreviewUrl(null);
              setResult(null);
              setErrorMsg("");
              setInferenceStatus("idle");
            }}
            className="mt-4 w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition"
          >
            Clear & analyse another leaf
          </button>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Analysis runs on your device — no photo is uploaded to any server.
        </p>
      </div>
    </div>
  );
}
