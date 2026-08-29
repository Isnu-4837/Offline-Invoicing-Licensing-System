import React, { useState, useEffect, useRef } from "react";
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
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg-base: #030712;
  --bg-surface: rgba(15, 23, 42, 0.6);
  --accent-cyan: #22d3ee;
  --accent-blue: #3b82f6;
  --accent-indigo: #6366f1;
  --accent-glow: rgba(34, 211, 238, 0.4);
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --border-light: rgba(148, 163, 184, 0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background-color: var(--bg-base);
  font-family: 'Outfit', sans-serif;
  color: var(--text-primary);
  overflow: hidden;
}

@keyframes grid-move {
  0% { background-position: 0 0; }
  100% { background-position: 60px 60px; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
  33% { transform: translateY(-20px) rotate(2deg) scale(1.05); }
  66% { transform: translateY(15px) rotate(-1deg) scale(0.95); }
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 0.8; box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.6); }
  70% { transform: scale(1.1); opacity: 0; box-shadow: 0 0 0 30px rgba(34, 211, 238, 0); }
  100% { transform: scale(0.8); opacity: 0; box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
}

@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

@keyframes spin-slow-reverse {
  to { transform: rotate(-360deg); }
}

@keyframes scanline {
  0% { top: -10%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 110%; opacity: 0; }
}

@keyframes reveal-card {
  0% { opacity: 0; transform: translateY(40px) scale(0.95) rotateX(10deg); filter: blur(10px); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: blur(0); }
}

@keyframes glitch {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-2px, 1px); }
  40% { transform: translate(-1px, -1px); }
  60% { transform: translate(2px, 1px); }
  80% { transform: translate(1px, -1px); }
}

@keyframes fill-slot {
  0% { transform: scale(0.5); opacity: 0; filter: blur(4px); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; filter: blur(0); }
}

@keyframes shine {
  0% { left: -100%; }
  20% { left: 100%; }
  100% { left: 100%; }
}

.aa-shell {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  perspective: 1000px;
}

.aa-bg-grid {
  position: absolute;
  inset: -100px;
  background-image: 
    linear-gradient(to right, rgba(34, 211, 238, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(34, 211, 238, 0.05) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: grid-move 8s linear infinite;
  mask-image: radial-gradient(circle at center, black 40%, transparent 80%);
  pointer-events: none;
  z-index: 0;
}

.aa-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
}

.aa-orb-cyan {
  width: 500px; height: 500px;
  background: radial-gradient(circle, var(--accent-cyan), transparent 60%);
  top: -10%; left: -10%;
  animation: float 20s ease-in-out infinite;
}

.aa-orb-indigo {
  width: 600px; height: 600px;
  background: radial-gradient(circle, var(--accent-indigo), transparent 60%);
  bottom: -20%; right: -10%;
  animation: float 25s ease-in-out infinite reverse;
}

.aa-card {
  position: relative;
  z-index: 10;
  width: 480px;
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 48px 40px;
  text-align: center;
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  animation: reveal-card 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transform-style: preserve-3d;
  transition: transform 0.1s;
}

.aa-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 25px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.4), transparent 50%, rgba(99, 102, 241, 0.4));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.aa-scanline {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  background: var(--accent-cyan);
  box-shadow: 0 0 20px 4px var(--accent-cyan);
  opacity: 0;
  animation: scanline 4s linear infinite;
  pointer-events: none;
  border-radius: 50%;
  z-index: 20;
}

.aa-icon-container {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aa-icon-ring-outer {
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(34, 211, 238, 0.4);
  border-radius: 50%;
  animation: spin-slow 12s linear infinite;
}

.aa-icon-ring-inner {
  position: absolute;
  inset: 12px;
  border: 2px solid transparent;
  border-top-color: rgba(99, 102, 241, 0.8);
  border-bottom-color: rgba(99, 102, 241, 0.8);
  border-radius: 50%;
  animation: spin-slow-reverse 8s linear infinite;
}

.aa-icon-pulse {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: rgba(34, 211, 238, 0.1);
  animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.aa-icon {
  position: relative;
  z-index: 2;
  color: var(--accent-cyan);
  filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.8));
}

.aa-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.aa-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 32px;
  font-weight: 400;
}

.aa-machine-id-box {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.aa-machine-id-box:hover {
  border-color: rgba(34, 211, 238, 0.3);
  background: rgba(15, 23, 42, 0.8);
}

.aa-machine-id-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

.aa-machine-id-value {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-cyan);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.5px;
}

.aa-copy-btn {
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.2);
  color: var(--accent-cyan);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.aa-copy-btn:hover {
  background: rgba(34, 211, 238, 0.2);
  transform: scale(1.05);
}

.aa-copy-btn:active {
  transform: scale(0.95);
}

.aa-copy-btn.copied {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.aa-key-input-container {
  margin-bottom: 24px;
  position: relative;
  cursor: text;
}

.aa-key-slots {
  display: flex;
  justify-content: center;
  gap: 12px;
  cursor: text;
}

.aa-slot-group {
  display: flex;
  gap: 4px;
}

.aa-slot {
  width: 24px;
  height: 40px;
  background: rgba(3, 7, 18, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.aa-slot::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 2px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 1px;
  transition: all 0.2s ease;
}

.aa-slot.filled {
  border-color: var(--accent-cyan);
  background: rgba(34, 211, 238, 0.05);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.1);
  animation: fill-slot 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.aa-slot.filled::after {
  opacity: 0;
}

.aa-slot.active {
  border-color: var(--accent-indigo);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
}

.aa-slot.active::after {
  background: var(--accent-indigo);
  animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.aa-slot-separator {
  color: rgba(148, 163, 184, 0.4);
  display: flex;
  align-items: center;
  font-weight: bold;
}

.aa-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: text;
  z-index: 10;
}

.aa-error-msg {
  color: #ef4444;
  font-size: 13px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  animation: glitch 0.3s linear;
}

.aa-submit-btn {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-indigo));
  color: white;
  font-family: 'Outfit', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
}

.aa-submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: skewX(-20deg);
  animation: shine 3s infinite;
}

.aa-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px rgba(99, 102, 241, 0.4);
}

.aa-submit-btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 5px 10px rgba(99, 102, 241, 0.3);
}

.aa-submit-btn:disabled {
  background: #334155;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

.aa-submit-btn:disabled::before {
  display: none;
}

/* Loading State */
.aa-loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  z-index: 10;
  position: relative;
}

.aa-loader-core {
  width: 80px;
  height: 80px;
  position: relative;
  margin-bottom: 24px;
}

.aa-loader-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--accent-cyan);
  border-left-color: var(--accent-cyan);
  border-radius: 50%;
  animation: spin-slow 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

.aa-loader-ring-inner {
  position: absolute;
  inset: 15px;
  border: 2px solid transparent;
  border-bottom-color: var(--accent-indigo);
  border-right-color: var(--accent-indigo);
  border-radius: 50%;
  animation: spin-slow-reverse 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

.aa-loader-center {
  position: absolute;
  inset: 30px;
  background: var(--accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 20px var(--accent-cyan);
  animation: pulse-ring 1.5s ease-in-out infinite alternate;
}

.aa-loading-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--accent-cyan);
  letter-spacing: 2px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.aa-loading-dots::after {
  content: '...';
  animation: loading-dots 1.5s steps(4, end) infinite;
  width: 20px;
  display: inline-block;
  text-align: left;
}

@keyframes loading-dots {
  0%, 20% { color: rgba(0,0,0,0); text-shadow: .25em 0 0 rgba(0,0,0,0), .5em 0 0 rgba(0,0,0,0);}
  40% { color: inherit; text-shadow: .25em 0 0 rgba(0,0,0,0), .5em 0 0 rgba(0,0,0,0);}
  60% { text-shadow: .25em 0 0 inherit, .5em 0 0 rgba(0,0,0,0);}
  80%, 100% { text-shadow: .25em 0 0 inherit, .5em 0 0 inherit;}
}
`;

function AppActivationWrapper({ children }) {
  const [isActivated, setIsActivated] = useState(null);
  const [machineId, setMachineId] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const hiddenInputRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    checkStatus();
    
    const handleMouseMove = (e) => {
      if (!cardRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20; 
      const y = (clientY / innerHeight - 0.5) * -20;
      
      cardRef.current.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
    };

    const handleMouseLeave = () => {
      if (!cardRef.current) return;
      cardRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
    };

    if (isActivated === false) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isActivated]);

  const handleCopyMachineId = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = machineId;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) { }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkStatus = async () => {
    try {
      const mRes = await api.get("/system/machine-id");
      setMachineId(mRes.data.machine_id);
    } catch (err) {
      console.error("Failed to fetch machine ID", err);
    }

    try {
      const res = await api.get("/system/status");
      setTimeout(() => {
        setIsActivated(res.data.is_activated);
      }, 1500); 
    } catch (e) {
      console.error("Failed to verify license status", e);
      setIsActivated(false);
    }
  };

  const formatAndSetKey = (val) => {
    let rawValue = val.replace(/[^A-Z0-9]/ig, "").toUpperCase();
    rawValue = rawValue.substring(0, 14);
    let parts = [];
    if (rawValue.length > 0) parts.push(rawValue.substring(0, 4));
    if (rawValue.length > 4) parts.push(rawValue.substring(4, 8));
    if (rawValue.length > 8) parts.push(rawValue.substring(8, 12));
    if (rawValue.length > 12) parts.push(rawValue.substring(12, 14));

    setInputKey(parts.join("-"));
    setErrorMsg("");
  };

  const handleKeyChange = (e) => {
    formatAndSetKey(e.target.value);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('Text');
    formatAndSetKey(pastedData);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if(inputKey.replace(/-/g, "").length !== 14) {
        setErrorMsg("Please enter a complete 14-character key.");
        return;
    }
    setSubmitting(true);
    try {
      const rawKey = inputKey.replace(/-/g, "");
      const res = await api.post("/system/activate", { key: rawKey });
      
      if (res.data.success || res.data.is_activated) {
        if(cardRef.current) {
            cardRef.current.style.animation = "reveal-card 0.5s reverse forwards";
        }
        setTimeout(() => setIsActivated(true), 500);
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

  const renderSlots = () => {
    const raw = inputKey.replace(/-/g, "");
    const chars = raw.split("");
    const groups = [4, 4, 4, 2];
    let charIndex = 0;
    
    return groups.map((len, gIndex) => (
      <React.Fragment key={gIndex}>
        <div className="aa-slot-group">
          {Array.from({ length: len }).map((_, i) => {
            const isFilled = !!chars[charIndex];
            const isActive = charIndex === chars.length && !submitting; 
            const displayChar = chars[charIndex++] || "";
            
            return (
              <div 
                key={i} 
                className={`aa-slot ${isFilled ? "filled" : ""} ${isActive ? "active" : ""}`}
              >
                {displayChar}
              </div>
            );
          })}
        </div>
        {gIndex < groups.length - 1 && <span className="aa-slot-separator">-</span>}
      </React.Fragment>
    ));
  };

  if (isActivated === null) {
    return (
      <div className="aa-shell">
        <style>{ACTIVATION_STYLES}</style>
        <div className="aa-bg-grid" />
        <div className="aa-orb aa-orb-cyan" />
        <div className="aa-orb aa-orb-indigo" />
        
        <div className="aa-loading-container">
          <div className="aa-loader-core">
            <div className="aa-loader-ring"></div>
            <div className="aa-loader-ring-inner"></div>
            <div className="aa-loader-center"></div>
          </div>
          <div className="aa-loading-text">
            Initializing System <span className="aa-loading-dots"></span>
          </div>
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <div className="aa-shell">
        <style>{ACTIVATION_STYLES}</style>
        <div className="aa-bg-grid" />
        <div className="aa-orb aa-orb-cyan" />
        <div className="aa-orb aa-orb-indigo" />

        <div className="aa-card" ref={cardRef}>
          <div className="aa-scanline" />
          
          <div className="aa-icon-container">
            <div className="aa-icon-ring-outer" />
            <div className="aa-icon-ring-inner" />
            <div className="aa-icon-pulse" />
            <svg className="aa-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <circle cx="12" cy="16" r="1"></circle>
            </svg>
          </div>

          <h2 className="aa-title">System Locked</h2>
          <p className="aa-subtitle">Provide your Machine ID to obtain a valid license key.</p>

          <div className="aa-machine-id-box">
            <div>
              <div className="aa-machine-id-label">Hardware ID</div>
              <div className="aa-machine-id-value">{machineId || "Generating..."}</div>
            </div>
            <button
              type="button"
              className={`aa-copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopyMachineId}
              title="Copy to clipboard"
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
            </button>
          </div>

          <form onSubmit={handleActivate}>
            <div 
              className="aa-key-input-container"
              onClick={() => hiddenInputRef.current && hiddenInputRef.current.focus()}
            >
              <div className="aa-key-slots">
                 {renderSlots()}
              </div>
              <input
                ref={hiddenInputRef}
                className="aa-hidden-input"
                type="text"
                autoFocus
                value={inputKey}
                onChange={handleKeyChange}
                onPaste={handlePaste}
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {errorMsg && (
              <div className="aa-error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="aa-submit-btn" disabled={submitting}>
              {submitting ? "Authenticating..." : "Unlock System"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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