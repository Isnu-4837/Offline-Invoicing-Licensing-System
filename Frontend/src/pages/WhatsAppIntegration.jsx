import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const MOCK_LOGS = [
  { id: 1, name: "Apex Industries", phone: "+91 98765 43210", time: "Today, 10:30 AM", status: "sent" },
  { id: 2, name: "BlueRidge Retail", phone: "+91 87654 32109", time: "Yesterday, 02:15 PM", status: "delivered" },
  { id: 3, name: "Unknown", phone: "+91 76543 21098", time: "24 Aug 2026, 11:00 AM", status: "failed" },
  { id: 4, name: "Harborline Traders", phone: "+91 90123 45678", time: "23 Aug 2026, 04:42 PM", status: "delivered" },
];

const STATUS_META = {
  sent: { label: "Sent", cls: "badge-sent" },
  delivered: { label: "Delivered", cls: "badge-delivered" },
  failed: { label: "Failed", cls: "badge-failed" },
};

const FILTERS = ["all", "sent", "delivered", "failed"];

function formatClock() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function WhatsAppIntegration() {
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [justSent, setJustSent] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileInputRef = useRef(null);

  // Automatically catch the data passed from the AutoReminders page
  useEffect(() => {
    if (location.state) {
      if (location.state.phone) setPhone(location.state.phone);
      if (location.state.message) setMessage(location.state.message);
    }
  }, [location]);

  // Live ticking clock for the connection status strip
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleOpenWhatsApp = () => {
    if (!phone) {
      return alert("Please enter a valid client phone number.");
    }
    if (!message) {
      return alert("Please enter a message body.");
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const encodedMessage = encodeURIComponent(message);

    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");

    setJustSent(true);
    window.setTimeout(() => setJustSent(false), 2200);
  };

  const acceptDroppedFile = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please attach a PDF file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    acceptDroppedFile(file);
  }, []);

  // --- 3D tilt + cursor spotlight for glass panels ---
  const handleTilt = useCallback((e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty("--rx", `${(py - 0.5) * -5}deg`);
    card.style.setProperty("--ry", `${(px - 0.5) * 5}deg`);
    card.style.setProperty("--mx", `${px * 100}%`);
    card.style.setProperty("--my", `${py * 100}%`);
  }, []);

  const resetTilt = useCallback((e) => {
    const card = e.currentTarget;
    card.style.setProperty("--rx", `0deg`);
    card.style.setProperty("--ry", `0deg`);
  }, []);

  const filteredLogs = useMemo(
    () => (filter === "all" ? MOCK_LOGS : MOCK_LOGS.filter((l) => l.status === filter)),
    [filter]
  );

  const displayPhone = phone.trim() ? phone : "your client";
  const clock = useMemo(() => formatClock(), []);

  return (
    <>
      <style>{`
        :root {
          --wa-bg: #0b141a;
          --wa-panel: #111b21;
          --wa-panel-alt: #182229;
          --wa-input: #2a3942;
          --wa-green: #00a884;
          --wa-green-bright: #25d366;
          --wa-bubble-out: #005c4b;
          --wa-text: #e9edef;
          --wa-text-muted: #8696a0;
          --wa-border: rgba(255,255,255,0.07);
          --wa-danger: #f15c5c;
          --wa-warning: #ffbb44;
        }

        * { box-sizing: border-box; }

        body {
          background:
            radial-gradient(circle at 15% -10%, rgba(0,168,132,0.16), transparent 45%),
            radial-gradient(circle at 100% 10%, rgba(37,211,102,0.10), transparent 40%),
            radial-gradient(circle at 50% 100%, rgba(56,189,248,0.08), transparent 45%),
            var(--wa-bg);
          font-family: 'Segoe UI', 'Helvetica Neue', Inter, -apple-system, sans-serif;
          color: var(--wa-text);
          margin: 0;
          min-height: 100vh;
        }

        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(110px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.55;
          animation: orbDrift 16s ease-in-out infinite;
        }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, -4%) scale(1.07); }
        }

        .page-container { max-width: 1320px; margin: auto; padding: 36px 24px 60px; position: relative; z-index: 1; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.55); }
          70% { box-shadow: 0 0 0 8px rgba(37,211,102,0); }
        }
        @keyframes blinkCursor {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes checkSweep {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes toastSlide {
          0% { opacity: 0; transform: translateY(-10px) scale(0.96); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
        }
        @keyframes scanSweepWA {
          0% { transform: translateY(-10%); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(110vh); opacity: 0; }
        }

        .wa-scan-line {
          position: fixed; left: 0; right: 0; height: 140px;
          background: linear-gradient(180deg, transparent, rgba(37, 211, 102, 0.05), transparent);
          pointer-events: none; z-index: 0; animation: scanSweepWA 13s linear infinite;
        }

        /* ---- Tilt + spotlight mechanics ---- */
        .tilt-panel { transform-style: preserve-3d; perspective: 900px; }
        .panel-spotlight {
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(460px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08), transparent 45%);
          opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        .tilt-panel:hover .panel-spotlight { opacity: 1; }

        .clock-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; color: var(--wa-text-muted);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 5px 12px; border-radius: 999px;
          font-variant-numeric: tabular-nums;
        }

        .header-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
          opacity: 0;
          animation: fadeInUp 0.55s ease forwards;
        }
        .back-btn {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--wa-text);
          width: 42px; height: 42px;
          border-radius: 50%;
          font-size: 1.15rem;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .back-btn:hover { background: var(--wa-input); transform: scale(1.06) translateX(-1px); border-color: var(--wa-green); }
        .back-btn:active { transform: scale(0.96); }

        .header-titles { display: flex; flex-direction: column; gap: 4px; }
        .header-titles h1 { margin: 0; font-size: 1.65rem; font-weight: 700; letter-spacing: -0.01em; }
        .conn-status { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--wa-text-muted); }
        .conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--wa-green-bright); animation: pulseDot 2.2s infinite; }

        .grid-layout {
          display: grid;
          grid-template-columns: 1fr 0.82fr 1.15fr;
          gap: 22px;
          align-items: start;
        }
        @media (max-width: 1100px) { .grid-layout { grid-template-columns: 1fr 1fr; } .logs-panel { grid-column: 1 / -1; } }
        @media (max-width: 720px) { .grid-layout { grid-template-columns: 1fr; } }

        .panel {
          position: relative;
          background: rgba(255, 255, 255, 0.045);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 18px;
          padding: 24px;
          box-shadow:
            0 14px 34px rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.08);
          opacity: 0;
          animation: fadeInUp 0.55s ease forwards;
          transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
        }
        .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0) 42%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .panel:hover { border-color: rgba(0,168,132,0.4); transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12); }
        .compose-panel { animation-delay: 0.08s; }
        .preview-panel { animation-delay: 0.16s; }
        .logs-panel { animation-delay: 0.24s; }

        .panel-title {
          margin: 0 0 20px 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--wa-green-bright);
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .panel-title svg { flex-shrink: 0; }

        .input-label {
          display: block;
          font-size: 11px;
          color: var(--wa-text-muted);
          margin-bottom: 7px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .input-field {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.045);
          backdrop-filter: blur(10px);
          color: var(--wa-text);
          font-size: 13.5px;
          box-sizing: border-box;
          margin-bottom: 18px;
          font-family: inherit;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .input-field::placeholder { color: #5c6b73; }
        .input-field:focus {
          outline: none;
          border-color: var(--wa-green-bright);
          background: rgba(0, 168, 132, 0.10);
          box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.14);
        }
        textarea.input-field { min-height: 116px; resize: vertical; line-height: 1.5; }

        .upload-zone {
          position: relative;
          border: 1.5px dashed rgba(255,255,255,0.16);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          margin-bottom: 8px;
          transition: border-color 0.2s ease, background 0.2s ease;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(8px);
        }
        .upload-zone:hover, .upload-zone.drag-active { border-color: var(--wa-green); background: rgba(0,168,132,0.08); }
        .upload-zone.drag-active { box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.16); transform: scale(1.01); }
        .upload-zone input[type="file"] {
          position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .upload-hint { font-size: 12px; color: var(--wa-text-muted); pointer-events: none; }
        .upload-hint strong { color: var(--wa-green-bright); }
        .file-chip {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(0,168,132,0.16);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0,168,132,0.35);
          color: #7ee6c7;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          margin-top: 10px;
          animation: popIn 0.25s ease;
        }
        .file-notice { font-size: 11px; color: var(--wa-text-muted); margin: 10px 0 20px; display: block; }

        .wa-btn {
          position: relative;
          background: linear-gradient(135deg, var(--wa-green-bright) 0%, var(--wa-green) 100%);
          color: #06231a;
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 12px;
          font-weight: 800;
          font-size: 14.5px;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          margin-top: 6px;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.28), inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .wa-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(37, 211, 102, 0.42); }
        .wa-btn:active { transform: translateY(0); }

        .toast {
          position: absolute;
          top: -46px; left: 50%; transform: translateX(-50%);
          background: rgba(31, 44, 51, 0.7);
          backdrop-filter: blur(16px) saturate(160%);
          color: var(--wa-green-bright);
          border: 1px solid rgba(37,211,102,0.4);
          padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
          white-space: nowrap;
          animation: toastSlide 2.2s ease forwards;
          pointer-events: none;
        }

        /* Live preview phone mockup */
        .phone-frame {
          background:
            radial-gradient(circle at 20% 10%, rgba(255,255,255,0.05), transparent 40%),
            rgba(0,0,0,0.22);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          padding: 14px 12px 16px;
          min-height: 300px;
          display: flex;
          flex-direction: column;
        }
        .phone-header {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 12px; margin-bottom: 14px;
          border-bottom: 1px solid var(--wa-border);
        }
        .phone-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #3a4a52, #24313a);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: var(--wa-text-muted);
        }
        .phone-contact-name { font-size: 13px; font-weight: 700; color: var(--wa-text); }
        .phone-contact-sub { font-size: 10.5px; color: var(--wa-text-muted); }

        .bubble-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; }
        .bubble {
          align-self: flex-end;
          max-width: 88%;
          background: var(--wa-bubble-out);
          color: #e9fff5;
          padding: 9px 12px 7px;
          border-radius: 10px 10px 2px 10px;
          font-size: 13px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
          animation: popIn 0.3s ease;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        }
        .bubble-meta {
          display: flex; align-items: center; gap: 4px; justify-content: flex-end;
          margin-top: 4px; font-size: 10px; color: rgba(233,255,245,0.65);
        }
        .bubble-placeholder {
          align-self: flex-end;
          color: var(--wa-text-muted);
          font-size: 12.5px;
          font-style: italic;
        }
        .type-cursor { display: inline-block; width: 2px; height: 13px; background: var(--wa-green-bright); margin-left: 2px; animation: blinkCursor 1s step-start infinite; vertical-align: middle; }
        .file-bubble-chip {
          display: flex; align-items: center; gap: 6px;
          background: rgba(0,0,0,0.18);
          border-radius: 8px;
          padding: 6px 8px;
          margin-bottom: 6px;
          font-size: 11.5px;
        }

        /* Logs */
        .filter-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-tab {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.10);
          color: var(--wa-text-muted);
          padding: 6px 13px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: capitalize;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .filter-tab:hover { color: var(--wa-text); border-color: rgba(255,255,255,0.24); }
        .filter-tab.active {
          background: linear-gradient(135deg, rgba(0,168,132,0.35), rgba(37,211,102,0.30));
          border-color: rgba(37,211,102,0.5);
          color: var(--wa-green-bright);
          box-shadow: 0 4px 14px rgba(0,168,132,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
        }

        .table { width: 100%; border-collapse: collapse; }
        .table th {
          text-align: left; padding: 10px 10px; font-size: 11px; font-weight: 700;
          color: var(--wa-text-muted); text-transform: uppercase; letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
        }
        .table tr.log-row {
          opacity: 0;
          animation: fadeIn 0.4s ease forwards;
          transition: background 0.18s ease;
        }
        .table tr.log-row:hover { background: rgba(255,255,255,0.025); }
        .table td { padding: 14px 10px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }

        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 7px; font-size: 10px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .badge-sent { background: rgba(0,168,132,0.16); color: var(--wa-green-bright); border: 1px solid rgba(0,168,132,0.3); }
        .badge-delivered { background: rgba(255,187,68,0.14); color: var(--wa-warning); border: 1px solid rgba(255,187,68,0.3); }
        .badge-failed { background: rgba(241,92,92,0.14); color: var(--wa-danger); border: 1px solid rgba(241,92,92,0.3); }
        .badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        .empty-logs { text-align: center; padding: 30px 10px; color: var(--wa-text-muted); font-size: 13px; }
      `}</style>

      <div className="bg-orb" style={{ top: "-140px", left: "-120px", width: "420px", height: "420px", background: "rgba(0, 168, 132, 0.22)" }} />
      <div className="bg-orb" style={{ bottom: "-160px", right: "-120px", width: "480px", height: "480px", background: "rgba(37, 211, 102, 0.16)", animationDelay: "4s" }} />
      <div className="wa-scan-line" />

      <div className="page-container">
        <div className="header-row">
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Go back">←</button>
          <div className="header-titles">
            <h1>WhatsApp Integration</h1>
            <span className="conn-status">
              <span className="conn-dot" />
              WhatsApp Web connected
            </span>
          </div>
          <span className="clock-pill" style={{ marginLeft: "auto" }}>
            🕒 {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
        </div>

        <div className="grid-layout">
          {/* PANEL 1: Message Composer */}
          <div className="panel compose-panel tilt-panel" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="panel-spotlight" />
            <h3 className="panel-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.115.552 4.175 1.6 6.002L.01 24l6.14-1.61c1.782.98 3.79 1.498 5.88 1.498 6.646 0 12.03-5.385 12.03-12.03S18.677 0 12.03 0zm5.955 17.26c-.267.75-1.536 1.44-2.118 1.503-.54.06-1.25.132-3.52-.806-2.73-1.125-4.48-3.92-4.614-4.1-.132-.18-1.103-1.464-1.103-2.793 0-1.33.69-1.986.938-2.253.25-.268.54-.336.72-.336.18 0 .36 0 .513.008.163.007.382-.06.594.453.224.542.753 1.84.82 1.98.067.14.113.307.022.487-.09.18-.135.293-.27.443-.136.15-.285.334-.406.452-.136.136-.28.283-.122.535.158.252.705 1.144 1.516 1.944 1.045 1.032 1.925 1.352 2.177 1.488.252.136.4.113.55-.06.15-.173.645-.75.82-1.01.173-.26.345-.218.577-.127.23.09 1.462.69 1.713.826.25.136.417.204.478.32.06.114.06.66-.207 1.41z"/>
              </svg>
              Direct Message
            </h3>

            <label className="input-label">Client Phone Number</label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. 919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <label className="input-label">Message Body</label>
            <textarea
              className="input-field"
              placeholder="Dear Client, please find your attached invoice..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label className="input-label">Generated PDF</label>
            <div
              className={`upload-zone ${isDragActive ? "drag-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => acceptDroppedFile(e.target.files[0])}
              />
              <div className="upload-hint">
                <strong>Click to browse</strong> or drop a PDF here
              </div>
            </div>
            {selectedFile && (
              <div className="file-chip">
                📎 {selectedFile.name}
              </div>
            )}
            <span className="file-notice">
              Due to browser security restrictions, you must attach the PDF manually after WhatsApp Web opens.
            </span>

            <button className="wa-btn" onClick={handleOpenWhatsApp}>
              {justSent && <span className="toast">Opening WhatsApp Web…</span>}
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.115.552 4.175 1.6 6.002L.01 24l6.14-1.61c1.782.98 3.79 1.498 5.88 1.498 6.646 0 12.03-5.385 12.03-12.03S18.677 0 12.03 0zm5.955 17.26c-.267.75-1.536 1.44-2.118 1.503-.54.06-1.25.132-3.52-.806-2.73-1.125-4.48-3.92-4.614-4.1-.132-.18-1.103-1.464-1.103-2.793 0-1.33.69-1.986.938-2.253.25-.268.54-.336.72-.336.18 0 .36 0 .513.008.163.007.382-.06.594.453.224.542.753 1.84.82 1.98.067.14.113.307.022.487-.09.18-.135.293-.27.443-.136.15-.285.334-.406.452-.136.136-.28.283-.122.535.158.252.705 1.144 1.516 1.944 1.045 1.032 1.925 1.352 2.177 1.488.252.136.4.113.55-.06.15-.173.645-.75.82-1.01.173-.26.345-.218.577-.127.23.09 1.462.69 1.713.826.25.136.417.204.478.32.06.114.06.66-.207 1.41z"/>
              </svg>
              Open in WhatsApp
            </button>
          </div>

          {/* PANEL 2: Live Preview */}
          <div className="panel preview-panel tilt-panel" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="panel-spotlight" />            <h3 className="panel-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Live Preview
            </h3>
            <div className="phone-frame">
              <div className="phone-header">
                <div className="phone-avatar">
                  {displayPhone === "your client" ? "?" : displayPhone.replace(/[^0-9]/g, "").slice(-2)}
                </div>
                <div>
                  <div className="phone-contact-name">
                    {phone.trim() ? phone : "Awaiting number…"}
                  </div>
                  <div className="phone-contact-sub">via WhatsApp Web</div>
                </div>
              </div>

              <div className="bubble-area">
                {selectedFile && (
                  <div className="bubble" style={{ alignSelf: "flex-end" }}>
                    <div className="file-bubble-chip">📄 {selectedFile.name}</div>
                    <div className="bubble-meta">PDF attached</div>
                  </div>
                )}
                {message.trim() ? (
                  <div className="bubble">
                    {message}
                    <div className="bubble-meta">
                      {clock}
                      <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                        <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="24" strokeDashoffset="0" style={{ animation: "checkSweep 0.4s ease forwards" }} />
                        <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="24" strokeDashoffset="0" style={{ animation: "checkSweep 0.4s ease forwards" }} />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="bubble-placeholder">
                    Start typing to preview<span className="type-cursor" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PANEL 3: Message Logs */}
          <div className="panel logs-panel tilt-panel" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <span className="panel-spotlight" />            <h3 className="panel-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Recent Message Logs
            </h3>

            <div className="filter-tabs">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            {filteredLogs.length === 0 ? (
              <div className="empty-logs">No messages in this category yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Client / Number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => {
                    const meta = STATUS_META[log.status];
                    return (
                      <tr className="log-row" key={log.id} style={{ animationDelay: `${0.05 * i}s` }}>
                        <td style={{ color: "var(--wa-text-muted)" }}>{log.time}</td>
                        <td>
                          <strong style={{ display: "block", color: "var(--wa-text)" }}>{log.name}</strong>
                          <span style={{ fontSize: "11px", color: "var(--wa-text-muted)" }}>{log.phone}</span>
                        </td>
                        <td>
                          <span className={`badge ${meta.cls}`}>
                            <span className="badge-dot" />
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}