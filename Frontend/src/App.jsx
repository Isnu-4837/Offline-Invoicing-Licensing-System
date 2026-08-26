import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import api from "./api/axios";
import Dashboard from "./pages/Dashboard";          
import InvoiceGenerator from "./pages/InvoiceGenerator"; 
import InventoryManager from "./pages/Inventory";
import PurchaseInvoice from "./pages/PurchaseInvoice"; 
import AmcTracking from "./pages/AmcTracking";
import FollowUpReminders from "./pages/FollowUpReminders";
import LowStockAlerts from "./pages/LowStockAlerts";
import WhatsAppIntegration from "./pages/WhatsAppIntegration";
import AutoReminders from "./pages/AutoReminders";
import VendorLedger from "./pages/VendorLedger";
import StockHistory from "./pages/StockHistory";  
import SalesReports from "./pages/SalesReports";     

const ACTIVATION_STYLES = `
@keyframes bg-drift {
  0%   { transform: translate(-5%, -5%) scale(1); }
  50%  { transform: translate(4%, 3%) scale(1.08); }
  100% { transform: translate(-5%, -5%) scale(1); }
}
@keyframes bg-drift-2 {
  0%   { transform: translate(4%, 2%) scale(1.05); }
  50%  { transform: translate(-6%, -4%) scale(1); }
  100% { transform: translate(4%, 2%) scale(1.05); }
}
@keyframes grid-pan {
  0%   { background-position: 0 0; }
  100% { background-position: 48px 48px; }
}
@keyframes card-in {
  0%   { opacity: 0; transform: translateY(18px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ring-spin {
  to { transform: rotate(360deg); }
}
@keyframes ring-spin-rev {
  to { transform: rotate(-360deg); }
}
@keyframes lock-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(56,189,248,0.55)); }
  50%      { filter: drop-shadow(0 0 16px rgba(56,189,248,0.95)); }
}
@keyframes dot-pulse {
  0%, 100% { transform: scale(0.7); opacity: 0.4; }
  50%      { transform: scale(1.15); opacity: 1; }
}
@keyframes shake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-7px); }
  40%, 60% { transform: translateX(7px); }
}
@keyframes slot-fill {
  0%   { transform: scale(0.85); }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes sheen-sweep {
  0%   { transform: translateX(-120%) skewX(-15deg); }
  100% { transform: translateX(220%) skewX(-15deg); }
}
.aa-shell {
  background: #05060c;
  color: #e5e9f4;
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-family: 'Segoe UI', Inter, system-ui, sans-serif;
  position: relative;
  overflow: hidden;
}
.aa-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
  opacity: 0.55;
}
.aa-orb-1 {
  width: 480px; height: 480px;
  top: -120px; left: -120px;
  background: radial-gradient(circle, rgba(56,189,248,0.55), transparent 70%);
  animation: bg-drift 14s ease-in-out infinite;
}
.aa-orb-2 {
  width: 420px; height: 420px;
  bottom: -140px; right: -100px;
  background: radial-gradient(circle, rgba(129,140,248,0.5), transparent 70%);
  animation: bg-drift-2 16s ease-in-out infinite;
}
.aa-grid {
  position: absolute;
  inset: -50px;
  background-image:
    linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: grid-pan 6s linear infinite;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%);
  pointer-events: none;
}
.aa-card {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, rgba(19,28,49,0.92), rgba(10,15,28,0.92));
  backdrop-filter: blur(14px);
  padding: 44px 32px 36px;
  border-radius: 20px;
  border: 1px solid rgba(148,163,184,0.14);
  width: 480px; 
  max-width: 95vw;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,189,248,0.05);
  animation: card-in 0.6s cubic-bezier(0.16,1,0.3,1);
  box-sizing: border-box;
}
.aa-lock-wrap {
  position: relative;
  width: 76px;
  height: 76px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.aa-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px dashed rgba(56,189,248,0.4);
  animation: ring-spin 9s linear infinite;
}
.aa-ring-2 {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  border: 1px solid rgba(129,140,248,0.35);
  animation: ring-spin-rev 7s linear infinite;
}
.aa-lock-icon {
  animation: lock-pulse 2.4s ease-in-out infinite;
  position: relative;
  z-index: 1;
}
.aa-title {
  color: #f1f5f9;
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.aa-subtitle {
  color: #8b98b0;
  font-size: 13.5px;
  line-height: 1.5;
  margin: 0 0 20px;
}
.aa-slots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 0 6px;
  padding: 14px 10px;
  background: rgba(8,13,26,0.55);
  border: 1px solid rgba(148,163,184,0.12);
  border-radius: 14px;
}
.aa-slot-group {
  display: flex;
  gap: 3px;
}
.aa-slot {
  width: 20px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: rgba(15,23,42,0.9);
  border: 1px solid #2b3a56;
  color: #7dd3fc;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}
.aa-slot.filled {
  border-color: #38bdf8;
  background: rgba(56,189,248,0.08);
  box-shadow: 0 0 10px rgba(56,189,248,0.35);
  animation: slot-fill 0.22s ease-out;
}
.aa-slot-sep {
  flex: 0 0 auto;
  width: 8px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
}
.aa-hidden-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.aa-input-shell {
  position: relative;
  margin-bottom: 8px;
  cursor: text;
}
.aa-hint {
  color: #4b5875;
  font-size: 11px;
  letter-spacing: 0.4px;
  margin: 10px 0 22px;
}
.aa-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #fca5a5;
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12.5px;
  margin-bottom: 18px;
  animation: shake 0.5s ease;
}
.aa-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #071019;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14.5px;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  box-shadow: 0 8px 22px rgba(56,189,248,0.28);
}
.aa-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(56,189,248,0.4);
}
.aa-btn:active:not(:disabled) {
  transform: translateY(0);
}
.aa-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.aa-btn-sheen {
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
  animation: sheen-sweep 2.6s ease-in-out infinite;
}
.aa-loading-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.aa-dots {
  display: flex;
  gap: 7px;
}
.aa-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  animation: dot-pulse 1.1s ease-in-out infinite;
}
.aa-dot:nth-child(2) { animation-delay: 0.15s; }
.aa-dot:nth-child(3) { animation-delay: 0.3s; }
.aa-loading-text {
  color: #94a3b8;
  font-size: 13px;
  letter-spacing: 0.6px;
}
`;

function AppActivationWrapper({ children }) {
  const [isActivated, setIsActivated] = useState(null);
  const [machineId, setMachineId] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hiddenInputRef = React.useRef(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    // 1. Fetch Machine ID safely first
    try {
      const mRes = await api.get("/system/machine-id");
      setMachineId(mRes.data.machine_id);
    } catch (err) {
      console.error("Failed to fetch machine ID", err);
    }

    // 2. Then fetch Activation Status
    try {
      const res = await api.get("/system/status");
      setIsActivated(res.data.is_activated);
    } catch (e) {
      console.error("Failed to verify license status", e);
      setIsActivated(false); // If it fails, assume it's locked
    }
  };
  
  const handleKeyChange = (e) => {
    let rawValue = e.target.value.replace(/[^A-Z0-9]/ig, "").toUpperCase();
    rawValue = rawValue.substring(0, 14);
    let parts = [];
    if (rawValue.length > 0) parts.push(rawValue.substring(0, 4));
    if (rawValue.length > 4) parts.push(rawValue.substring(4, 8));
    if (rawValue.length > 8) parts.push(rawValue.substring(8, 12));
    if (rawValue.length > 12) parts.push(rawValue.substring(12, 14));

    setInputKey(parts.join("-"));
    setErrorMsg("");
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const rawKey = inputKey.replace(/-/g, "");
      const res = await api.post("/system/activate", { key: rawKey });
      
      if (res.data.success) {
        setIsActivated(true);
      } else {
        setErrorMsg(res.data.message);
      }
    } catch (e) {
      const serverMsg = e?.response?.data?.detail;
      setErrorMsg(serverMsg || "Activation failed. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSlotGroup = (start, length, sepAfter) => {
    const raw = inputKey.replace(/-/g, "");
    const chars = raw.substring(start, start + length).split("");
    return (
      <React.Fragment key={start}>
        <div className="aa-slot-group">
          {Array.from({ length }).map((_, i) => (
            <div key={i} className={"aa-slot" + (chars[i] ? " filled" : "")}>
              {chars[i] || ""}
            </div>
          ))}
        </div>
        {sepAfter && <span className="aa-slot-sep">–</span>}
      </React.Fragment>
    );
  };

  if (isActivated === null) {
    return (
      <div className="aa-shell">
        <style>{ACTIVATION_STYLES}</style>
        <div className="aa-orb aa-orb-1" />
        <div className="aa-orb aa-orb-2" />
        <div className="aa-grid" />
        <div className="aa-loading-shell" style={{ position: "relative", zIndex: 2 }}>
          <div className="aa-lock-wrap">
            <div className="aa-ring" />
            <div className="aa-ring-2" />
            <svg className="aa-lock-icon" width="30" height="30" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="#38bdf8" strokeWidth="1.6" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#38bdf8" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="aa-loading-text">VERIFYING HARDWARE BINDING</div>
          <div className="aa-dots">
            <div className="aa-dot" />
            <div className="aa-dot" />
            <div className="aa-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <div className="aa-shell">
        <style>{ACTIVATION_STYLES}</style>
        <div className="aa-orb aa-orb-1" />
        <div className="aa-orb aa-orb-2" />
        <div className="aa-grid" />

        <div className="aa-card">
          <div className="aa-lock-wrap">
            <div className="aa-ring" />
            <div className="aa-ring-2" />
            <svg className="aa-lock-icon" width="30" height="30" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="#38bdf8" strokeWidth="1.6" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#38bdf8" strokeWidth="1.6" />
              <circle cx="12" cy="15.5" r="1.3" fill="#38bdf8" />
            </svg>
          </div>

          <h2 className="aa-title">Application Locked</h2>
          <p className="aa-subtitle">Share your Machine ID to get an activation key.</p>

          <div style={{ background: 'rgba(56,189,248,0.1)', padding: '10px', borderRadius: '8px', marginBottom: '22px', border: '1px dashed rgba(56,189,248,0.3)', color: '#7dd3fc', fontSize: '14px', letterSpacing: '0.5px' }}>
            Machine ID: <strong style={{ letterSpacing: '1px' }}>{machineId}</strong>
          </div>

          <form onSubmit={handleActivate}>
            <div
              className="aa-input-shell"
              onClick={() => hiddenInputRef.current && hiddenInputRef.current.focus()}
            >
              <div className="aa-slots">
                {renderSlotGroup(0, 4, true)}
                {renderSlotGroup(4, 4, true)}
                {renderSlotGroup(8, 4, true)}
                {renderSlotGroup(12, 2, false)}
              </div>
              <input
                ref={hiddenInputRef}
                className="aa-hidden-input"
                type="text"
                autoFocus
                value={inputKey}
                onChange={handleKeyChange}
                maxLength={17}
                aria-label="Activation key"
              />
            </div>
            <div className="aa-hint">XXXX – XXXX – XXXX – XX</div>

            {errorMsg && (
              <div className="aa-error">
                <span>⚠</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" className="aa-btn" disabled={submitting}>
              <span className="aa-btn-sheen" />
              {submitting ? "Activating…" : "Activate Application"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}

function App() {
  return (
    <AppActivationWrapper>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoice" element={<InvoiceGenerator />} />
          <Route path="/inventory" element={<InventoryManager />} />
          <Route path="/purchase-invoices" element={<PurchaseInvoice />} />
          <Route path="/amc-tracking" element={<AmcTracking />} />
          <Route path="/follow-up-reminders" element={<FollowUpReminders />} />
          <Route path="/low-stock-alerts" element={<LowStockAlerts />} />
          <Route path="/whatsapp-integration" element={<WhatsAppIntegration />} />
          <Route path="/auto-reminders" element={<AutoReminders />} />
          <Route path="/vendor-ledger" element={<VendorLedger />} />
          <Route path="/stock-history" element={<StockHistory />} />
          <Route path="/reports" element={<SalesReports />} />
        </Routes>
      </Router>
    </AppActivationWrapper>
  );
}

export default App;