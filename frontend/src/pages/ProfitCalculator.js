import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── Popular Indian crops for quick-fill ────────────────────────────────────
const CROP_PRESETS = [
  { name: "Wheat", seed: 3000, fertilizer: 4000, labor: 5000 },
  { name: "Rice", seed: 2500, fertilizer: 5000, labor: 7000 },
  { name: "Maize", seed: 1800, fertilizer: 3500, labor: 4500 },
  { name: "Tomato", seed: 4000, fertilizer: 6000, labor: 9000 },
  { name: "Potato", seed: 8000, fertilizer: 5500, labor: 6000 },
  { name: "Sugarcane", seed: 12000, fertilizer: 8000, labor: 10000 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// ─── Sub-components ──────────────────────────────────────────────────────────

function InputField({ label, icon, name, value, onChange, placeholder, unit, min = 0 }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#2D6A4F] mb-1">
        {icon} {label}
      </label>
      <div className="relative">
        <input
          type="number"
          name={name}
          value={value}
          min={min}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800
            focus:outline-none focus:ring-2 focus:ring-[#40916C]/40 focus:border-[#40916C]
            placeholder:text-gray-400 bg-white transition"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight, icon }) {
  return (
    <div
      className={`rounded-2xl p-4 border flex flex-col gap-1 shadow-sm
        ${highlight
          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
          : "bg-white border-gray-100 text-gray-800"
        }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-green-200" : "text-gray-400"}`}>
          {label}
        </span>
      </div>
      <p className={`text-xl font-extrabold leading-tight ${highlight ? "text-white" : "text-[#2D6A4F]"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs ${highlight ? "text-green-200" : "text-gray-500"}`}>{sub}</p>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-[#2D6A4F]/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#40916C] animate-spin" />
      </div>
      <p className="text-sm text-[#2D6A4F] font-medium animate-pulse">
        Calculating profit estimate…
      </p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-4 py-3 text-sm">
      <p className="font-semibold text-[#2D6A4F] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ProfitCalculator() {
  const [form, setForm] = useState({
    crop: "",
    land: "",
    seed_cost: "",
    fertilizer_cost: "",
    labor_cost: "",
  });
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const applyPreset = (preset) => {
    setForm((f) => ({
      ...f,
      crop: preset.name,
      seed_cost: String(preset.seed),
      fertilizer_cost: String(preset.fertilizer),
      labor_cost: String(preset.labor),
    }));
    setResult(null);
    setStatus("idle");
  };

  const totalCost =
    (parseFloat(form.seed_cost) || 0) +
    (parseFloat(form.fertilizer_cost) || 0) +
    (parseFloat(form.labor_cost) || 0);

  const isValid =
    form.crop.trim() &&
    parseFloat(form.land) > 0 &&
    totalCost > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    const payload = {
      crop: form.crop.trim(),
      land_acres: parseFloat(form.land),
      seed_cost: parseFloat(form.seed_cost) || 0,
      fertilizer_cost: parseFloat(form.fertilizer_cost) || 0,
      labor_cost: parseFloat(form.labor_cost) || 0,
    };

    try {
      const res = await fetch(`${API_BASE}/profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setForm({ crop: "", land: "", seed_cost: "", fertilizer_cost: "", labor_cost: "" });
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  };

  // Chart data derived from API result
  const chartData = result
    ? [
        { name: "Total Cost", value: result.total_cost, color: "#F4A261" },
        { name: "Revenue", value: result.expected_revenue, color: "#40916C" },
        { name: "Net Profit", value: result.net_profit, color: result.net_profit >= 0 ? "#2D6A4F" : "#ef4444" },
      ]
    : [];

  const marginColor =
    result?.profit_margin_pct >= 20
      ? "text-green-600"
      : result?.profit_margin_pct >= 0
      ? "text-orange-500"
      : "text-red-600";

  return (
    <div className="min-h-screen bg-[#F0F7F4] py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📊</span>
            <h1 className="text-2xl font-extrabold text-[#2D6A4F]">Profit Calculator</h1>
          </div>
          <p className="text-sm text-gray-600">
            Enter your crop details to estimate revenue, break-even, and profit margin.
          </p>
        </div>

        {/* ── Quick Presets ─────────────────────────────────────────────── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#2D6A4F] uppercase tracking-wide mb-2">
            Quick fill
          </p>
          <div className="flex flex-wrap gap-2">
            {CROP_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                  ${form.crop === p.name
                    ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                    : "bg-white text-[#2D6A4F] border-[#2D6A4F]/30 hover:border-[#40916C] hover:bg-green-50"
                  }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Form Card ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <div className="grid gap-4">

            {/* Crop name */}
            <div>
              <label className="block text-sm font-semibold text-[#2D6A4F] mb-1">
                🌾 Crop Name
              </label>
              <input
                type="text"
                name="crop"
                value={form.crop}
                onChange={handleChange}
                placeholder="e.g. Wheat, Rice, Tomato"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-[#40916C]/40 focus:border-[#40916C]
                  placeholder:text-gray-400 bg-white transition"
              />
            </div>

            {/* Land size */}
            <InputField
              label="Land Size"
              icon="📐"
              name="land"
              value={form.land}
              onChange={handleChange}
              placeholder="e.g. 2.5"
              unit="acres"
              min={0.1}
            />

            <div className="border-t border-dashed border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Costs (₹ per acre)
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField
                  label="Seed Cost"
                  icon="🌱"
                  name="seed_cost"
                  value={form.seed_cost}
                  onChange={handleChange}
                  placeholder="0"
                  unit="₹"
                />
                <InputField
                  label="Fertilizer"
                  icon="🧪"
                  name="fertilizer_cost"
                  value={form.fertilizer_cost}
                  onChange={handleChange}
                  placeholder="0"
                  unit="₹"
                />
                <InputField
                  label="Labor"
                  icon="👨‍🌾"
                  name="labor_cost"
                  value={form.labor_cost}
                  onChange={handleChange}
                  placeholder="0"
                  unit="₹"
                />
              </div>
            </div>

            {/* Live total cost preview */}
            {totalCost > 0 && (
              <div className="bg-[#F0F7F4] rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Total input cost</span>
                <span className="text-sm font-bold text-[#2D6A4F]">{fmt(totalCost)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || status === "loading"}
          className={`w-full py-3.5 rounded-2xl font-bold text-white text-base transition-all duration-200 shadow-sm
            ${isValid && status !== "loading"
              ? "bg-[#2D6A4F] hover:bg-[#40916C] active:scale-95 cursor-pointer"
              : "bg-[#2D6A4F]/40 cursor-not-allowed"
            }`}
        >
          {status === "loading" ? "Calculating…" : "💰 Calculate Profit"}
        </button>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {status === "loading" && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <LoadingSpinner />
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {status === "error" && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700">
            <p className="font-semibold mb-1">Could not calculate</p>
            <p>{errorMsg}</p>
            <button
              onClick={handleSubmit}
              className="mt-3 text-xs font-semibold text-[#2D6A4F] underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {status === "done" && result && (
          <div className="mt-4 space-y-4">

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon="💸"
                label="Total Cost"
                value={fmt(result.total_cost)}
                sub={`across ${form.land} acre(s)`}
              />
              <MetricCard
                icon="📈"
                label="Expected Revenue"
                value={fmt(result.expected_revenue)}
                sub="estimated market price"
              />
              <MetricCard
                icon="⚖️"
                label="Break-even"
                value={fmt(result.break_even_price)}
                sub="min. price per quintal"
              />
              <MetricCard
                icon="🏆"
                label="Net Profit"
                value={fmt(result.net_profit)}
                highlight
                sub={
                  <span className={`font-semibold ${result.net_profit >= 0 ? "text-green-200" : "text-red-300"}`}>
                    {result.net_profit >= 0 ? "✅ Profitable" : "❌ Loss"}
                  </span>
                }
              />
            </div>

            {/* Profit margin pill */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">Profit Margin</span>
              <span className={`text-xl font-extrabold ${marginColor}`}>
                {pct(result.profit_margin_pct)}
              </span>
            </div>

            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 pt-5 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 px-1">
                Cost vs Revenue breakdown
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Advisory note */}
            <div className="bg-[#FFF8F0] border border-[#F4A261]/30 rounded-2xl px-5 py-4 text-sm text-gray-700">
              <p className="font-semibold text-[#F4A261] mb-1">📌 Note</p>
              <p>
                Revenue estimates are based on average MSP/market rates. Actual prices vary by
                region and season. Consult your nearest APMC mandi for current rates.
              </p>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition"
            >
              Calculate for another crop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
