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

function AppActivationWrapper({ children }) {
  const [isActivated, setIsActivated] = useState(null);
  const [inputKey, setInputKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.get("/system/status");
      setIsActivated(res.data.is_activated);
    } catch (e) {
      console.error("Failed to verify license status", e);
      setIsActivated(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/system/activate", { key: inputKey });
      if (res.data.success) {
        setIsActivated(true);
      } else {
        setErrorMsg(res.data.message);
      }
    } catch (e) {
      setErrorMsg("Activation failed. Please check your connection.");
    }
  };

  if (isActivated === null) {
    return <div style={{ background: "#09090b", color: "white", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif" }}>Loading Security Checks...</div>;
  }

  if (!isActivated) {
    return (
      <div style={{ background: "#09090b", color: "white", height: "100vh", display: "flex", flexDirection: 'column', justifyContent: "center", alignItems: "center", fontFamily: "sans-serif" }}>
        <div style={{ background: "#131c31", padding: "40px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", width: "400px", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}>
          <h2 style={{ color: "#38bdf8", marginBottom: "10px" }}>Application Locked</h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>Please enter your activation key to unlock this software.</p>
          
          <form onSubmit={handleActivate}>
            <input 
              type="text" 
              placeholder="XXXX-XXXX-XXXX-XX" 
              value={inputKey} 
              onChange={(e) => setInputKey(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: "8px", textAlign: "center", fontSize: "16px", letterSpacing: "2px", marginBottom: "15px", boxSizing: "border-box", outline: "none" }}
            />
            {errorMsg && <p style={{ color: "#f87171", fontSize: "12px", marginBottom: "15px" }}>{errorMsg}</p>}
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#38bdf8", color: "#0f172a", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              Activate Application
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
        </Routes>
      </Router>
    </AppActivationWrapper>
  );
}

export default App;