import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function StockHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, IN, OUT, ADJUST

  useEffect(() => {
    fetchStockHistory();
  }, []);

  const fetchStockHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get("/stock-history");
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch stock history", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      (item.product_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.reference || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const action = String(item.action_type || "").toUpperCase();
    const matchesType = filterType === "ALL" || action === filterType;

    return matchesSearch && matchesType;
  });

  // Summary Metrics
  const totalTransactions = history.length;
  const totalIn = history.filter(h => String(h.action_type).toUpperCase() === 'IN').length;
  const totalOut = history.filter(h => String(h.action_type).toUpperCase() === 'OUT').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; position: relative; z-index: 1;}
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .bg-blob { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; animation: floatSlow 9s ease-in-out infinite; }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 15px;}
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; }
        .stat-icon { position: absolute; right: -10px; bottom: -20px; font-size: 7rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 250px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #38bdf8; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15); }
        
        .filter-tabs { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .tab-btn.active { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 14px 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
        .table td { padding: 16px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; color: #f8fafc; }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;}
        .badge-in { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .badge-out { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .badge-adjust { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }

        .btn-inv { background: rgba(255,255,255,0.1); border: none; color: white; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .btn-inv:hover { background: rgba(255,255,255,0.2); transform: scale(1.02); }
      `}</style>

      {/* Decorative Backgrounds */}
      <div className="bg-blob" style={{ top: "-100px", left: "-100px", width: "400px", height: "400px", background: "rgba(56, 189, 248, 0.1)" }} />
      <div className="bg-blob" style={{ bottom: "-100px", right: "-100px", width: "500px", height: "500px", background: "rgba(139, 92, 246, 0.1)", animationDelay: "2s" }} />

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem', zIndex: 1 }}>Stock History Ledger</h1>
          </div>
          <button className="btn-inv" onClick={() => navigate('/inventory')}>
            📦 View Current Inventory
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}>
            <h2>Total Audits Logged</h2>
            <p className="amount">{totalTransactions}</p>
            <div className="stat-icon">📊</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}>
            <h2>Stock In Transactions</h2>
            <p className="amount">{totalIn}</p>
            <div className="stat-icon">📥</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" }}>
            <h2>Stock Out Transactions</h2>
            <p className="amount">{totalOut}</p>
            <div className="stat-icon">📤</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by product name or reference..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="filter-tabs">
              <button className={`tab-btn ${filterType === "ALL" ? "active" : ""}`} onClick={() => setFilterType("ALL")}>All</button>
              <button className={`tab-btn ${filterType === "IN" ? "active" : ""}`} onClick={() => setFilterType("IN")}>Stock In</button>
              <button className={`tab-btn ${filterType === "OUT" ? "active" : ""}`} onClick={() => setFilterType("OUT")}>Stock Out</button>
              <button className={`tab-btn ${filterType === "ADJUST" ? "active" : ""}`} onClick={() => setFilterType("ADJUST")}>Adjust</button>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product Name</th>
                <th>Type</th>
                <th>Reference</th>
                <th style={{ textAlign: 'center' }}>Qty Change</th>
                <th style={{ textAlign: 'right' }}>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Loading transaction audit logs...
                  </td>
                </tr>
              )}
              {!loading && filteredHistory.map(item => {
                const action = String(item.action_type || "").toUpperCase();
                const badgeClass = action === 'IN' ? 'badge-in' : action === 'OUT' ? 'badge-out' : 'badge-adjust';
                const isPositive = Number(item.quantity_change) > 0;

                return (
                  <tr key={item.id}>
                    <td style={{ color: '#94a3b8' }}>{item.date}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.product_name}</td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {item.action_type}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{item.reference || 'N/A'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: isPositive ? '#34d399' : '#f87171' }}>
                      {isPositive ? `+${item.quantity_change}` : item.quantity_change}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '15px' }}>{item.closing_balance}</td>
                  </tr>
                );
              })}
              {!loading && filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#64748b', background: 'rgba(15,23,42,0.4)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '30px', marginBottom: '10px' }}>📜</div>
                    <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>No Audit Logs Found</h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {history.length === 0 ? "No stock movements have been recorded yet." : "No transactions match your search or filter."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
