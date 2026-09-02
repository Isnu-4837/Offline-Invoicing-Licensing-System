import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const PAYWALL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

/* CSS Reset to remove default browser margins (fixes white borders) */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  margin: 0;
  padding: 0;
  background-color: #030712;
  overflow-x: hidden;
}

.aa-shell {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background-color: #030712;
  font-family: 'Outfit', sans-serif;
  overflow: hidden;
}

.aa-bg-grid {
  position: absolute;
  inset: -100px;
  background-image: 
    linear-gradient(to right, rgba(34, 211, 238, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(34, 211, 238, 0.05) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: grid-move 8s linear infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes grid-move {
  0% { background-position: 0 0; }
  100% { background-position: 60px 60px; }
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
  background: radial-gradient(circle, #22d3ee, transparent 60%);
  top: -10%; left: -10%;
  animation: float 20s ease-in-out infinite;
}

.aa-orb-indigo {
  width: 600px; height: 600px;
  background: radial-gradient(circle, #6366f1, transparent 60%);
  bottom: -20%; right: -10%;
  animation: float 25s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
  33% { transform: translateY(-20px) rotate(2deg) scale(1.05); }
  66% { transform: translateY(15px) rotate(-1deg) scale(0.95); }
}

.aa-card {
  position: relative;
  z-index: 10;
  width: 480px;
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 44px 40px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  animation: reveal-card 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes reveal-card {
  0% { opacity: 0; transform: translateY(40px) scale(0.95); filter: blur(10px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.aa-scanline {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  background: #22d3ee;
  box-shadow: 0 0 20px 4px #22d3ee;
  opacity: 0;
  animation: scanline 4s linear infinite;
  pointer-events: none;
  z-index: 20;
}

@keyframes scanline {
  0% { top: -10%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 110%; opacity: 0; }
}

.aa-icon-container {
  position: relative;
  width: 90px;
  height: 90px;
  margin: 0 auto 20px;
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

@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

.aa-icon {
  position: relative;
  z-index: 2;
  color: #22d3ee;
}

.aa-title {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 6px;
  color: #fff;
}

.aa-subtitle {
  font-size: 13.5px;
  color: #94a3b8;
  margin-bottom: 24px;
  line-height: 1.5;
}

.aa-machine-id-box {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.aa-machine-id-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: left;
}

.aa-machine-id-value {
  font-family: 'JetBrains Mono', monospace;
  color: #22d3ee;
  font-weight: 700;
  font-size: 13.5px;
  text-align: left;
}

.aa-copy-btn {
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.2);
  color: #22d3ee;
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

.aa-key-input-container {
  margin-bottom: 20px;
  position: relative;
}

.aa-key-slots {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.aa-slot-group {
  display: flex;
  gap: 4px;
}

.aa-slot {
  width: 24px;
  height: 38px;
  background: rgba(3, 7, 18, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.aa-slot.filled {
  border-color: #22d3ee;
  background: rgba(34, 211, 238, 0.05);
}

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
  color: #f43f5e;
  font-size: 13px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 18px;
}

.aa-submit-btn {
  width: 100%;
  padding: 15px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
}

.aa-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
}

.aa-submit-btn:disabled {
  background: #334155;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

.aa-contact-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}

.aa-contact-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.15);
  transition: all 0.2s ease;
}

.aa-contact-link:hover {
  background: rgba(34, 211, 238, 0.12);
  border-color: rgba(34, 211, 238, 0.3);
  transform: translateY(-2px);
}
`;

export default function UpgradePaywall() {
  const navigate = useNavigate();
  const [machineId, setMachineId] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const hiddenInputRef = useRef(null);

  useEffect(() => {
    const fetchMachineId = async () => {
      let mId = "";
      // 1. Try Electron API first
      if (window.electronAPI && typeof window.electronAPI.getMachineId === "function") {
        try {
          mId = await window.electronAPI.getMachineId();
        } catch (e) {
          console.error("Failed to get machine ID via Electron", e);
        }
      }
      
      // 2. Fallback to API if Electron bridge fails or is missing
      if (!mId) {
        try {
          const res = await api.get("/system/machine-id");
          mId = res.data.machine_id;
        } catch (err) {
          console.error("Failed to fetch machine ID via API fallback", err);
        }
      }
      
      setMachineId(mId || "Unable to generate ID");
    };
    
    fetchMachineId();
  }, []);

  const formatAndSetKey = (val) => {
    let rawValue = val.replace(/[^A-Z0-9]/ig, "").toUpperCase().substring(0, 14);
    let parts = [];
    if (rawValue.length > 0) parts.push(rawValue.substring(0, 4));
    if (rawValue.length > 4) parts.push(rawValue.substring(4, 8));
    if (rawValue.length > 8) parts.push(rawValue.substring(8, 12));
    if (rawValue.length > 12) parts.push(rawValue.substring(12, 14));

    setInputKey(parts.join("-"));
    setErrorMessage("");
  };

  const handleCopyMachineId = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();
    const rawKey = inputKey.replace(/-/g, "");
    
    if (rawKey.length !== 14) {
      setErrorMessage("Please enter a complete 14-character license key.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    try {
      let success = false;
      let message = "";

      // Try Electron IPC first
      if (window.electronAPI && typeof window.electronAPI.activateLicense === "function") {
        const result = await window.electronAPI.activateLicense(rawKey);
        success = result.success;
        message = result.message;
      } else {
        // Fallback to backend API
        const res = await api.post("/system/activate", { key: rawKey, machine_id: machineId });
        success = res.data.success || res.data.is_activated;
        message = res.data.message;
      }

      if (success) {
        navigate("/"); // Redirect back to the billing console
        window.location.reload(); // Force reload to re-mount app states
      } else {
        setErrorMessage(message || "Invalid license key. Please try again.");
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.detail;
      setErrorMessage(serverMsg || "Failed to communicate with license manager.");
    } finally {
      setIsVerifying(false);
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
            const displayChar = chars[charIndex++] || "";
            return (
              <div key={i} className={`aa-slot ${isFilled ? "filled" : ""}`}>
                {displayChar}
              </div>
            );
          })}
        </div>
        {gIndex < groups.length - 1 && <span className="aa-slot-separator">-</span>}
      </React.Fragment>
    ));
  };

  return (
    <div className="aa-shell">
      <style>{PAYWALL_STYLES}</style>
      <div className="aa-bg-grid" />
      <div className="aa-orb aa-orb-cyan" />
      <div className="aa-orb aa-orb-indigo" />
      
      <div className="aa-card">
        <div className="aa-scanline" />
        
        <div className="aa-icon-container">
          <div className="aa-icon-ring-outer" />
          <svg className="aa-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>

        <h2 className="aa-title">Trial Expired</h2>
        <p className="aa-subtitle">
          Your 7-day offline free trial has concluded. To continue using the billing console, generating invoices, and managing inventory, please enter your offline license key below.
        </p>

        <div className="aa-machine-id-box">
          <div>
            <div className="aa-machine-id-label">Hardware ID</div>
            <div className="aa-machine-id-value">{machineId || "Generating..."}</div>
          </div>
          <button
            type="button"
            className="aa-copy-btn"
            onClick={handleCopyMachineId}
            title="Copy Hardware ID"
          >
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            )}
          </button>
        </div>

        <form onSubmit={handleActivateLicense}>
          <div className="aa-key-input-container" onClick={() => hiddenInputRef.current?.focus()}>
            <div className="aa-key-slots">{renderSlots()}</div>
            <input
              ref={hiddenInputRef}
              className="aa-hidden-input"
              type="text"
              autoFocus
              value={inputKey}
              onChange={(e) => formatAndSetKey(e.target.value)}
            />
          </div>

          {errorMessage && <div className="aa-error-msg">{errorMessage}</div>}

          <button type="submit" className="aa-submit-btn" disabled={isVerifying}>
            {isVerifying ? "Verifying Key..." : "Activate Full Version"}
          </button>
        </form>

        <div style={{ marginTop: "20px", fontSize: "12px", color: "#64748b" }}>
          Need a license? Contact support or visit your billing portal to purchase.
        </div>

        <div className="aa-contact-row">
          <a
            href="mailto:support@example.com"
            className="aa-contact-link"
            title="Email support"
            aria-label="Email support"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 6 12 13 2 6" />
            </svg>
          </a>
          <a
            href="https://wa.me/10000000000"
            className="aa-contact-link"
            title="Chat on WhatsApp"
            aria-label="Chat on WhatsApp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#34d399">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.67c2.19 0 4.25.85 5.8 2.4a8.18 8.18 0 0 1 2.4 5.83c0 4.55-3.7 8.24-8.21 8.24a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.15 8.15 0 0 1-1.26-4.37c0-4.55 3.71-8.25 8.23-8.25zm-4.53 4.6c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.63 4.19 3.62 2.07.83 2.49.66 2.94.62.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.97-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.21a7.32 7.32 0 0 1-1.35-1.68c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}