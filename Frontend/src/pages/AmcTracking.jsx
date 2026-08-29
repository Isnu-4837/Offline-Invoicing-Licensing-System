import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const STATUS_META = {
  Active: { text: "#6ee7b7", glow: "rgba(52, 211, 153, 0.55)", bg: "rgba(52, 211, 153, 0.14)", border: "rgba(52, 211, 153, 0.35)" },
  "Expiring Soon": { text: "#fdba74", glow: "rgba(251, 146, 60, 0.55)", bg: "rgba(251, 146, 60, 0.14)", border: "rgba(251, 146, 60, 0.35)" },
  Expired: { text: "#fda4af", glow: "rgba(251, 113, 133, 0.55)", bg: "rgba(251, 113, 133, 0.14)", border: "rgba(251, 113, 133, 0.35)" },
  Unknown: { text: "#94a3b8", glow: "rgba(148, 163, 184, 0.4)", bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.25)" },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function calculateStatus(expiryDate) {
  const diffDays = daysUntil(expiryDate);
  if (diffDays === null) return "Unknown";
  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Active";
}

const EMPTY_FORM = {
  client_name: "",
  contact_number: "",
  product_details: "",
  install_date: new Date().toISOString().split("T")[0],
  expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
};

const ACCEPTED_SCAN_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SCAN_MB = 15;

function sanitizeAmcExtraction(raw) {
  const out = {};
  if (raw && typeof raw.client_name === "string" && raw.client_name.trim())
    out.client_name = raw.client_name.trim().slice(0, 120);
  if (raw && typeof raw.contact_number === "string" && raw.contact_number.trim())
    out.contact_number = raw.contact_number.trim().slice(0, 20);
  if (raw && raw.install_date) {
    const iso = normalizeDate(raw.install_date);
    if (iso) out.install_date = iso;
  }
  if (raw && raw.expiry_date) {
    const iso = normalizeDate(raw.expiry_date);
    if (iso) out.expiry_date = iso;
  }
  return out;
}

function normalizeDate(value) {
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

function sanitizePhone(raw) {
  if (!raw) return "";
  return raw.replace(/[^0-9]/g, "");
}

export default function AmcTracking() {
  const navigate = useNavigate();
  const [amcData, setAmcData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState("expiry_asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const firstFieldRef = useRef(null);

  // --- AI scan state ---
  const [scanFile, setScanFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanNotice, setScanNotice] = useState(null);
  const [aiFilledKeys, setAiFilledKeys] = useState(new Set());
  const [isDragActive, setIsDragActive] = useState(false);
  const scanFileInputRef = useRef(null);
  const aiHighlightTimerRef = useRef(null);

  const COMPANY_NAME = "NextGen TechStack"; // Change this to your company name

  useEffect(() => {
    fetchAmcContracts();
    return () => clearTimeout(aiHighlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => firstFieldRef.current && firstFieldRef.current.focus(), 60);
      const onKey = (e) => e.key === "Escape" && setIsModalOpen(false);
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isModalOpen]);

  const pushToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  const fetchAmcContracts = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get("/amc");
      setAmcData(res.data || []);
    } catch (error) {
      console.error("Failed to fetch AMC contracts", error);
      setLoadError(true);
      pushToast("Couldn't load AMC contracts.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: calculateStatus(formData.expiry_date),
      };
      await api.post("/amc", payload);
      await fetchAmcContracts();
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      clearScan();
      pushToast(`Contract added for ${payload.client_name}.`, "success");
    } catch (error) {
      console.error("Failed to add AMC", error);
      pushToast("Failed to save AMC contract.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- AI scan helpers ---

  const clearScan = () => {
    if (scanFile?.previewUrl) URL.revokeObjectURL(scanFile.previewUrl);
    setScanFile(null);
    setScanError(null);
    setScanNotice(null);
    setAiFilledKeys(new Set());
    if (scanFileInputRef.current) scanFileInputRef.current.value = "";
  };

  const applyExtractedFields = (fields) => {
    if (Object.keys(fields).length === 0) {
      setScanError("Couldn't confidently read any fields. Try a clearer photo, or fill in manually.");
      return;
    }
    setFormData(prev => ({ ...prev, ...fields }));
    setAiFilledKeys(new Set(Object.keys(fields)));
    setScanNotice({ count: Object.keys(fields).length });
    clearTimeout(aiHighlightTimerRef.current);
    aiHighlightTimerRef.current = setTimeout(() => setAiFilledKeys(new Set()), 3200);
  };

  const runScan = useCallback(async (file) => {
    setScanError(null);
    setScanNotice(null);
    if (!ACCEPTED_SCAN_TYPES.includes(file.type)) {
      setScanError("Unsupported file. Upload a JPG, PNG, WEBP, or PDF.");
      return;
    }
    if (file.size > MAX_SCAN_MB * 1024 * 1024) {
      setScanError(`File too large — keep it under ${MAX_SCAN_MB}MB.`);
      return;
    }
    const isPdf = file.type === "application/pdf";
    setScanFile({ name: file.name, previewUrl: isPdf ? null : URL.createObjectURL(file), isPdf });
    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await api.post("/amc/extract-ai", {
        file_name: file.name,
        mime_type: file.type,
        file_base64: base64,
      });
      applyExtractedFields(sanitizeAmcExtraction(res.data));
    } catch (err) {
      console.error("AMC AI extraction failed", err);
      const msg = err?.response?.data?.message;
      setScanError(msg || "AI scan failed. Fill in the fields manually below.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const onScanFileChange = (e) => {
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
      setAiFilledKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const sendWhatsAppAlert = (amc) => {
    const status = calculateStatus(amc.expiry_date);
    let message = "";

    if (status === "Expired") {
      message = `Dear ${amc.client_name}, your Annual Maintenance Contract (AMC) for ${amc.product_details} expired on ${amc.expiry_date}. Please contact ${COMPANY_NAME} to renew your contract and ensure uninterrupted service.`;
    } else if (status === "Expiring Soon") {
      message = `Dear ${amc.client_name}, this is a gentle reminder from ${COMPANY_NAME} that your AMC for ${amc.product_details} is expiring soon on ${amc.expiry_date}. Kindly renew it at your earliest convenience.`;
    } else {
      message = `Dear ${amc.client_name}, your AMC for ${amc.product_details} is currently active and valid until ${amc.expiry_date}. Thank you for choosing ${COMPANY_NAME}!`;
    }

    const phone = sanitizePhone(amc.contact_number);
    if (!phone) {
      pushToast(`No contact number saved for ${amc.client_name} — add one manually on the next screen.`, "error");
    }

    // 1. Save to LocalStorage as bulletproof fallback for HashRouter
    localStorage.setItem(
      "wa_prefill_data",
      JSON.stringify({ phone, message })
    );

    // 2. Query Params
    const query = new URLSearchParams({
      phone: phone,
      message: message,
    }).toString();

    // 3. Navigate with both query string and state
    navigate(`/whatsapp-integration?${query}`, {
      state: { phone, message },
    });
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = amcData.filter((item) => {
      const matchesSearch =
        (item.client_name || "").toLowerCase().includes(q) ||
        (item.product_details || "").toLowerCase().includes(q);
      const dynamicStatus = calculateStatus(item.expiry_date);
      const matchesFilter = filterStatus === "ALL" || dynamicStatus === filterStatus;
      return matchesSearch && matchesFilter;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "expiry_asc") return new Date(a.expiry_date) - new Date(b.expiry_date);
      if (sortBy === "expiry_desc") return new Date(b.expiry_date) - new Date(a.expiry_date);
      if (sortBy === "name") return (a.client_name || "").localeCompare(b.client_name || "");
      return 0;
    });

    return list;
  }, [amcData, searchQuery, filterStatus, sortBy]);

  const activeCount = useMemo(() => amcData.filter((d) => calculateStatus(d.expiry_date) === "Active").length, [amcData]);
  const expiringCount = useMemo(() => amcData.filter((d) => calculateStatus(d.expiry_date) === "Expiring Soon").length, [amcData]);
  const expiredCount = useMemo(() => amcData.filter((d) => calculateStatus(d.expiry_date) === "Expired").length, [amcData]);

  const radarItems = useMemo(() => {
    return [...amcData]
      .filter((d) => calculateStatus(d.expiry_date) !== "Active")
      .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
      .slice(0, 5);
  }, [amcData]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          background: #08060f;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        h1, h2, h3, .heading-font { font-family: 'Sora', 'Plus Jakarta Sans', sans-serif; }

        @keyframes scanSweep { 0% { transform: translateY(-6%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(106%); opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aiGlowRing {
          0% { box-shadow: 0 0 0 0 rgba(232,185,79,0.5); border-color: #e8b94f; }
          60% { box-shadow: 0 0 0 5px rgba(232,185,79,0); border-color: #e8b94f; }
          100% { box-shadow: 0 0 0 0 rgba(232,185,79,0); border-color: rgba(255,255,255,0.1); }
        }
        @keyframes bannerIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatIcon { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
        @keyframes floatSlow { 0%, 100% { transform: translate(0px, 0px) scale(1); } 50% { transform: translate(20px, -25px) scale(1.05); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }

        .backdrop-mesh {
          position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
          background:
            radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.16), transparent 45%),
            radial-gradient(circle at 85% 10%, rgba(139, 92, 246, 0.18), transparent 40%),
            radial-gradient(circle at 50% 90%, rgba(52, 211, 153, 0.10), transparent 45%), #08060f;
        }

        .bg-blob { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; animation: floatSlow 14s ease-in-out infinite; }
        .grain-overlay { position: fixed; inset: 0; z-index: 1; pointer-events: none; background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px); background-size: 3px 3px; opacity: 0.5; mix-blend-mode: overlay; }

        .page-container { max-width: 1280px; margin: auto; padding: 40px 24px 80px; animation: fadeInUp 0.6s ease; position: relative; z-index: 2; }

        .glass {
          position: relative; background: rgba(255, 255, 255, 0.045); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.10); border-radius: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }
        .glass::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }

        .back-btn {
          background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.14); color: white;
          width: 44px; height: 44px; border-radius: 14px; font-size: 1.2rem; cursor: pointer; transition: all 0.25s cubic-bezier(.2,.9,.3,1.3);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .back-btn:hover { background: rgba(56, 189, 248, 0.18); border-color: rgba(56, 189, 248, 0.5); transform: scale(1.08) translateY(-1px); box-shadow: 0 6px 18px rgba(56, 189, 248, 0.25); }

        .logo-mark { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #38bdf8, #818cf8); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 10px 20px -5px rgba(56, 189, 248, 0.5), inset 0 1px 0 rgba(255,255,255,0.35); flex-shrink: 0; }

        .page-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2.1rem); font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(135deg, #ffffff 30%, #bae6fd 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .page-subtitle { margin: 4px 0 0 0; font-size: 0.85rem; color: rgba(226, 232, 240, 0.55); font-weight: 500; }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }

        .stat-card { padding: 24px; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(.2,.9,.3,1.2), box-shadow 0.3s ease, border-color 0.3s ease; }
        .stat-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.22); box-shadow: 0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14); }
        .stat-card .stat-glow { position: absolute; top: -40%; right: -20%; width: 65%; height: 140%; border-radius: 50%; filter: blur(40px); opacity: 0.55; pointer-events: none; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: rgba(255,255,255,0.6); font-weight: 700; }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; letter-spacing: -0.02em; position: relative; z-index: 1; }
        .stat-icon-badge { position: absolute; right: 20px; top: 20px; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }

        .layout-grid { display: grid; grid-template-columns: 1fr 320px; gap: 22px; align-items: start; }
        @media (max-width: 1050px) { .layout-grid { grid-template-columns: 1fr; } }

        .panel { padding: 28px; }

        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 14px; flex-wrap: wrap; }
        .toolbar-left { display: flex; gap: 12px; flex-wrap: wrap; flex: 1; }

        .search-wrap { position: relative; flex: 1; min-width: 240px; }
        .search-wrap .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.45; pointer-events: none; font-size: 14px; }
        
        .search-input, .sort-select {
          width: 100%; padding: 13px 16px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 12, 26, 0.5); backdrop-filter: blur(8px); color: white; font-size: 14px;
          outline: none; transition: all 0.25s ease; font-family: inherit;
        }
        .search-input { padding-left: 40px; }
        .sort-select { min-width: 180px; width: auto; cursor: pointer; font-weight: 600; color: #cbd5e1; }
        .search-input::placeholder { color: rgba(226,232,240,0.4); }
        .search-input:focus, .sort-select:focus { border-color: #38bdf8; background: rgba(15, 12, 26, 0.75); box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.16); }

        .filter-tabs { display: flex; gap: 6px; background: rgba(0, 0, 0, 0.22); padding: 5px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 9px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-family: inherit; white-space: nowrap; }
        .tab-btn.active { background: linear-gradient(135deg, rgba(56,189,248,0.35), rgba(139,92,246,0.35)); color: #fdf4ff; box-shadow: 0 2px 12px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255,255,255,0.15); }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.06); }

        .add-btn {
          background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%); color: white; border: none; padding: 13px 22px; border-radius: 14px; font-weight: 700; cursor: pointer; transition: all 0.25s cubic-bezier(.2,.9,.3,1.2); display: inline-flex; gap: 8px; align-items: center; font-family: inherit; font-size: 13px; box-shadow: 0 4px 18px rgba(56, 189, 248, 0.35);
        }
        .add-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(56, 189, 248, 0.5); }

        .table-scroll { width: 100%; overflow-x: auto; border-radius: 16px; }
        .table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 4px; min-width: 720px; }
        .table th { text-align: left; padding: 14px 14px; font-size: 10.5px; color: rgba(226,232,240,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; background: rgba(10, 8, 18, 0.4); backdrop-filter: blur(6px); }
        .table td { padding: 16px 14px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; color: #f1f5f9; }
        .table tbody tr { transition: background 0.2s ease, transform 0.15s ease; animation: rowIn 0.3s ease both; }
        .table tbody tr:hover { background: rgba(255,255,255,0.035); }
        .table tr.row-expired td:first-child { box-shadow: inset 3px 0 0 #fb7185; }
        .table tr.row-expiring td:first-child { box-shadow: inset 3px 0 0 #fb923c; }

        .client-cell { display: flex; align-items: center; gap: 10px; }
        .client-avatar { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #818cf8, #38bdf8); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: #0f172a; flex-shrink: 0; }

        .status-badge { padding: 6px 13px; border-radius: 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; backdrop-filter: blur(4px); text-transform: uppercase;}
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        
        .contact-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #cbd5e1; font-weight: 600; }
        .contact-chip .contact-dot { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.8); }
        .contact-chip.missing { color: rgba(226,232,240,0.4); font-weight: 500; font-style: italic; }

        .action-btn { background: rgba(34, 197, 94, 0.12); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.28); padding: 9px 15px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.25s ease; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; backdrop-filter: blur(4px); }
        .action-btn:hover { background: #22c55e; color: white; transform: translateY(-2px); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4); }

        .skeleton-row td { padding: 16px 14px; }
        .skeleton-bar { height: 14px; border-radius: 6px; background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.6s infinite linear; }

        /* ---- Radar Side Panel ---- */
        .radar-panel { border-radius: 20px; padding: 24px; animation: fadeInUp 0.55s ease 0.15s both; }
        .radar-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; font-family: 'Sora', sans-serif; }
        .radar-sub { font-size: 11.5px; color: rgba(226,232,240,0.5); margin-bottom: 20px; }
        .radar-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); animation: rowIn 0.3s ease both; }
        .radar-item:last-child { border-bottom: none; }
        .radar-name { font-weight: 700; font-size: 13px; color: #f1f5f9; }
        .radar-product { font-size: 11.5px; color: rgba(226,232,240,0.6); margin-top: 4px; }
        .radar-days { font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 8px; white-space: nowrap; border: 1px solid transparent; }
        .radar-empty { text-align: center; padding: 25px 0; color: rgba(226,232,240,0.5); font-size: 13px; }

        /* ---- Modal ---- */
        .modal-overlay { position: fixed; inset: 0; background: rgba(4, 5, 8, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; animation: fadeIn 0.2s ease; }
        .modal-box {
          background: rgba(15, 12, 26, 0.85); backdrop-filter: blur(30px) saturate(180%); -webkit-backdrop-filter: blur(30px) saturate(180%);
          border: 1px solid rgba(56, 189, 248, 0.28); padding: 34px; border-radius: 22px; max-width: 520px; width: 100%;
          box-shadow: 0 30px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1); animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1);
          max-height: 92vh; overflow-y: auto;
        }
        .modal-box h3 { margin: 0 0 6px; color: white; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.01em; font-family: 'Sora', sans-serif; }
        .modal-subtitle { margin: 0 0 18px; font-size: 12.5px; color: rgba(226,232,240,0.6); font-weight: 500; }

        /* AI scan zone inside modal */
        .ai-scan-zone {
          position: relative; border: 1.5px dashed rgba(167,139,250,0.4); border-radius: 12px;
          padding: 16px; text-align: center; cursor: pointer;
          background: radial-gradient(ellipse at top, rgba(139,108,240,0.09), rgba(6,9,18,0.5));
          transition: 0.25s cubic-bezier(0.16,1,0.3,1); margin-bottom: 14px;
        }
        .ai-scan-zone:hover, .ai-scan-zone.drag-active {
          border-color: #a78bfa;
          background: radial-gradient(ellipse at top, rgba(139,108,240,0.18), rgba(6,9,18,0.55));
          transform: translateY(-1px);
        }
        .ai-scan-zone.drag-active { box-shadow: 0 0 0 4px rgba(139,108,240,0.25); }
        .ai-scan-zone input[type="file"] { display: none; }
        .ai-zone-icon { font-size: 20px; display: inline-block; animation: floatIcon 3s ease-in-out infinite; margin-bottom: 4px; }
        .ai-zone-title { font-size: 12.5px; font-weight: 700; color: #f1f5f9; margin: 0 0 2px; }
        .ai-zone-sub  { font-size: 11px; color: rgba(226,232,240,0.45); margin: 0; }
        .ai-zone-sub b { color: #a78bfa; font-weight: 600; }

        .ai-preview-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 9px 12px; margin-bottom: 14px;
          font-size: 12px; color: rgba(226,232,240,0.7);
        }
        .ai-preview-bar .fn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
        .ai-clear-btn {
          background: rgba(255,255,255,0.08); border: none; color: rgba(226,232,240,0.6);
          width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; flex-shrink: 0;
          transition: 0.2s;
        }
        .ai-clear-btn:hover { background: rgba(248,113,113,0.25); color: #f87171; }

        .scan-status-bar {
          display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600;
          color: #a78bfa; margin-bottom: 14px;
        }
        .spinner-xs { width: 10px; height: 10px; border: 2px solid rgba(167,139,250,0.3); border-top-color: #a78bfa; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }

        .scan-sweep-wrap { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: 12px; }
        .scan-sweep-line { position: absolute; left: 0; right: 0; height: 36px; background: linear-gradient(180deg, transparent, rgba(167,139,250,0.45) 45%, rgba(232,185,79,0.3) 55%, transparent); animation: scanSweep 1.6s cubic-bezier(0.4,0,0.2,1) infinite; }

        .scan-banner {
          padding: 9px 12px; border-radius: 9px; font-size: 11.5px; line-height: 1.5;
          animation: bannerIn 0.3s cubic-bezier(0.16,1,0.3,1) both; margin-bottom: 14px;
        }
        .scan-banner-success { background: rgba(16,185,129,0.12); border: 1px solid rgba(52,211,153,0.35); color: #a7f3d4; }
        .scan-banner-error   { background: rgba(239,68,68,0.12);  border: 1px solid rgba(248,113,113,0.35); color: #fecaca; }

        .ai-tag {
          display: inline-flex; align-items: center; gap: 2px;
          background: rgba(232,185,79,0.15); color: #e8b94f;
          border-radius: 4px; padding: 1px 5px; font-size: 9px; font-weight: 700;
          text-transform: none; margin-left: 6px; letter-spacing: 0.02em;
          animation: bannerIn 0.3s ease both;
        }
        .modal-input.ai-filled { animation: aiGlowRing 2.6s cubic-bezier(0.16,1,0.3,1) both; }
        
        .input-label { display: block; font-size: 11px; color: #bae6fd; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon .input-icon { position: absolute; left: 14px; font-size: 14px; opacity: 0.85; pointer-events: none; }
        
        .modal-input {
          width: 100%; padding: 13px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); 
          background: rgba(0, 0, 0, 0.4); color: white; font-size: 14px; outline: none; transition: all 0.25s ease; 
          font-family: inherit; box-sizing: border-box;
        }
        .input-with-icon .modal-input { padding-left: 40px; }
        .modal-input:focus { border-color: #38bdf8; background: rgba(0, 0, 0, 0.6); box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15); }
        .input-hint { font-size: 11px; color: rgba(226,232,240,0.5); margin-top: 8px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
        .cancel-btn { background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.12); padding: 12px 22px; border-radius: 12px; cursor: pointer; font-weight: 700; font-family: inherit; transition: background 0.2s; }
        .cancel-btn:hover { background: rgba(255,255,255,0.15); }

        .spinner-sm { width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.25); border-top-color: #04211d; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

        /* Toasts */
        .toast-stack { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 12px; z-index: 10000; max-width: 350px; }
        .toast { padding: 14px 18px; border-radius: 14px; font-size: 13.5px; font-weight: 600; color: white; background: rgba(19,24,41,0.9); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.6); animation: toastIn 0.3s cubic-bezier(0.16,1,0.3,1) both; display: flex; align-items: center; gap: 10px; }
        .toast.success { border-color: rgba(52,211,153,0.45); }
        .toast.error { border-color: rgba(251,113,133,0.45); }
        .toast.info { border-color: rgba(56,189,248,0.45); }

        @media (max-width: 860px) {
          .stats-grid { grid-template-columns: 1fr; }
          .panel { padding: 20px; }
        }
      `}</style>

      <div className="backdrop-mesh">
        <div className="bg-blob b1" />
        <div className="bg-blob b2" />
        <div className="bg-blob b3" />
        <div className="bg-blob b4" />
      </div>
      <div className="grain-overlay" />

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-box">
            <h3>Add New AMC Contract</h3>
            <p className="modal-subtitle">Save the client's details once — alerts will pull from here automatically.</p>

            {/* --- AI Scan Zone --- */}
            {!scanFile && (
              <div
                className={`ai-scan-zone ${isDragActive ? 'drag-active' : ''}`}
                onClick={() => scanFileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scanFileInputRef.current?.click(); }}
              >
                <input
                  ref={scanFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={onScanFileChange}
                />
                <span className="ai-zone-icon">✨</span>
                <p className="ai-zone-title">Scan warranty card or service report</p>
                <p className="ai-zone-sub"><b>Click to browse</b> · JPG, PNG, WEBP or PDF</p>
              </div>
            )}

            {scanFile && (
              isScanning ? (
                <div className="ai-scan-zone" style={{ cursor: 'default', marginBottom: 14 }}>
                  <div className="scan-sweep-wrap"><div className="scan-sweep-line" /></div>
                  <span className="ai-zone-icon">🔍</span>
                  <p className="ai-zone-title">Reading document…</p>
                  <p className="ai-zone-sub" style={{ color: '#a78bfa' }}>{scanFile.name}</p>
                </div>
              ) : (
                <div className="ai-preview-bar">
                  <span className="fn" title={scanFile.name}>{scanFile.isPdf ? '📄 ' : '🖼️ '}{scanFile.name}</span>
                  <button type="button" className="ai-clear-btn" onClick={clearScan} aria-label="Remove file">✕</button>
                </div>
              )
            )}

            {!isScanning && scanNotice && (
              <div className="scan-banner scan-banner-success">
                ✨ Filled <b>{scanNotice.count} field{scanNotice.count === 1 ? '' : 's'}</b> from the document. Review below before saving.
              </div>
            )}
            {!isScanning && scanError && (
              <div className="scan-banner scan-banner-error">
                ⚠ {scanError}
              </div>
            )}

            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">
                  Client Name
                  {aiFilledKeys.has('client_name') && <span className="ai-tag">✨ AI</span>}
                </label>
                <input
                  ref={firstFieldRef}
                  required
                  className={`modal-input ${aiFilledKeys.has('client_name') ? 'ai-filled' : ''}`}
                  placeholder="E.g. Apex Industries"
                  value={formData.client_name}
                  onChange={(e) => fieldTouch('client_name', e.target.value)}
                />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">
                  Contact Number
                  {aiFilledKeys.has('contact_number') && <span className="ai-tag">✨ AI</span>}
                </label>
                <div className="input-with-icon">
                  <span className="input-icon">📱</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    className={`modal-input ${aiFilledKeys.has('contact_number') ? 'ai-filled' : ''}`}
                    placeholder="e.g. +91 98765 43210"
                    value={formData.contact_number}
                    onChange={(e) => fieldTouch('contact_number', e.target.value)}
                  />
                </div>
                <div className="input-hint">Used to auto-fill the WhatsApp alert for this client.</div>
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">Product / Service Details</label>
                <input
                  required
                  className="modal-input"
                  placeholder="E.g. 16-Channel CCTV System"
                  value={formData.product_details}
                  onChange={(e) => setFormData({ ...formData, product_details: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div>
                  <label className="input-label">
                    Installation Date
                    {aiFilledKeys.has('install_date') && <span className="ai-tag">✨ AI</span>}
                  </label>
                  <input
                    required
                    type="date"
                    className={`modal-input ${aiFilledKeys.has('install_date') ? 'ai-filled' : ''}`}
                    style={{ colorScheme: "dark" }}
                    value={formData.install_date}
                    onChange={(e) => fieldTouch('install_date', e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">
                    Expiry Date
                    {aiFilledKeys.has('expiry_date') && <span className="ai-tag">✨ AI</span>}
                  </label>
                  <input
                    required
                    type="date"
                    className={`modal-input ${aiFilledKeys.has('expiry_date') ? 'ai-filled' : ''}`}
                    style={{ colorScheme: "dark" }}
                    value={formData.expiry_date}
                    onChange={(e) => fieldTouch('expiry_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="add-btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner-sm" /> Saving…
                    </>
                  ) : (
                    "Save Contract"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <button className="back-btn" onClick={() => navigate("/")}>←</button>
            <div className="logo-mark">🛡️</div>
            <div>
              <h1 className="page-title">AMC Tracking</h1>
              <p className="page-subtitle">Keep every maintenance contract in view — and renewals before they lapse.</p>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="glass stat-card active">
            <div className="stat-glow" style={{ background: "#34d399" }} />
            <div className="stat-icon-badge">🛡️</div>
            <h2>Active Contracts</h2>
            <p className="amount">{activeCount}</p>
          </div>
          <div className="glass stat-card expiring">
            <div className="stat-glow" style={{ background: "#fb923c" }} />
            <div className="stat-icon-badge">⏳</div>
            <h2>Expiring Soon (&lt;30 Days)</h2>
            <p className="amount">{expiringCount}</p>
          </div>
          <div className="glass stat-card expired">
            <div className="stat-glow" style={{ background: "#f43f5e" }} />
            <div className="stat-icon-badge">⚠️</div>
            <h2>Expired Contracts</h2>
            <p className="amount">{expiredCount}</p>
          </div>
        </div>

        <div className="layout-grid">
          <div className="glass panel">
            <div className="toolbar">
              <div className="toolbar-left">
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by client or product…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="expiry_asc">Sort: Expiry (Soonest)</option>
                  <option value="expiry_desc">Sort: Expiry (Latest)</option>
                  <option value="name">Sort: Client Name</option>
                </select>
                <div className="filter-tabs">
                  <button className={`tab-btn ${filterStatus === "ALL" ? "active" : ""}`} onClick={() => setFilterStatus("ALL")}>All</button>
                  <button className={`tab-btn ${filterStatus === "Active" ? "active" : ""}`} onClick={() => setFilterStatus("Active")}>Active</button>
                  <button className={`tab-btn ${filterStatus === "Expiring Soon" ? "active" : ""}`} onClick={() => setFilterStatus("Expiring Soon")}>Expiring</button>
                  <button className={`tab-btn ${filterStatus === "Expired" ? "active" : ""}`} onClick={() => setFilterStatus("Expired")}>Expired</button>
                </div>
              </div>
              <button className="add-btn" onClick={() => setIsModalOpen(true)}>
                + Add Contract
              </button>
            </div>

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Product / Service</th>
                    <th>Install Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr className="skeleton-row" key={`sk-${i}`}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j}><div className="skeleton-bar" /></td>
                        ))}
                      </tr>
                    ))}

                  {!loading && loadError && amcData.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        <div className="empty-block">
                          <div className="icon">⚠️</div>
                          <h3>Loading Failed</h3>
                          <p>Couldn't load AMC contracts.</p>
                          <button className="retry-btn" onClick={fetchAmcContracts}>↻ Retry</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !loadError &&
                    filteredData.map((item, idx) => {
                      const dynamicStatus = calculateStatus(item.expiry_date);
                      const meta = STATUS_META[dynamicStatus] || STATUS_META.Unknown;
                      const days = daysUntil(item.expiry_date);
                      const initials = (item.client_name || "?").trim().slice(0, 2).toUpperCase();
                      const rowClass = dynamicStatus === "Expired" ? "row-expired" : dynamicStatus === "Expiring Soon" ? "row-expiring" : "";

                      return (
                        <tr key={item.id} className={rowClass} style={{ animationDelay: `${Math.min(idx * 0.04, 0.5)}s` }}>
                          <td>
                            <div className="client-cell">
                              <div className="client-avatar">{initials}</div>
                              <div>
                                <div style={{ fontWeight: 800, color: "white", fontSize: "1.05rem" }}>{item.client_name}</div>
                                {days !== null && (
                                  <div className="days-chip">
                                    {days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {item.contact_number ? (
                              <span className="contact-chip">
                                <span className="contact-dot" />
                                {item.contact_number}
                              </span>
                            ) : (
                              <span className="contact-chip missing">— not saved</span>
                            )}
                          </td>
                          <td style={{ color: "#cbd5e1" }}>{item.product_details}</td>
                          <td style={{ color: "rgba(226,232,240,0.6)" }}>{item.install_date ? new Date(item.install_date).toLocaleDateString("en-IN") : "—"}</td>
                          <td style={{ fontWeight: 700, color: "#f1f5f9" }}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString("en-IN") : "—"}</td>
                          <td>
                            <span className="status-badge" style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}>
                              <span className="status-dot" style={{ background: meta.text }} />
                              {dynamicStatus}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button className="action-btn" onClick={() => sendWhatsAppAlert(item)}>
                              <span>📨</span> Send Alert
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && !loadError && filteredData.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        <div className="empty-block">
                          <div className="icon">📂</div>
                          <h3>No Records Found</h3>
                          <p>
                            {amcData.length === 0
                              ? "No AMC contracts yet. Add your first one to start tracking renewals."
                              : "No contracts match your current filter or search criteria."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Renewals radar side panel */}
          <div className="glass radar-panel">
            <div className="radar-title">📡 Renewals Radar</div>
            <div className="radar-sub">Contracts needing attention, soonest first</div>

            {loading && (
              <div>
                {[0, 1, 2].map((i) => <div key={`r-${i}`} className="skeleton-bar" style={{ height: 40, marginBottom: 15 }} />)}
              </div>
            )}

            {!loading && radarItems.length === 0 && (
              <div className="radar-empty">🎉 Nothing needs attention right now.</div>
            )}

            {!loading &&
              radarItems.map((item, idx) => {
                const status = calculateStatus(item.expiry_date);
                const meta = STATUS_META[status] || STATUS_META.Unknown;
                const days = daysUntil(item.expiry_date);
                return (
                  <div className="radar-item" key={`radar-${item.id}`} style={{ animationDelay: `${idx * 0.06}s` }}>
                    <div>
                      <div className="radar-name">{item.client_name}</div>
                      <div className="radar-product">{item.product_details}</div>
                    </div>
                    <span className="radar-days" style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}>
                      {days >= 0 ? `${days}d left` : `${Math.abs(days)}d over`}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "ℹ️"} {t.message}
          </div>
        ))}
      </div>
    </>
  );
}