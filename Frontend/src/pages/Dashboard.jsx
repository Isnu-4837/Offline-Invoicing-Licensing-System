import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_sales: 0,
    total_collected: 0,
    total_due: 0,
    total_invoices: 0
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      if (res.data) {
        // Robust calculation guard: Re-aggregate dynamically from /invoices if dashboard totals are mismatched or missing
        const invRes = await api.get("/invoices");
        const invoices = Array.isArray(invRes.data) ? invRes.data : [];
        
        let computedSales = 0;
        let computedCollected = 0;
        let computedDue = 0;
        let validInvoicesCount = 0;

        invoices.forEach(inv => {
          const docType = String(inv.doc_type || "").split('.').pop().toUpperCase();
          if (docType === "QUOTATION") return; // Exclude quotations from financial sales totals

          validInvoicesCount++;
          const tAmount = Number(inv.total_amount) || 0;
          const advPaid = Number(inv.advance_paid) || 0;
          const status = String(inv.payment_status || "").split('.').pop().toUpperCase();

          let remAmount = Number(inv.remaining_amount);
          if (isNaN(remAmount) || remAmount < 0) {
            remAmount = Math.max(0, tAmount - advPaid);
          }

          let collected = 0;
          if (status === "PAID" || tAmount === 0) {
            collected = tAmount;
            remAmount = 0;
          } else {
            collected = advPaid;
          }

          computedSales += tAmount;
          computedCollected += collected;
          computedDue += remAmount;
        });

        setStats({
          total_sales: computedSales > 0 ? computedSales : (res.data.total_sales || 0),
          total_collected: computedCollected > 0 ? computedCollected : (res.data.total_collected || 0),
          total_due: computedDue,
          total_invoices: validInvoicesCount > 0 ? validInvoicesCount : (res.data.total_invoices || 0)
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
    } finally {
      setStatsLoaded(true);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate('/invoice', { state: { searchQuery } });
    }
  };

  const handleComingSoon = (featureName) => {
    alert(`🚀 ${featureName} is currently in development and will be available in the next update!`);
  };

  // --- Report Generation Logic ---
  const handleDownloadReport = async (reportType) => {
    try {
      const res = await api.get("/invoices");
      let data = res.data;

      if (reportType === "DUES") {
        data = data.filter(inv => {
          const status = String(inv.payment_status || "").split('.').pop().toUpperCase();
          const docType = String(inv.doc_type || "").split('.').pop().toUpperCase();
          const rem = Number(inv.remaining_amount) || 0;
          return docType !== "QUOTATION" && status !== "PAID" && rem > 0;
        });
      }

      if (!data || data.length === 0) {
        alert("No records found to generate this report.");
        return;
      }

      const headers = [
        "Date", 
        "Invoice Number", 
        "Client Name", 
        "Contact", 
        "Grand Total", 
        "Advance Paid", 
        "Status", 
        "Doc Type"
      ];
      
      const rows = data.map(inv => {
        const dateStr = inv.invoice_date || inv.created_at || "";
        const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : "N/A";
        
        return [
          formattedDate,
          inv.invoice_number || "N/A",
          `"${(inv.client_name || "N/A").replace(/"/g, '""')}"`,
          inv.client_mobile || "N/A",
          inv.total_amount || 0,
          inv.advance_paid || 0,
          String(inv.payment_status || "DUE").split('.').pop(),
          String(inv.doc_type || "INVOICE").split('.').pop()
        ];
      });

      const csvContent = [
        headers.join(","), 
        ...rows.map(e => e.join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `NextGen_${reportType}_Report_${new Date().toISOString().split('T')[0]}.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowReportModal(false);
      
    } catch (error) {
      console.error("Failed to generate report", error);
      alert("Failed to download report. Please check your connection.");
    }
  };

  const upcomingModules = [
    { icon: "🧾", title: "Purchase Invoices", desc: "Log bills from suppliers (buying raw materials, cameras, wire).", path: "/purchase-invoices" },
    { icon: "📒", title: "Vendor Ledger", desc: "Track money owed to suppliers vs. amounts already paid.", path: "/vendor-ledger" },
    { icon: "🛠️", title: "AMC Tracking", desc: "Alerts when a client's 1-year service warranty is about to expire.", path: "/amc-tracking" },
    { icon: "📞", title: "Follow-up Reminders", desc: "A daily alert showing which clients need a callback today.", path: "/follow-up-reminders" },
    { icon: "📉", title: "Low Stock Alerts", desc: "Flashing dashboard alerts for items below defined minimum limits.", path: "/low-stock-alerts" },
    { icon: "📋", title: "Stock History", desc: "A ledger for each product showing when it was added, sold, or adjusted.", path: "/stock-history" },
    { icon: "💬", title: "WhatsApp Integration", desc: "Instantly send generated PDF Invoices to client WhatsApp numbers.", path: "/whatsapp-integration" },
    { icon: "🤖", title: "Auto-Reminders", desc: "One-click bulk SMS/WhatsApp messages for clients with pending dues.", path: "/auto-reminders" },
    { icon: "📊", title: "Sales Reports", desc: "Comprehensive yearly, monthly, and weekly sales metrics and CSV exports.", path: "/reports" }
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        :root {
          --amber: #fbbf24;
          --emerald: #34d399;
          --rose: #fb7185;
          --sky: #38bdf8;
          --violet: #a78bfa;
          --ink: #05060a;
          --panel: rgba(255, 255, 255, 0.035);
          --panel-border: rgba(255, 255, 255, 0.07);
        }

        body { 
          background-color: var(--ink);
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
            radial-gradient(circle at 12% 8%, rgba(251, 191, 36, 0.10), transparent 38%),
            radial-gradient(circle at 88% 92%, rgba(52, 211, 153, 0.10), transparent 40%);
          background-size: 42px 42px, 42px 42px, auto, auto;
          font-family: 'Plus Jakarta Sans', sans-serif; 
          color: #f1f5f9; 
          margin: 0; 
          min-height: 100vh;
        }

        .mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes softPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.25); }
          50% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes dotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
          50% { box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); }
        }

        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(24px, -18px); }
        }

        @keyframes gradientSweep {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
          animation: drift 14s ease-in-out infinite;
        }

        .dashboard-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          position: relative;
          z-index: 1;
        }

        /* Status strip */
        .status-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          animation: fadeIn 0.6s ease both;
        }

        .status-strip-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--emerald);
          animation: dotPulse 2s ease-in-out infinite;
        }

        .status-text {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #8b95a5;
        }

        .status-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 4px 0 0 0;
          background: linear-gradient(90deg, #ffffff 0%, var(--amber) 45%, #ffffff 90%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientSweep 7s linear infinite;
        }

        .status-strip-right {
          font-size: 12px;
          color: #64748b;
          text-align: right;
        }
        .status-strip-right .clock {
          display: block;
          font-size: 14px;
          color: #cbd5e1;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Top Action Cards */
        .action-cards-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .action-card {
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          overflow: hidden;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .action-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.07) 50%, transparent 80%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }

        .action-card:hover::before {
          transform: translateX(100%);
        }

        .action-card:hover {
          transform: translateY(-6px) scale(1.015);
          background: rgba(255, 255, 255, 0.06);
        }

        .action-card:active {
          transform: translateY(-2px) scale(0.99);
        }

        .action-card.invoice-card {
          border: 1px solid rgba(251, 191, 36, 0.18);
          animation-delay: 0.05s;
        }
        .action-card.invoice-card:hover {
          box-shadow: 0 14px 34px -10px rgba(251, 191, 36, 0.3);
          border-color: rgba(251, 191, 36, 0.4);
        }

        .action-card.inventory-card {
          border: 1px solid rgba(52, 211, 153, 0.18);
          animation-delay: 0.12s;
        }
        .action-card.inventory-card:hover {
          box-shadow: 0 14px 34px -10px rgba(52, 211, 153, 0.3);
          border-color: rgba(52, 211, 153, 0.4);
        }

        .action-icon {
          font-size: 24px;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          transition: transform 0.35s ease;
        }

        .invoice-card .action-icon { background: rgba(251, 191, 36, 0.12); }
        .inventory-card .action-icon { background: rgba(52, 211, 153, 0.12); }

        .action-card:hover .action-icon {
          transform: scale(1.12) rotate(-4deg);
        }

        .action-title {
          font-weight: 700;
          font-size: 15px;
          color: #f8fafc;
        }

        /* Stats Row */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 20px 22px;
          border: 1px solid var(--panel-border);
          border-left: 3px solid var(--stat-color, var(--sky));
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.16s; }
        .stat-card:nth-child(3) { animation-delay: 0.22s; }
        .stat-card:nth-child(4) { animation-delay: 0.28s; }

        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 26px -12px rgba(0, 0, 0, 0.6);
        }

        .stat-card.stat-amber { --stat-color: var(--amber); }
        .stat-card.stat-emerald { --stat-color: var(--emerald); }
        .stat-card.stat-rose { --stat-color: var(--rose); }
        .stat-card.stat-sky { --stat-color: var(--sky); }

        .stat-icon {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          background: color-mix(in srgb, var(--stat-color, var(--sky)) 16%, transparent);
        }

        .stat-body { min-width: 0; }

        .stat-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.3px;
          transition: opacity 0.4s ease;
        }

        .stat-value.is-loading {
          opacity: 0.35;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
        }

        .text-yellow { color: #facc15; }
        .text-green { color: #34d399; }
        .text-red { color: #f87171; }
        .text-white { color: #ffffff; }

        /* Search Bar Row */
        .search-row {
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 16px;
          align-items: center;
          border: 1px solid var(--panel-border);
          margin-bottom: 40px;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.32s;
        }

        .search-input-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          font-size: 14px;
          opacity: 0.7;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: white;
          padding: 12px 16px 12px 42px;
          border-radius: 8px;
          font-size: 13.5px;
          font-family: inherit;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: rgba(251, 191, 36, 0.4);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12);
        }

        .search-input::placeholder {
          color: #64748b;
        }

        .btn-reports {
          background: linear-gradient(135deg, var(--amber) 0%, #f97316 100%);
          background-size: 160% 160%;
          color: #1c1300;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
          font-family: inherit;
        }

        .btn-reports:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(251, 191, 36, 0.35);
          background-position: 100% 0%;
        }

        .btn-reports:active {
          transform: translateY(0);
        }

        /* ERP Modules Section */
        .erp-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.36s;
        }

        .erp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .erp-card {
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 16px 20px;
          border: 1px solid var(--panel-border);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .erp-grid .erp-card:nth-child(1) { animation-delay: 0.40s; }
        .erp-grid .erp-card:nth-child(2) { animation-delay: 0.44s; }
        .erp-grid .erp-card:nth-child(3) { animation-delay: 0.48s; }
        .erp-grid .erp-card:nth-child(4) { animation-delay: 0.52s; }
        .erp-grid .erp-card:nth-child(5) { animation-delay: 0.56s; }
        .erp-grid .erp-card:nth-child(6) { animation-delay: 0.60s; }
        .erp-grid .erp-card:nth-child(7) { animation-delay: 0.64s; }
        .erp-grid .erp-card:nth-child(8) { animation-delay: 0.68s; }
        .erp-grid .erp-card:nth-child(9) { animation-delay: 0.72s; }

        .erp-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(56, 189, 248, 0.25);
          transform: translateY(-3px);
          box-shadow: 0 12px 26px -14px rgba(56, 189, 248, 0.25);
        }

        .erp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .erp-title-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .erp-title-wrapper span:first-child {
          display: inline-block;
          transition: transform 0.3s ease;
        }

        .erp-card:hover .erp-title-wrapper span:first-child {
          animation: floatIcon 1.1s ease-in-out infinite;
        }

        .erp-title {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .badge-soon {
          background: rgba(139, 92, 246, 0.12);
          color: #a78bfa;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          animation: softPulse 2.4s ease-in-out infinite;
        }

        .erp-desc {
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        /* Footer */
        .dashboard-footer {
          margin-top: 50px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 20px;
          animation: fadeIn 0.8s ease both;
          animation-delay: 0.7s;
        }

        .dashboard-footer strong {
          color: #facc15;
          font-weight: 700;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 8px;
        }

        .footer-link {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s, transform 0.2s;
        }

        .footer-link:hover {
          color: #f8fafc;
          transform: translateY(-1px);
        }

        /* Modal */
        .modal-overlay { 
          position: fixed; 
          top: 0; left: 0; width: 100%; height: 100%; 
          background: rgba(0,0,0,0.7); 
          backdrop-filter: blur(8px); 
          display: flex; align-items: center; justify-content: center; 
          z-index: 100; 
          animation: fadeIn 0.2s ease both;
        }
        .modal-content { 
          background: #121419;
          backdrop-filter: blur(16px);
          padding: 30px;
          border-radius: 16px;
          width: 440px; 
          border: 1px solid rgba(251, 191, 36, 0.2); 
          box-shadow: 0 25px 60px rgba(0,0,0,0.6);
          animation: scaleIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .close-btn { 
          background: transparent; 
          border: none; 
          color: #a1a1aa; 
          font-size: 1.5rem; 
          float: right; 
          cursor: pointer; 
          transition: transform 0.2s ease, color 0.2s ease;
        }
        .close-btn:hover { color: white; transform: rotate(90deg); }
        .report-option {
          width: 100%;
          padding: 15px;
          margin-bottom: 12px;
          background: #262626;
          border: 1px solid rgba(255,255,255,0.05);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .report-option:hover {
          background: #333;
          border-color: rgba(251, 191, 36, 0.4);
          transform: translateX(3px);
        }
      `}</style>

      <div className="bg-orb" style={{ top: "-140px", left: "-120px", width: "380px", height: "380px", background: "rgba(251, 191, 36, 0.14)" }} />
      <div className="bg-orb" style={{ bottom: "-160px", right: "-120px", width: "440px", height: "440px", background: "rgba(52, 211, 153, 0.12)", animationDelay: "3s" }} />

      <div className="dashboard-container">
        {/* Status Strip */}
        <div className="status-strip">
          <div className="status-strip-left">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="status-dot"></span>
                <span className="status-text">Live Overview</span>
              </div>
              <h1 className="status-title">Dashboard</h1>
            </div>
          </div>
          <div className="status-strip-right">
            <span className="mono">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Top Action Cards */}
        <div className="action-cards-container">
          <div 
            className="action-card invoice-card" 
            onClick={() => navigate("/invoice")}
          >
            <div className="action-icon">📄</div>
            <div className="action-title">Invoice & Quotation Generator</div>
          </div>
          
          <div 
            className="action-card inventory-card" 
            onClick={() => navigate("/inventory")}
          >
            <div className="action-icon">📦</div>
            <div className="action-title">Inventory Management</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card stat-amber">
            <div className="stat-icon">💰</div>
            <div className="stat-body">
              <div className="stat-title">Total Sales (Billed)</div>
              <div className={`stat-value text-yellow ${!statsLoaded ? 'is-loading' : ''}`}>
                ₹{formatCurrency(stats.total_sales)}
              </div>
            </div>
          </div>
          <div className="stat-card stat-emerald">
            <div className="stat-icon">✅</div>
            <div className="stat-body">
              <div className="stat-title">Amount Received</div>
              <div className={`stat-value text-green ${!statsLoaded ? 'is-loading' : ''}`}>
                ₹{formatCurrency(stats.total_collected)}
              </div>
            </div>
          </div>
          <div className="stat-card stat-rose">
            <div className="stat-icon">⏳</div>
            <div className="stat-body">
              <div className="stat-title">Total Due (Pending)</div>
              <div className={`stat-value text-red ${!statsLoaded ? 'is-loading' : ''}`}>
                ₹{formatCurrency(stats.total_due)}
              </div>
            </div>
          </div>
          <div className="stat-card stat-sky">
            <div className="stat-icon">🧾</div>
            <div className="stat-body">
              <div className="stat-title">Total Invoices</div>
              <div className={`stat-value text-white ${!statsLoaded ? 'is-loading' : ''}`}>
                {stats.total_invoices}
              </div>
            </div>
          </div>
        </div>

        {/* Search Row */}
        <div className="search-row">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Quick Search: Type Client Name or Inv # and hit Enter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <button className="btn-reports" onClick={() => setShowReportModal(true)}>
            📊 Generate Reports
          </button>
        </div>

        {/* Upcoming ERP Modules */}
        <div className="erp-section-title">
          ⚙️ ERP Modules & Reports
        </div>
       <div className="erp-grid">
          {upcomingModules.map((mod, idx) => (
            <div 
              className="erp-card" 
              key={idx} 
              onClick={() => mod.path ? navigate(mod.path) : handleComingSoon(mod.title)}
            >
              <div className="erp-header">
                <div className="erp-title-wrapper">
                  <span>{mod.icon}</span>
                  <span className="erp-title">{mod.title}</span>
                </div>
                {!mod.path && <span className="badge-soon">SOON</span>}
              </div>
              <p className="erp-desc">{mod.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="dashboard-footer">
          <div>Powered & Developed By <strong> ISNU GUPTA</strong> © 2026</div>
          <div className="footer-links">
            <a href="https://www.linkedin.com/in/isnu-gupta-6659162b1" target="_blank" rel="noopener noreferrer" className="footer-link">🌐 LinkedIn</a>
            <a href="mailto:isnu.tech@gmail.com" className="footer-link">✉️ isnu.tech@gmail.com</a>
          </div>
        </div>
      </div>

      {/* REPORT GENERATION MODAL */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowReportModal(false)}>✕</button>
            <h2 style={{marginTop: 0, color: '#f4f4f5', fontSize: '1.25rem'}}>Export Reports</h2>
            <p style={{color: '#94a3b8', fontSize: '13px', marginBottom: '20px'}}>Select a report type to view or download.</p>
            
            <div style={{display: 'flex', flexDirection: 'column'}}>
              {/* Option 1: View Sales GUI */}
              <button className="report-option" onClick={() => { setShowReportModal(false); navigate("/reports"); }}>
                📈 View Dashboard Analytics
              </button>
              
              {/* Option 2: Download Everything */}
              <button className="report-option" onClick={() => handleDownloadReport("ALL")}>
                📥 Download Master Ledger (All Invoices)
              </button>
              
              {/* Option 3: Download Only Unpaid */}
              <button className="report-option" onClick={() => handleDownloadReport("DUES")}>
                ⏳ Download Pending Dues Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
  