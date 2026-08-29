import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const SORT_OPTIONS = [
  { id: "due_desc", label: "Highest Due" },
  { id: "name", label: "Name (A–Z)" },
  { id: "recent", label: "Most Recent Payment" },
];

// --- Smooth ease-out count-up used for the summary + stat numbers ---
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

export default function VendorLedger() {
  const navigate = useNavigate();
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL, PENDING, SETTLED
  const [sortBy, setSortBy] = useState("due_desc");
  const [processingId, setProcessingId] = useState(null);
  const [barsReady, setBarsReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    setBarsReady(false);
    const t = setTimeout(() => setBarsReady(true), 80);
    return () => clearTimeout(t);
  }, [loading, filter, sortBy, searchQuery]);

  // Live ticking clock for the status strip
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const pushToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  const fetchVendors = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get("/vendors");
      setLedgerData(res.data || []);
    } catch (error) {
      console.error("Failed to fetch vendor ledger", error);
      setLoadError(true);
      pushToast("Couldn't load vendor ledger.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  const handleMarkPaid = async (id, name) => {
    if (!window.confirm(`Are you sure you want to mark all pending dues for ${name} as fully settled?`)) {
      return;
    }

    setProcessingId(id);
    try {
      await api.put(`/vendors/${id}/pay`);
      await fetchVendors();
      pushToast(`${name} marked as fully settled.`, "success");
    } catch (error) {
      console.error("Failed to update vendor payment", error);
      pushToast("Failed to mark vendor as paid. Please try again.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // ---- Summary stats ----
  const stats = useMemo(() => {
    const totalPayable = ledgerData.reduce((acc, v) => acc + (Number(v.pending) || 0), 0);
    const totalPaid = ledgerData.reduce((acc, v) => acc + (Number(v.paid) || 0), 0);
    const totalVendors = ledgerData.length;
    const pendingCount = ledgerData.filter((v) => Number(v.pending) > 0).length;
    const settledCount = totalVendors - pendingCount;
    return { totalPayable, totalPaid, totalVendors, pendingCount, settledCount };
  }, [ledgerData]);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = ledgerData.filter((vendor) => {
      const matchesSearch = (vendor.name || "").toLowerCase().includes(q);
      const isPending = Number(vendor.pending) > 0;
      if (filter === "PENDING") return matchesSearch && isPending;
      if (filter === "SETTLED") return matchesSearch && !isPending;
      return matchesSearch;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "due_desc") return (Number(b.pending) || 0) - (Number(a.pending) || 0);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "recent") {
        const da = a.last_payment ? new Date(a.last_payment).getTime() : 0;
        const db = b.last_payment ? new Date(b.last_payment).getTime() : 0;
        return db - da;
      }
      return 0;
    });

    return list;
  }, [ledgerData, searchQuery, filter, sortBy]);

  // Animated numbers
  const statsReady = !loading;
  const animPayable = useCountUp(stats.totalPayable, 1300, statsReady);
  const animVendors = useCountUp(stats.totalVendors, 900, statsReady);
  const animPending = useCountUp(stats.pendingCount, 900, statsReady);
  const animSettled = useCountUp(stats.settledCount, 900, statsReady);
  const animPaid = useCountUp(stats.totalPaid, 1100, statsReady);

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }

        body {
          background-color: #08080b;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
            radial-gradient(circle at 85% -10%, rgba(244, 63, 94, 0.10) 0%, transparent 42%),
            radial-gradient(circle at 5% 105%, rgba(56, 189, 248, 0.09) 0%, transparent 45%);
          background-size: 40px 40px, 40px 40px, auto, auto;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        .mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rowIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatIcon { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-6px) rotate(-3deg); } }
        @keyframes shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
        @keyframes pulseRing { 0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.25); } 50% { box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes checkPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes gradientSweepText { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes ringSpin { to { transform: rotate(360deg); } }
        @keyframes dotPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); } 50% { box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); } }
        @keyframes scanSweep { 0% { transform: translateY(-10%); opacity: 0; } 10% { opacity: 0.5; } 90% { opacity: 0.5; } 100% { transform: translateY(110vh); opacity: 0; } }
        @keyframes drift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px, -16px) scale(1.05); } }

        .bg-blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.18; pointer-events: none; z-index: 0; }
        .bg-blob.b1 { width: 420px; height: 420px; top: -140px; right: -120px; background: radial-gradient(circle, #f43f5e, transparent 70%); animation: drift 15s ease-in-out infinite; }
        .bg-blob.b2 { width: 360px; height: 360px; bottom: -140px; left: -100px; background: radial-gradient(circle, #38bdf8, transparent 70%); animation: drift 18s ease-in-out infinite reverse; }
        .bg-blob.b3 { width: 280px; height: 280px; top: 45%; left: 60%; background: radial-gradient(circle, #a78bfa, transparent 70%); opacity: 0.12; animation: drift 21s ease-in-out infinite; }

        .scan-line { position: fixed; left: 0; right: 0; height: 140px; background: linear-gradient(180deg, transparent, rgba(244, 63, 94, 0.045), transparent); pointer-events: none; z-index: 0; animation: scanSweep 11s linear infinite; }

        .page-container { max-width: 1150px; margin: auto; padding: 40px 20px 70px; animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) both; position: relative; z-index: 1; }

        /* ---- Status strip / header ---- */
        .status-strip {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 15px;
          background: rgba(255,255,255,0.035); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 14px 18px;
        }
        .header-row { display: flex; align-items: center; gap: 14px; }
        .back-btn {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); color: white;
          width: 40px; height: 40px; border-radius: 12px; font-size: 1.05rem; cursor: pointer;
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), background 0.25s ease, border-color 0.25s ease;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .back-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); transform: translateX(-3px); }

        .brand-mark {
          position: relative; width: 40px; height: 40px; border-radius: 12px; display: none;
        }

        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: dotPulse 2s ease-in-out infinite; display: inline-block; margin-right: 6px; }
        .status-text { font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #7d8798; }

        .page-title {
          margin: 4px 0 0; font-size: 1.7rem; font-weight: 800; font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.01em;
          background: linear-gradient(90deg, #ffffff 0%, #f43f5e 45%, #38bdf8 75%, #ffffff 100%);
          background-size: 260% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: gradientSweepText 8s linear infinite;
        }
        .page-subtitle { margin: 2px 0 0; font-size: 12.5px; color: #7d8798; font-weight: 500; }

        .status-strip-right { font-size: 11px; color: #64748b; text-align: right; letter-spacing: 0.4px; }
        .status-strip-right .clock { display: block; font-size: 15px; color: #e2e8f0; font-weight: 600; margin-top: 3px; letter-spacing: 1px; }

        .btn-log-bill {
          background: linear-gradient(135deg, #3b82f6, #6366f1); background-size: 160% 160%; color: white; border: none;
          padding: 11px 20px; border-radius: 10px; font-weight: 700; cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, background-position 0.25s ease;
          display: flex; align-items: center; gap: 8px; font-family: inherit; font-size: 14px;
        }
        .btn-log-bill:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -10px rgba(99, 102, 241, 0.5); background-position: 100% 0%; }

        /* ---- Tilt + spotlight mechanics ---- */
        .tilt-card { transform-style: preserve-3d; perspective: 900px; }
        .card-spotlight {
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(460px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.09), transparent 45%);
          opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        .tilt-card:hover .card-spotlight { opacity: 1; }

        /* ---- Summary card ---- */
        .summary-card {
          position: relative;
          background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);
          padding: 30px; border-radius: 18px; margin-bottom: 18px;
          box-shadow: 0 14px 34px rgba(225, 29, 72, 0.28);
          display: flex; justify-content: space-between; align-items: center;
          overflow: hidden;
          animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.04s both;
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease;
        }
        .summary-card:hover { box-shadow: 0 20px 44px rgba(225, 29, 72, 0.4); }
        .summary-card::before {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.14) 50%, transparent 80%);
          transform: translateX(-100%); transition: transform 0.7s ease; pointer-events: none;
        }
        .summary-card:hover::before { transform: translateX(100%); }
        .summary-card h2 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.85); font-weight: 700; position: relative; }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; font-family: 'Space Grotesk', sans-serif; position: relative; }
        .summary-icon { position: absolute; right: -10px; bottom: -20px; font-size: 8rem; opacity: 0.15; animation: floatIcon 6s ease-in-out infinite; }

        /* ---- Stat strip ---- */
        .stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }
        @media (max-width: 850px) { .stat-strip { grid-template-columns: repeat(2, 1fr); } }
        .stat-chip {
          position: relative; overflow: hidden;
          background: linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.07); border-radius: 13px; padding: 15px 17px;
          animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease;
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
        }
        .stat-chip:hover { transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-3px); border-color: rgba(244,63,94,0.3); box-shadow: 0 14px 28px -16px rgba(244,63,94,0.3); }
        .stat-chip-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #7d8798; font-weight: 700; margin-bottom: 6px; position: relative; }
        .stat-chip-value { font-size: 1.3rem; font-weight: 800; font-family: 'Space Grotesk', sans-serif; position: relative; }

        /* ---- Panel ---- */
        .panel {
          position: relative;
          background: linear-gradient(160deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 25px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.08s both;
        }

        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 220px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(255,255,255,0.03); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input::placeholder { color: #5b6472; }
        .search-input:focus { border-color: #f43f5e; background: rgba(244,63,94,0.05); box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.14); }
        .search-input:focus-visible { outline: none; }

        .toolbar-right { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

        .sort-select { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09); color: #cbd5e1; padding: 9px 12px; border-radius: 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: border-color 0.2s ease; }
        .sort-select:hover, .sort-select:focus { border-color: #f43f5e; outline: none; }

        .filter-tabs { display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 12px; font-family: inherit; }
        .tab-btn.active { background: linear-gradient(135deg, #f43f5e, #be123c); color: white; box-shadow: 0 6px 14px -6px rgba(244,63,94,0.55); }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }
        .tab-btn:focus-visible, .back-btn:focus-visible, .btn-log-bill:focus-visible, .btn-pay:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }

        .vendor-list { display: flex; flex-direction: column; gap: 15px; }
        .vendor-item {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px;
          display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 20px; align-items: center;
          transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
          animation: rowIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .vendor-item::before {
          content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, #f43f5e, #38bdf8); transform: scaleY(0); transform-origin: top;
          transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        .vendor-item:hover::before { transform: scaleY(1); }
        .vendor-item:hover { background: rgba(255,255,255,0.045); border-color: rgba(244, 63, 94, 0.3); transform: translateY(-2px); box-shadow: 0 10px 24px -12px rgba(0,0,0,0.5); }
        .vendor-item.urgent { border-color: rgba(244, 63, 94, 0.22); }
        @media (max-width: 768px) { .vendor-item { grid-template-columns: 1fr; gap: 15px; } }

        .v-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .v-name { font-size: 1.2rem; font-weight: 700; color: white; }
        .v-avatar {
          position: relative; width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #f43f5e, #be123c); display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px; flex-shrink: 0;
        }
        .v-avatar::before {
          content: ''; position: absolute; inset: -2px; border-radius: 50%; padding: 1px;
          background: conic-gradient(from 0deg, #f43f5e, #38bdf8, #a78bfa, #f43f5e);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          opacity: 0; transition: opacity 0.3s ease; animation: ringSpin 4s linear infinite;
        }
        .vendor-item:hover .v-avatar::before { opacity: 1; }
        .v-meta { font-size: 0.85rem; color: #94a3b8; }

        .progress-container { width: 100%; margin-top: 10px; }
        .progress-bar-bg { width: 100%; height: 7px; background: rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
        .progress-bar-fill { height: 100%; width: 0%; border-radius: 10px; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); position: relative; }
        .progress-bar-fill::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          background-size: 200% 100%; animation: shimmer 2.2s linear infinite;
        }
        .progress-labels { display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; color: #64748b; font-weight: 600; }

        .v-pending { font-size: 1.3rem; font-weight: 800; color: #f43f5e; text-align: right; font-family: 'Space Grotesk', sans-serif; }
        .v-settled { font-size: 1.05rem; font-weight: 800; color: #10b981; text-align: right; display: flex; align-items: center; gap: 6px; justify-content: flex-end; padding: 8px 0; }
        .v-settled svg { animation: checkPop 0.4s cubic-bezier(0.16,1,0.3,1) both; }

        .btn-pay { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #fca5a5; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-width: 140px; font-family: inherit; margin-top: 10px; }
        .btn-pay:hover:not(:disabled) { background: #f43f5e; border-color: #f43f5e; color: white; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(244, 63, 94, 0.45); }
        .btn-pay:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-pay.urgent-pulse:not(:disabled) { animation: pulseRing 2.4s ease-in-out infinite; }

        .spinner-sm { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.35); border-top-color: currentColor; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

        .skeleton-item { height: 92px; border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.03) 80%); background-size: 600px 100%; animation: shimmer 1.4s ease-in-out infinite; }

        .empty-block { text-align: center; padding: 50px; color: #64748b; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1); animation: fadeIn 0.4s ease both; }
        .empty-block .icon { font-size: 30px; margin-bottom: 10px; }
        .empty-block h3 { margin: 0 0 5px 0; color: white; }
        .empty-block p { margin: 0; font-size: 13px; }

        .retry-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e2e8f0; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12.5px; font-family: inherit; transition: background 0.2s ease; margin-top: 14px; }
        .retry-btn:hover { background: rgba(255,255,255,0.12); }

        .toast-stack { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 10px; z-index: 50; max-width: 340px; }
        .toast { padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: white; background: #131418; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.5); animation: toastIn 0.3s cubic-bezier(0.16,1,0.3,1) both; display: flex; align-items: center; gap: 8px; }
        .toast.success { border-color: rgba(16,185,129,0.4); }
        .toast.error { border-color: rgba(239,68,68,0.4); }
        .toast.info { border-color: rgba(56,189,248,0.4); }

        @media (max-width: 640px) {
          .status-strip { flex-direction: column; align-items: flex-start; }
          .status-strip-right { text-align: left; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div className="bg-blob b1" />
      <div className="bg-blob b2" />
      <div className="bg-blob b3" />
      <div className="scan-line" />

      <div className="page-container">
        <div className="status-strip">
          <div className="header-row">
            <button className="back-btn" onClick={() => navigate("/")}>←</button>
            <div>
              <div><span className="status-dot"></span><span className="status-text">Live Ledger</span></div>
              <h1 className="page-title">Vendor Ledger</h1>
              <p className="page-subtitle">Track what you owe suppliers and settle dues in one place.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div className="status-strip-right">
              <span>{now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</span>
              <span className="clock mono">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</span>
            </div>
            <button className="btn-log-bill" onClick={() => navigate("/purchase-invoices")}>
              ➕ Log New Bill
            </button>
          </div>
        </div>

        <div className="summary-card tilt-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
          <span className="card-spotlight" />
          <div style={{ zIndex: 1, position: "relative" }}>
            <h2>Total Outstanding Payables</h2>
            <p className="amount mono">₹{formatCurrency(animPayable)}</p>
          </div>
          <div className="summary-icon">💸</div>
        </div>

        <div className="stat-strip">
          <div className="stat-chip tilt-card" style={{ animationDelay: "0.03s" }} onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <div className="stat-chip-label">Total Vendors</div>
            <div className="stat-chip-value mono">{Math.round(animVendors)}</div>
          </div>
          <div className="stat-chip tilt-card" style={{ animationDelay: "0.08s" }} onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <div className="stat-chip-label">Pending</div>
            <div className="stat-chip-value mono" style={{ color: "#fb923c" }}>{Math.round(animPending)}</div>
          </div>
          <div className="stat-chip tilt-card" style={{ animationDelay: "0.13s" }} onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <div className="stat-chip-label">Fully Settled</div>
            <div className="stat-chip-value mono" style={{ color: "#34d399" }}>{Math.round(animSettled)}</div>
          </div>
          <div className="stat-chip tilt-card" style={{ animationDelay: "0.18s" }} onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="card-spotlight" />
            <div className="stat-chip-label">Total Paid</div>
            <div className="stat-chip-value mono">₹{formatCurrency(animPaid)}</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input
              type="text"
              className="search-input"
              placeholder="Search suppliers by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="toolbar-right">
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>Sort: {opt.label}</option>
                ))}
              </select>

              <div className="filter-tabs">
                <button className={`tab-btn ${filter === "ALL" ? "active" : ""}`} onClick={() => setFilter("ALL")}>
                  All
                </button>
                <button className={`tab-btn ${filter === "PENDING" ? "active" : ""}`} onClick={() => setFilter("PENDING")}>
                  Pending
                </button>
                <button className={`tab-btn ${filter === "SETTLED" ? "active" : ""}`} onClick={() => setFilter("SETTLED")}>
                  Settled
                </button>
              </div>
            </div>
          </div>

          <div className="vendor-list">
            {loading &&
              [0, 1, 2, 3].map((i) => (
                <div className="skeleton-item" key={i} style={{ animationDelay: `${i * 0.06}s` }} />
              ))}

            {!loading && loadError && ledgerData.length === 0 && (
              <div className="empty-block">
                <div className="icon">⚠️</div>
                <h3>Couldn't load vendor data</h3>
                <p>Check your connection and try again.</p>
                <button className="retry-btn" onClick={fetchVendors}>↻ Retry</button>
              </div>
            )}

            {!loading &&
              !loadError &&
              filteredData.map((vendor, idx) => {
                const totalBilled = Number(vendor.total_billed) || 0;
                const paid = Number(vendor.paid) || 0;
                const pending = Number(vendor.pending) || 0;
                const percentPaid = totalBilled > 0 ? Math.min(100, Math.round((paid / totalBilled) * 100)) : 100;
                const isUrgent = pending > 0 && stats.totalPayable > 0 && pending / stats.totalPayable > 0.3;
                const initials = (vendor.name || "?").trim().slice(0, 2).toUpperCase();

                return (
                  <div className={`vendor-item ${isUrgent ? "urgent" : ""}`} key={vendor.id} style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                    {/* Column 1: Info */}
                    <div>
                      <div className="v-name-row">
                        <div className="v-avatar">{initials}</div>
                        <div className="v-name">{vendor.name}</div>
                      </div>
                      <div className="v-meta">
                        Last Payment Date: {vendor.last_payment ? new Date(vendor.last_payment).toLocaleDateString("en-IN") : "N/A"}
                      </div>
                    </div>

                    {/* Column 2: Progress */}
                    <div className="progress-container">
                      <div className="progress-labels">
                        <span>Paid: ₹{formatCurrency(paid)}</span>
                        <span>Total: ₹{formatCurrency(totalBilled)}</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: barsReady ? `${percentPaid}%` : "0%",
                            background: percentPaid === 100 ? "#10b981" : "#38bdf8",
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Column 3: Action */}
                    <div style={{ textAlign: "right" }}>
                      {pending > 0 ? (
                        <>
                          <div className="v-pending mono">Due: ₹{formatCurrency(pending)}</div>
                          <button
                            className={`btn-pay ${isUrgent ? "urgent-pulse" : ""}`}
                            onClick={() => handleMarkPaid(vendor.id, vendor.name)}
                            disabled={processingId === vendor.id}
                          >
                            {processingId === vendor.id ? (
                              <>
                                <span className="spinner-sm" /> Processing…
                              </>
                            ) : (
                              "✓ Mark as Paid"
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="v-settled">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Fully Settled
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {!loading && !loadError && filteredData.length === 0 && (
              <div className="empty-block">
                <div className="icon">📦</div>
                <h3>No Vendors Found</h3>
                <p>
                  {ledgerData.length === 0
                    ? "You haven't logged any purchase bills yet."
                    : "No vendors match your current search or filters."}
                </p>
              </div>
            )}
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