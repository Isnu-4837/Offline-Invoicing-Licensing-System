import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios"; // Import API for backend requests

// Accepted upload types for the AI scanner
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_MB = 15;

// Fields the scanner is allowed to touch, and how to validate what comes back.
// Keeping this explicit (instead of trusting the response blindly) is what makes
// the autofill accurate: bad or missing values are dropped, not guessed.
function sanitizeExtraction(raw) {
  const out = {};
  const notes = [];

  if (raw && typeof raw.vendor_name === "string" && raw.vendor_name.trim()) {
    out.vendorName = raw.vendor_name.trim().slice(0, 120);
  }

  if (raw && typeof raw.bill_number === "string" && raw.bill_number.trim()) {
    out.billNumber = raw.bill_number.trim().slice(0, 60);
  }

  if (raw && raw.bill_date) {
    const iso = normalizeDate(raw.bill_date);
    if (iso) out.billDate = iso;
    else notes.push("date");
  }

  if (raw && raw.total_amount !== undefined && raw.total_amount !== null) {
    const n = Number(String(raw.total_amount).replace(/[^0-9.\-]/g, ""));
    if (!Number.isNaN(n) && n > 0 && n < 100000000) out.totalAmount = String(n);
    else notes.push("amount");
  }

  if (raw && (raw.status === "PAID" || raw.status === "UNPAID")) {
    out.status = raw.status;
  }

  return { fields: out, notes };
}

function normalizeDate(value) {
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// --- Smooth ease-out count-up used for the ledger stats strip ---
function useCountUp(target, duration = 1000, trigger = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!trigger) return undefined;
    const safeTarget = Number(target) || 0;
    let start = null;

    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(safeTarget * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(safeTarget);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, trigger]);

  return value;
}

export default function PurchaseInvoice() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendorName: "",
    billNumber: "",
    billDate: new Date().toISOString().split("T")[0],
    totalAmount: "",
    status: "UNPAID"
  });

  // --- AI scan state ---
  const [scanFile, setScanFile] = useState(null); // { name, previewUrl, isPdf }
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanNotice, setScanNotice] = useState(null); // { count, skipped }
  const [aiFilledKeys, setAiFilledKeys] = useState(new Set());
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const [now, setNow] = useState(new Date());

  // Fetch data on component mount
  useEffect(() => {
    fetchPurchases();
    return () => clearTimeout(highlightTimerRef.current);
  }, []);

  // Live ticking clock for the status strip
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // --- 3D tilt + cursor spotlight for glass cards ---
  const handleTilt = useCallback((e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty("--rx", `${(py - 0.5) * -7}deg`);
    card.style.setProperty("--ry", `${(px - 0.5) * 7}deg`);
    card.style.setProperty("--mx", `${px * 100}%`);
    card.style.setProperty("--my", `${py * 100}%`);
  }, []);

  const resetTilt = useCallback((e) => {
    const card = e.currentTarget;
    card.style.setProperty("--rx", `0deg`);
    card.style.setProperty("--ry", `0deg`);
  }, []);

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/purchases");
      setPurchases(res.data);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.vendorName || !formData.totalAmount) return alert("Vendor Name and Amount are required!");

    setIsSaving(true);
    try {
      // Save permanently to backend
      await api.post("/purchases", {
        vendor_name: formData.vendorName,
        bill_number: formData.billNumber,
        bill_date: formData.billDate,
        total_amount: Number(formData.totalAmount),
        status: formData.status
      });

      // Reset form and refresh table
      setFormData({ vendorName: "", billNumber: "", billDate: new Date().toISOString().split("T")[0], totalAmount: "", status: "UNPAID" });
      clearScan();
      fetchPurchases();
    } catch (error) {
      console.error("Failed to save purchase", error);
      alert("Failed to save purchase bill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) return;
    try {
      await api.delete(`/purchases/${id}`);
      fetchPurchases(); // Refresh list after deletion
    } catch (error) {
      console.error("Failed to delete purchase", error);
      alert("Failed to delete bill.");
    }
  };

  // --- AI autofill ---

  const clearScan = () => {
    if (scanFile?.previewUrl) URL.revokeObjectURL(scanFile.previewUrl);
    setScanFile(null);
    setScanError(null);
    setScanNotice(null);
    setAiFilledKeys(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyExtractedFields = (fields, notes) => {
    if (Object.keys(fields).length === 0) {
      setScanError("Couldn't confidently read any fields from this file. Try a clearer photo/scan, or enter the bill manually.");
      return;
    }
    setFormData(prev => ({ ...prev, ...fields }));
    setAiFilledKeys(new Set(Object.keys(fields)));
    setScanNotice({
      count: Object.keys(fields).length,
      skipped: notes.length
    });
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setAiFilledKeys(new Set()), 3200);
  };

  const runScan = useCallback(async (file) => {
    setScanError(null);
    setScanNotice(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setScanError("Unsupported file. Upload a JPG, PNG, WEBP, or PDF of the invoice.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setScanError(`File is too large — keep it under ${MAX_FILE_MB}MB.`);
      return;
    }

    const isPdf = file.type === "application/pdf";
    setScanFile({
      name: file.name,
      previewUrl: isPdf ? null : URL.createObjectURL(file),
      isPdf
    });

    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);

      // The file is sent to our own backend, which forwards it to the vision
      // model server-side (keeps API keys off the client) and returns strictly
      // validated JSON. Expected shape from POST /purchases/extract-ai:
      // { vendor_name, bill_number, bill_date: "YYYY-MM-DD", total_amount, status }
      const res = await api.post("/purchases/extract-ai", {
        file_name: file.name,
        mime_type: file.type,
        file_base64: base64
      });

      const { fields, notes } = sanitizeExtraction(res.data);
      applyExtractedFields(fields, notes);
    } catch (error) {
      console.error("AI extraction failed", error);
      const serverMsg = error?.response?.data?.message;
      setScanError(serverMsg || "AI scan failed. You can retry, or fill in the bill manually below.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const onFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) runScan(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runScan(file);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };

  const fieldTouch = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (aiFilledKeys.has(key)) {
      setAiFilledKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Ledger totals — real figures, not decoration
  const stats = useMemo(() => {
    const outstanding = purchases
      .filter(p => p.status !== "PAID")
      .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const settled = purchases
      .filter(p => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    return { outstanding, settled, count: purchases.length };
  }, [purchases]);

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  // Animated ledger numbers
  const statsReady = !isLoading;
  const animOutstanding = useCountUp(stats.outstanding, 1200, statsReady);
  const animSettled = useCountUp(stats.settled, 1200, statsReady);
  const animCount = useCountUp(stats.count, 900, statsReady);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        :root {
          --bg: #08080e;
          --surface: linear-gradient(160deg, #141c31 0%, #0b0f1b 100%);
          --surface-flat: #10152489;
          --border: rgba(255,255,255,0.07);
          --accent: #8b6cf0;
          --accent-2: #a78bfa;
          --accent-glow: rgba(139, 108, 240, 0.35);
          --gold: #e8b94f;
          --gold-glow: rgba(232, 185, 79, 0.35);
          --danger: #f87171;
          --danger-bg: rgba(239, 68, 68, 0.12);
          --success: #34d399;
          --success-bg: rgba(16, 185, 129, 0.12);
          --text: #f1f5f9;
          --text-dim: #9aa4bd;
          --text-faint: #5c6483;
        }

        * { box-sizing: border-box; }

        body {
          background:
            radial-gradient(ellipse 800px 500px at 10% -10%, rgba(139,108,240,0.16), transparent),
            radial-gradient(ellipse 700px 500px at 100% 10%, rgba(232,185,79,0.06), transparent),
            var(--bg);
          background-attachment: fixed;
          font-family: 'Inter', sans-serif;
          color: var(--text);
          margin: 0;
          min-height: 100vh;
        }

        .page-container {
          max-width: 1240px;
          margin: auto;
          padding: 40px 20px 80px;
          position: relative;
        }

        /* faint ledger dot-grid, like graph paper under the ink */
        .page-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 900px 600px at 50% 0%, black, transparent 75%);
          pointer-events: none;
          z-index: 0;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes stampIn {
          0% { opacity: 0; transform: scale(1.6) rotate(-14deg); }
          60% { opacity: 1; transform: scale(0.94) rotate(-6deg); }
          100% { opacity: 1; transform: scale(1) rotate(-6deg); }
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
          50% { box-shadow: 0 0 0 6px rgba(139, 108, 240, 0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        @keyframes scanSweep {
          0% { transform: translateY(-6%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(106%); opacity: 0; }
        }
        @keyframes aiGlowRing {
          0% { box-shadow: 0 0 0 0 var(--gold-glow); border-color: var(--gold); }
          60% { box-shadow: 0 0 0 5px rgba(232, 185, 79, 0); border-color: var(--gold); }
          100% { box-shadow: 0 0 0 0 rgba(232, 185, 79, 0); border-color: var(--border); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bannerIn {
          from { opacity: 0; transform: translateY(-6px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 80px; }
        }
        @keyframes dashScroll {
          to { background-position: 40px 0, -40px 40px, 0 -40px, 40px 0; }
        }
        @keyframes ledgerScan {
          0% { transform: translateY(-10%); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes ringSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes dotPulseAccent {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.5); }
          50% { box-shadow: 0 0 0 5px rgba(167, 139, 250, 0); }
        }

        .fade-in { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .ledger-scan-line {
          position: fixed; left: 0; right: 0; height: 140px;
          background: linear-gradient(180deg, transparent, rgba(139, 108, 240, 0.05), transparent);
          pointer-events: none; z-index: 0; animation: ledgerScan 12s linear infinite;
        }

        /* ---- Tilt + spotlight mechanics (stat cards) ---- */
        .tilt-card { transform-style: preserve-3d; perspective: 900px; }
        .card-spotlight {
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08), transparent 45%);
          opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        .tilt-card:hover .card-spotlight { opacity: 1; }

        .status-live { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .status-live .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-2); animation: dotPulseAccent 2s ease-in-out infinite; display: inline-block; }
        .status-live .status-text { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); }

        .header-clock { text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-faint); }
        .header-clock .clock-time { display: block; font-size: 15px; color: var(--text); font-weight: 600; margin-top: 3px; letter-spacing: 0.05em; }

        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 34px;
          position: relative;
          z-index: 1;
          flex-wrap: wrap;
          gap: 14px;
        }
        .header-title-group { display: flex; align-items: center; gap: 16px; }
        .header-title-group h1 {
          margin: 0;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.85rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(120deg, #ffffff 30%, var(--accent-2) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .header-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: var(--text-faint);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 2px 0 0;
        }

        .icon-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          font-size: 1.1rem;
          cursor: pointer;
          transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.12); transform: translateX(-3px); border-color: var(--accent-2); }
        .icon-btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

        .ledger-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0 20px;
          height: 42px;
          border-radius: 21px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ledger-btn:hover {
          background: rgba(139, 108, 240, 0.14);
          border-color: var(--accent-2);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(139, 108, 240, 0.25);
        }
        .ledger-btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

        /* Stats strip — real totals, not filler */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 22px;
          position: relative;
          z-index: 1;
        }
        .stat-card {
          position: relative;
          overflow: hidden;
          background: var(--surface-flat);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
          transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
        }
        .stat-card:hover { border-color: rgba(255,255,255,0.15); transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-2px); box-shadow: 0 14px 28px -16px rgba(139,108,240,0.28); }
        .stat-label, .stat-value { position: relative; }
        .stat-label {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-faint);
          margin: 0 0 8px;
        }
        .stat-value {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.4rem;
          font-weight: 600;
          margin: 0;
        }
        .stat-outstanding .stat-value { color: var(--danger); }
        .stat-settled .stat-value { color: var(--success); }
        .stat-count .stat-value { color: var(--text); }

        .grid-layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 26px;
          align-items: start;
          position: relative;
          z-index: 1;
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.45);
          position: relative;
          overflow: hidden;
        }
        .card::after {
          content: '';
          position: absolute;
          top: -1px; left: -1px; right: -1px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(139,108,240,0.6), transparent);
        }
        .card-sticky { position: sticky; top: 24px; }

        .card-title {
          margin: 0 0 20px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--accent-2);
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .card-title .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent-2);
          animation: pulseGlow 2.4s ease-in-out infinite;
        }

        /* Step labels — organizes the form into scan-first, verify-second */
        .step-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-faint);
          margin: 22px 0 12px;
        }
        .step-label:first-of-type { margin-top: 0; }
        .step-label .num {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 1px solid var(--text-faint);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px;
          flex-shrink: 0;
        }
        .step-divider {
          border: none;
          border-top: 1px dashed var(--border);
          margin: 20px 0;
        }

        /* --- AI scan dropzone --- */
        .ai-zone {
          position: relative;
          border: 1.5px dashed rgba(167, 139, 250, 0.35);
          border-radius: 14px;
          padding: 20px 16px;
          text-align: center;
          cursor: pointer;
          background: radial-gradient(ellipse at top, rgba(139, 108, 240, 0.08), rgba(6,9,18,0.5));
          transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ai-zone:hover, .ai-zone.drag-active {
          border-color: var(--accent-2);
          background: radial-gradient(ellipse at top, rgba(139, 108, 240, 0.16), rgba(6,9,18,0.55));
          transform: translateY(-1px);
        }
        .ai-zone.drag-active { box-shadow: 0 0 0 4px var(--accent-glow); }
        .ai-zone input[type="file"] { display: none; }
        .ai-zone-icon {
          font-size: 22px;
          display: inline-block;
          animation: floatSlow 3s ease-in-out infinite;
          margin-bottom: 6px;
        }
        .ai-zone-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 3px;
        }
        .ai-zone-sub {
          font-size: 11px;
          color: var(--text-faint);
          margin: 0;
        }
        .ai-zone-sub b { color: var(--accent-2); font-weight: 600; }

        .ai-preview {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid rgba(167, 139, 250, 0.35);
          background: rgba(6,9,18,0.6);
        }
        .ai-preview-img {
          width: 100%;
          height: 130px;
          object-fit: cover;
          display: block;
          filter: brightness(0.75);
        }
        .ai-preview-pdf {
          height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-dim);
        }
        .ai-preview-pdf .icon { font-size: 26px; }
        .ai-preview-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 12px;
          font-size: 11.5px;
          color: var(--text-dim);
          font-family: 'IBM Plex Mono', monospace;
          border-top: 1px solid var(--border);
        }
        .ai-preview-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
        .ai-preview-clear {
          background: rgba(255,255,255,0.08);
          border: none;
          color: var(--text-dim);
          width: 22px; height: 22px;
          border-radius: 50%;
          cursor: pointer;
          flex-shrink: 0;
          font-size: 11px;
          transition: 0.2s;
        }
        .ai-preview-clear:hover { background: var(--danger-bg); color: var(--danger); }

        .scan-sweep-wrap {
          position: absolute;
          inset: 0 0 auto 0;
          height: 130px;
          overflow: hidden;
          pointer-events: none;
        }
        .scan-sweep-line {
          position: absolute;
          left: 0; right: 0;
          height: 44px;
          background: linear-gradient(180deg, transparent, rgba(167,139,250,0.45) 45%, rgba(232,185,79,0.35) 55%, transparent);
          animation: scanSweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .scan-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--accent-2);
          border-top: 1px solid var(--border);
          font-family: 'IBM Plex Mono', monospace;
        }

        .scan-banner {
          margin-top: 12px;
          padding: 10px 13px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
          animation: bannerIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          overflow: hidden;
        }
        .scan-banner-success {
          background: var(--success-bg);
          border: 1px solid rgba(52,211,153,0.35);
          color: #a7f3d4;
        }
        .scan-banner-error {
          background: var(--danger-bg);
          border: 1px solid rgba(248,113,113,0.35);
          color: #fecaca;
        }
        .scan-banner b { color: inherit; }
        .scan-banner .retry-link {
          background: none; border: none;
          color: inherit;
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          padding: 0;
          margin-left: 4px;
        }

        .field { margin-bottom: 17px; }
        .field:last-of-type { margin-bottom: 0; }
        .input-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          color: var(--text-dim);
          margin-bottom: 7px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition: color 0.2s;
        }
        .ai-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(232, 185, 79, 0.14);
          color: var(--gold);
          border-radius: 5px;
          padding: 1px 6px 1px 5px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: none;
          animation: fadeIn 0.3s ease both;
        }
        .input-field {
          width: 100%;
          background: rgba(6, 9, 18, 0.65);
          border: 1px solid var(--border);
          color: white;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          padding: 12px 14px;
          border-radius: 9px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .input-field::placeholder { color: var(--text-faint); }
        .input-field:hover { border-color: rgba(255,255,255,0.18); }
        .input-field:focus {
          border-color: var(--accent-2);
          background: rgba(20, 26, 46, 1);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .field:focus-within .input-label { color: var(--accent-2); }
        .input-field.ai-filled { animation: aiGlowRing 2.6s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .row-split { display: flex; gap: 10px; }
        .row-split .field { flex: 1; }

        .save-btn {
          width: 100%;
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          background-size: 160% 160%;
          color: white;
          border: none;
          padding: 14px;
          margin-top: 6px;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }
        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 26px rgba(139, 92, 246, 0.4);
          background-position: 100% 0;
        }
        .save-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .save-btn:disabled { opacity: 0.7; cursor: default; }
        .save-btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; }

        .spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .spinner-sm {
          width: 11px; height: 11px;
          border: 2px solid rgba(167,139,250,0.35);
          border-top-color: var(--accent-2);
        }

        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; margin-top: 4px; min-width: 560px; }
        .table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
          border-bottom: 1px solid var(--border);
        }
        .table tbody tr {
          animation: rowIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: background 0.2s;
        }
        .table tbody tr:hover { background: rgba(139, 108, 240, 0.06); }
        .table td {
          padding: 15px 12px;
          font-size: 13.5px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .cell-vendor { font-weight: 600; }
        .cell-amount { font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
        .cell-bill { color: var(--text-dim); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
        .cell-date { color: var(--text-dim); font-variant-numeric: tabular-nums; }

        /* Stamp-style status badge — the signature element */
        .stamp {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 5px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          border: 1.5px dashed;
          transform: rotate(-4deg);
          animation: stampIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .stamp-unpaid { background: var(--danger-bg); color: var(--danger); border-color: rgba(248,113,113,0.5); }
        .stamp-paid { background: var(--success-bg); color: var(--success); border-color: rgba(52,211,153,0.5); }

        .btn-danger {
          background: var(--danger-bg);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.3);
          width: 30px; height: 30px;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-size: 12px;
        }
        .btn-danger:hover { background: var(--danger); color: white; transform: scale(1.08) rotate(-4deg); }
        .btn-danger:focus-visible { outline: 2px solid var(--danger); outline-offset: 2px; }

        .empty-state {
          text-align: center;
          padding: 56px 20px;
          animation: fadeIn 0.6s ease both;
        }
        .empty-state .icon { font-size: 26px; margin-bottom: 10px; opacity: 0.7; }
        .empty-state p { margin: 0; color: var(--text-dim); font-size: 13.5px; }
        .empty-state span { display: block; color: var(--text-faint); font-size: 12px; margin-top: 4px; }

        .skeleton-row td {
          padding: 15px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .skeleton-bar {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200px 100%;
          animation: shimmer 1.4s infinite linear;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }

        @media (max-width: 860px) {
          .grid-layout { grid-template-columns: 1fr; }
          .stats-row { grid-template-columns: 1fr; }
          .card-sticky { position: static; }
        }

        @media (max-width: 640px) {
          .header-row { align-items: flex-start; }
          .header-clock { text-align: left; }
        }
      `}</style>

      <div className="ledger-scan-line" />

      <div className="page-container">
        <div className="header-row fade-in">
          <div className="header-title-group">
            <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back">←</button>
            <div>
              <div className="status-live"><span className="status-dot"></span><span className="status-text">Live Ledger</span></div>
              <h1>Purchase Invoices</h1>
              <p className="header-eyebrow">Supplier bills &amp; payment ledger</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div className="header-clock">
              <span>{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
              <span className="clock-time">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>
            <button className="ledger-btn" onClick={() => navigate('/vendor-ledger')}>
              📒 Vendor Ledger
            </button>
          </div>
        </div>

        <div className="stats-row fade-in" style={{ animationDelay: '0.05s' }}>
          <div className="stat-card stat-outstanding tilt-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <p className="stat-label">Outstanding</p>
            <p className="stat-value">{fmt(Math.round(animOutstanding))}</p>
          </div>
          <div className="stat-card stat-settled tilt-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <p className="stat-label">Settled</p>
            <p className="stat-value">{fmt(Math.round(animSettled))}</p>
          </div>
          <div className="stat-card stat-count tilt-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <p className="stat-label">Bills Logged</p>
            <p className="stat-value">{Math.round(animCount)}</p>
          </div>
        </div>

        <div className="grid-layout">
          {/* Add Purchase Form */}
          <div className="card card-sticky fade-in" style={{ animationDelay: '0.1s' }}>
            <h3 className="card-title"><span className="dot" />Log New Bill</h3>

            <div className="step-label"><span className="num">1</span>Scan with AI (optional)</div>

            {!scanFile && (
              <div
                className={`ai-zone ${isDragActive ? 'drag-active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={onFileInputChange}
                />
                <span className="ai-zone-icon">✨</span>
                <p className="ai-zone-title">Drop an invoice photo or PDF</p>
                <p className="ai-zone-sub"><b>Click to browse</b> · JPG, PNG, WEBP or PDF, up to {MAX_FILE_MB}MB</p>
              </div>
            )}

            {scanFile && (
              <div className="ai-preview">
                {scanFile.isPdf ? (
                  <div className="ai-preview-pdf">
                    <span className="icon">📄</span>
                    <span style={{ fontSize: 11 }}>PDF selected</span>
                  </div>
                ) : (
                  <img className="ai-preview-img" src={scanFile.previewUrl} alt="Invoice preview" />
                )}

                {isScanning && (
                  <div className="scan-sweep-wrap">
                    <div className="scan-sweep-line" />
                  </div>
                )}

                {isScanning ? (
                  <div className="scan-status">
                    <span className="spinner spinner-sm" />
                    Reading invoice…
                  </div>
                ) : (
                  <div className="ai-preview-meta">
                    <span title={scanFile.name}>{scanFile.name}</span>
                    <button type="button" className="ai-preview-clear" onClick={clearScan} aria-label="Remove file">✕</button>
                  </div>
                )}
              </div>
            )}

            {!isScanning && scanNotice && (
              <div className="scan-banner scan-banner-success">
                ✨ Filled <b>{scanNotice.count} field{scanNotice.count === 1 ? '' : 's'}</b> from the document
                {scanNotice.skipped > 0 ? ` — ${scanNotice.skipped} field${scanNotice.skipped === 1 ? '' : 's'} needs a manual check.` : '.'}
                {' '}Review below before saving.
              </div>
            )}

            {!isScanning && scanError && (
              <div className="scan-banner scan-banner-error">
                ⚠ {scanError}
                {scanFile && (
                  <button type="button" className="retry-link" onClick={() => fileInputRef.current?.click()}>Try another file</button>
                )}
              </div>
            )}

            <hr className="step-divider" />
            <div className="step-label"><span className="num">2</span>Review &amp; confirm</div>

            <form onSubmit={handleSave}>
              <div className="field">
                <label className="input-label">
                  Supplier / Vendor Name
                  {aiFilledKeys.has('vendorName') && <span className="ai-tag">✨ AI</span>}
                </label>
                <input
                  className={`input-field ${aiFilledKeys.has('vendorName') ? 'ai-filled' : ''}`}
                  placeholder="e.g. CP Plus Distributors"
                  value={formData.vendorName}
                  onChange={e => fieldTouch('vendorName', e.target.value)}
                />
              </div>

              <div className="field">
                <label className="input-label">
                  Bill / Invoice Number
                  {aiFilledKeys.has('billNumber') && <span className="ai-tag">✨ AI</span>}
                </label>
                <input
                  className={`input-field ${aiFilledKeys.has('billNumber') ? 'ai-filled' : ''}`}
                  placeholder="INV-2026-XYZ"
                  value={formData.billNumber}
                  onChange={e => fieldTouch('billNumber', e.target.value)}
                />
              </div>

              <div className="row-split">
                <div className="field">
                  <label className="input-label">
                    Date
                    {aiFilledKeys.has('billDate') && <span className="ai-tag">✨ AI</span>}
                  </label>
                  <input
                    type="date"
                    className={`input-field ${aiFilledKeys.has('billDate') ? 'ai-filled' : ''}`}
                    value={formData.billDate}
                    onChange={e => fieldTouch('billDate', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="input-label">
                    Total Amount (₹)
                    {aiFilledKeys.has('totalAmount') && <span className="ai-tag">✨ AI</span>}
                  </label>
                  <input
                    type="number"
                    className={`input-field ${aiFilledKeys.has('totalAmount') ? 'ai-filled' : ''}`}
                    placeholder="0.00"
                    value={formData.totalAmount}
                    onChange={e => fieldTouch('totalAmount', e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="input-label">
                  Payment Status
                  {aiFilledKeys.has('status') && <span className="ai-tag">✨ AI</span>}
                </label>
                <select
                  className={`input-field ${aiFilledKeys.has('status') ? 'ai-filled' : ''}`}
                  value={formData.status}
                  onChange={e => fieldTouch('status', e.target.value)}
                >
                  <option value="UNPAID">Unpaid / Credit</option>
                  <option value="PAID">Paid in Full</option>
                </select>
              </div>

              <button type="submit" className="save-btn" disabled={isSaving}>
                {isSaving ? (<><span className="spinner" />Saving…</>) : (<>💾 Save Purchase Bill</>)}
              </button>
            </form>
          </div>

          {/* Recent Purchases Table */}
          <div className="card fade-in" style={{ animationDelay: '0.15s' }}>
            <h3 className="card-title"><span className="dot" />Recent Supplier Bills</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Bill No.</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    [...Array(4)].map((_, i) => (
                      <tr className="skeleton-row" key={`sk-${i}`}>
                        {[...Array(6)].map((__, j) => (
                          <td key={j}><div className="skeleton-bar" style={{ width: j === 1 ? '80%' : '60%' }} /></td>
                        ))}
                      </tr>
                    ))
                  )}

                  {!isLoading && purchases.map((p, i) => (
                    <tr key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
                      {/* Updated mapping to match database snake_case columns */}
                      <td className="cell-date">{new Date(p.bill_date).toLocaleDateString('en-IN')}</td>
                      <td className="cell-vendor">{p.vendor_name}</td>
                      <td className="cell-bill">{p.bill_number || '—'}</td>
                      <td className="cell-amount">{fmt(p.total_amount)}</td>
                      <td>
                        <span className={`stamp ${p.status === 'PAID' ? 'stamp-paid' : 'stamp-unpaid'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn-danger" onClick={() => handleDelete(p.id)} title="Delete Record" aria-label="Delete record">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!isLoading && purchases.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        <div className="empty-state">
                          <div className="icon">🧾</div>
                          <p>No purchase bills logged yet.</p>
                          <span>Scan a bill or add your first one manually on the left.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}