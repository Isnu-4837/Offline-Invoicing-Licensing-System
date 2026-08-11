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
        setStats(res.data);
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
      minimumFractionDigits: 1,
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body { 
          background-color: #121212;
          background-image: 
            radial-gradient(circle at 15% 0%, rgba(20, 20, 25, 1) 0%, transparent 40%),
            radial-gradient(circle at 85% 100%, rgba(20, 20, 25, 1) 0%, transparent 40%);
          font-family: 'Plus Jakarta Sans', sans-serif; 
          color: #f1f5f9; 
          margin: 0; 
          min-height: 100vh;
        }

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

        .dashboard-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
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
          background: #1a1a1a;
          border-radius: 12px;
          padding: 35px 20px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, background 0.35s ease;
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
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.05) 50%, transparent 80%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }

        .action-card:hover::before {
          transform: translateX(100%);
        }

        .action-card:hover {
          transform: translateY(-6px) scale(1.015);
          background: #202020;
        }

        .action-card:active {
          transform: translateY(-2px) scale(0.99);
        }

        .action-card.invoice-card {
          border: 1px solid rgba(245, 158, 11, 0.15);
          animation-delay: 0.05s;
        }
        .action-card.invoice-card:hover {
          box-shadow: 0 14px 34px -10px rgba(245, 158, 11, 0.28);
          border-color: rgba(245, 158, 11, 0.35);
        }

        .action-card.inventory-card {
          border: 1px solid rgba(16, 185, 129, 0.15);
          animation-delay: 0.12s;
        }
        .action-card.inventory-card:hover {
          box-shadow: 0 14px 34px -10px rgba(16, 185, 129, 0.28);
          border-color: rgba(16, 185, 129, 0.35);
        }

        .action-icon {
          font-size: 26px;
          filter: grayscale(0.2);
          transition: transform 0.35s ease;
        }

        .action-card:hover .action-icon {
          transform: scale(1.15) rotate(-4deg);
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
          background: #1a1a1a;
          border-radius: 10px;
          padding: 20px 24px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.16s; }
        .stat-card:nth-child(3) { animation-delay: 0.22s; }
        .stat-card:nth-child(4) { animation-delay: 0.28s; }

        .stat-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
        }

        .stat-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
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
          background: #1a1a1a;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          gap: 16px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.05);
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
          background: #262626;
          border: 1px solid rgba(255, 255, 255, 0.03);
          color: white;
          padding: 12px 16px 12px 42px;
          border-radius: 8px;
          font-size: 13.5px;
          font-family: inherit;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: rgba(245, 158, 11, 0.4);
          background: #2a2a2a;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
        }

        .search-input::placeholder {
          color: #64748b;
        }

        .btn-reports {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
          background-size: 160% 160%;
          color: white;
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
          box-shadow: 0 8px 20px rgba(234, 88, 12, 0.35);
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
          background: #1a1a1a;
          border-radius: 10px;
          padding: 16px 20px;
          border: 1px solid rgba(255, 255, 255, 0.03);
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
          background: #1f1f1f;
          border-color: rgba(255, 255, 255, 0.08);
          transform: translateY(-3px);
          box-shadow: 0 12px 26px -14px rgba(0, 0, 0, 0.6);
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
          background: #1a1a1a;
          padding: 30px;
          border-radius: 12px;
          width: 400px; 
          border: 1px solid rgba(251, 191, 36, 0.2); 
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
        }
        .report-option:hover {
          background: #333;
          border-color: rgba(251, 191, 36, 0.4);
          transform: translateX(3px);
        }
      `}</style>

      <div className="dashboard-container">
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
          <div className="stat-card">
            <div className="stat-title">TOTAL SALES (BILLED)</div>
            <div className={`stat-value text-yellow ${!statsLoaded ? 'is-loading' : ''}`}>
              ₹{formatCurrency(stats.total_sales)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">AMOUNT RECEIVED</div>
            <div className={`stat-value text-green ${!statsLoaded ? 'is-loading' : ''}`}>
              ₹{formatCurrency(stats.total_collected)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">TOTAL DUE (PENDING)</div>
            <div className={`stat-value text-red ${!statsLoaded ? 'is-loading' : ''}`}>
              ₹{formatCurrency(stats.total_due)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">TOTAL INVOICES</div>
            <div className={`stat-value text-white ${!statsLoaded ? 'is-loading' : ''}`}>
              {stats.total_invoices}
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
          <div>Powered & Developed By <strong>NextGen TechStack</strong> © 2026</div>
          <div className="footer-links">
            <a href="https://nextgentechstack.tech" target="_blank" rel="noopener noreferrer" className="footer-link">🌐 nextgentechstack.tech</a>
            <a href="mailto:nextgentechstack1@gmail.com" className="footer-link">✉️ nextgentechstack1@gmail.com</a>
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
              <button className="report-option" onClick={() => { setShowReportModal(false); navigate("/reports"); }}>
                📊 Yearly, Monthly & Weekly Sales Reports
              </button>
              <button className="report-option" onClick={() => handleComingSoon("GSTR-1 Return Data")}>
                GSTR-1 Return Data
              </button>
              <button className="report-option" onClick={() => handleComingSoon("Pending Dues Aging")}>
                Pending Dues Aging Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}