import React, { useState, useRef, useCallback } from 'react';
import './DiseasePage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ── Severity config ────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  none:     { label: 'Healthy',  color: '#2D6A4F', bg: '#E8F4EF', icon: '✅' },
  moderate: { label: 'Moderate', color: '#E07C1A', bg: '#FFF3E0', icon: '⚠️' },
  high:     { label: 'High',     color: '#C0392B', bg: '#FFECEC', icon: '🔴' },
  critical: { label: 'Critical', color: '#8B0000', bg: '#FFD7D7', icon: '🚨' },
};

// ── Convert image file to base64 ───────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Main component ────────────────────────────────────────────────
export default function DiseasePage() {
  const [imgSrc, setImgSrc]           = useState(null);
  const [imageFile, setImageFile]     = useState(null);
  const [result, setResult]           = useState(null);
  const [inferStatus, setInferStatus] = useState('idle');
  const [error, setError]             = useState('');
  const [isDragOver, setIsDragOver]   = useState(false);

  const fileInputRef = useRef(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }
    setError('');
    setResult(null);
    setInferStatus('idle');
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImgSrc(url);
  }

  const handleAnalyse = useCallback(async () => {
    if (!imageFile) return;
    setInferStatus('running');
    setError('');
    setResult(null);

    try {
      const base64 = await fileToBase64(imageFile);

      const res = await fetch(`${API_URL}/disease`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          crop: 'unknown',
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
      setInferStatus('done');
    } catch (err) {
      console.error(err);
      setError(
        err.message.includes('fetch')
          ? `Cannot reach backend at ${API_URL}. Make sure FastAPI is running.`
          : err.message
      );
      setInferStatus('error');
    }
  }, [imageFile]);

  function handleClear() {
    setImgSrc(null);
    setImageFile(null);
    setResult(null);
    setInferStatus('idle');
    setError('');
  }

  // Auto-analyse when image is loaded
  function handleImageLoad() {
    handleAnalyse();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">AI Disease Detection</div>
        <h1>Identify crop diseases instantly</h1>
        <p>Upload a photo of your plant's leaf for instant AI-powered diagnosis and treatment advice.</p>
      </div>

      {/* Status bar */}
      <div className="model-status-bar status-ready">
        <span className="status-dot green" />
        Disease detection powered by Agri Chanakya backend API
      </div>

      <div className="disease-layout">
        {/* ── Upload panel ── */}
        <div className="upload-panel">
          <div
            className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${imgSrc ? 'has-image' : ''}`}
            onClick={() => !imgSrc && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt="Uploaded leaf"
                className="leaf-preview"
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="drop-placeholder">
                <div className="drop-icon">🍃</div>
                <p className="drop-title">Drop a leaf photo here</p>
                <p className="drop-sub">or click to browse · JPG, PNG, WEBP</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />

          {imgSrc && (
            <div className="upload-actions">
              <button
                className="btn-primary"
                onClick={handleAnalyse}
                disabled={inferStatus === 'running'}
                style={{ flex: 1 }}
              >
                {inferStatus === 'running'
                  ? <><span className="btn-spinner" />Analysing…</>
                  : '🔬 Re-analyse'}
              </button>
              <button className="btn-secondary" onClick={handleClear}>
                ✕ Clear
              </button>
            </div>
          )}

          {!imgSrc && (
            <button
              className="btn-primary"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%' }}
            >
              📷 Upload Leaf Photo
            </button>
          )}

          {error && (
            <div className="error-banner" style={{ marginTop: 12 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Tips */}
          <div className="card tips-card">
            <h3 className="tips-title">📷 Photo Tips</h3>
            <ul className="tips-list">
              <li>Use a clear, well-lit photo of a single leaf</li>
              <li>Include edges and both surfaces if possible</li>
              <li>Avoid blurry, dark, or very small images</li>
              <li>Works best with: Tomato, Potato, Maize, Rice, Apple, Grape</li>
            </ul>
          </div>
        </div>

        {/* ── Results panel ── */}
        <div className="results-panel">
          {inferStatus === 'running' && (
            <div className="card loading-card">
              <div className="spinner" />
              <p className="loading-text">Analysing your leaf image…</p>
              <p className="loading-sub">Sending to Agri Chanakya AI backend</p>
            </div>
          )}

          {inferStatus === 'done' && result && (
            <ResultCard result={result} />
          )}

          {inferStatus === 'idle' && !error && (
            <div className="card empty-state">
              <div className="empty-icon">🔬</div>
              <p>Upload a leaf photo to start diagnosis.</p>
              <p className="empty-sub">
                Supports tomato, potato, maize, rice, apple, grape and more.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Result Card ────────────────────────────────────────────────────
function ResultCard({ result }) {
  // Map confidence 0-1 to percentage
  const confidencePct = result.confidence <= 1
    ? Math.round(result.confidence * 100)
    : Math.round(result.confidence);

  // Pick severity based on confidence
  const severityKey =
    confidencePct >= 85 ? 'high' :
    confidencePct >= 60 ? 'moderate' : 'none';

  const sev = SEVERITY_CONFIG[severityKey];

  return (
    <div className="fade-up">
      {/* Primary result */}
      <div className="primary-result-card" style={{ borderColor: sev.color }}>
        <div className="primary-result-header" style={{ background: sev.bg }}>
          <div className="primary-result-icon">{sev.icon}</div>
          <div className="primary-result-info">
            <div className="primary-crop-tag" style={{ color: sev.color }}>
              Detected Disease
            </div>
            <h2 className="primary-disease-name">{result.disease}</h2>
          </div>
          <div className="primary-confidence">
            <span className="conf-pct-big" style={{ color: sev.color }}>
              {confidencePct}%
            </span>
            <span className="conf-lbl">Confidence</span>
          </div>
        </div>
        <div className="conf-bar-outer">
          <div
            className="conf-bar-inner"
            style={{ width: `${confidencePct}%`, background: sev.color }}
          />
        </div>
        <div className="severity-badge-row">
          <span
            className="severity-badge"
            style={{ background: sev.bg, color: sev.color, borderColor: sev.color }}
          >
            {sev.icon} Severity: {sev.label}
          </span>
        </div>
      </div>

      {/* Treatment */}
      {result.treatment && (
        <div
          className="treatment-card card fade-up"
          style={{ animationDelay: '150ms' }}
        >
          <h3 className="treatment-title">🩺 Recommended Treatment</h3>
          <div
            className="treatment-section"
            style={{ background: '#E8F4EF', borderLeft: '3px solid #2D6A4F' }}
          >
            <div
              className="treatment-section-header"
              style={{ color: '#2D6A4F' }}
            >
              <span>💊</span><strong>Treatment</strong>
            </div>
            <p className="treatment-text">{result.treatment}</p>
          </div>
        </div>
      )}
    </div>
  );
}
