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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          background-color: #08050f;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatSlow { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(3%, -5%) scale(1.08); } }
        @keyframes floatSlow2 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4%, 4%) scale(1.05); } }
        @keyframes shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
        @keyframes pulseDot { 0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; } 70% { box-shadow: 0 0 0 6px transparent; opacity: 0.4; } }
        @keyframes auroraSlide { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        /* ---- Aurora ribbon + grain texture (ambient premium finish) ---- */
        .aurora-ribbon {
          position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 5; pointer-events: none;
          background: linear-gradient(90deg, #22d3ee, #8b5cf6, #34d399, #fb7185, #22d3ee);
          background-size: 300% 100%; animation: auroraSlide 12s ease-in-out infinite;
          box-shadow: 0 0 18px rgba(34, 211, 238, 0.5);
        }
        .grain-overlay {
          position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* ---- Animated gradient mesh background ---- */
        .bg-blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(100px); }
        .bg-blob.b1 { top: -160px; left: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(34,211,238,0.32), transparent 70%); animation: floatSlow 16s ease-in-out infinite; }
        .bg-blob.b2 { top: 15%; right: -160px; width: 460px; height: 460px; background: radial-gradient(circle, rgba(139,92,246,0.28), transparent 70%); animation: floatSlow2 19s ease-in-out infinite; }
        .bg-blob.b3 { bottom: -180px; left: 20%; width: 520px; height: 520px; background: radial-gradient(circle, rgba(52,211,153,0.2), transparent 70%); animation: floatSlow 22s ease-in-out infinite reverse; }
        .bg-blob.b4 { bottom: 10%; right: 8%; width: 340px; height: 340px; background: radial-gradient(circle, rgba(251,113,133,0.2), transparent 70%); animation: floatSlow2 14s ease-in-out infinite reverse; }

        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px 70px; animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) both; position: relative; z-index: 1; }

        /* ---- Core glass primitive ---- */
        .glass {
          background: rgba(255, 255, 255, 0.055);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 20px 50px -20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.16);
        }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
        .back-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: white; width: 42px; height: 42px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); flex-shrink: 0; }
        .back-btn:hover { background: rgba(34, 211, 238, 0.22); border-color: #67e8f9; transform: scale(1.08); }
        .logo-mark { width: 42px; height: 42px; border-radius: 13px; background: linear-gradient(135deg, #22d3ee, #38bdf8 55%, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; box-shadow: 0 10px 26px -8px rgba(34,211,238,0.55), inset 0 1px 0 rgba(255,255,255,0.35); flex-shrink: 0; }
        .page-title {
          margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif;
          background: linear-gradient(100deg, #ffffff 22%, #67e8f9 55%, #c4b5fd 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .page-subtitle { margin: 3px 0 0; font-size: 12.5px; color: #94a3b8; font-weight: 500; }

        /* ---- Stat cards (glass, color-tinted) ---- */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }
        @media (max-width: 850px) { .stats-grid { grid-template-columns: 1fr; } }
        .stat-card { border-radius: 20px; padding: 24px; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .stat-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.9; }
        .stat-card.total::before { background: linear-gradient(90deg, #22d3ee, #67e8f9); }
        .stat-card.in::before { background: linear-gradient(90deg, #34d399, #6ee7b7); }
        .stat-card.out::before { background: linear-gradient(90deg, #f43f5e, #fda4af); }
        .stat-card:nth-of-type(1) { animation-delay: 0.02s; }
        .stat-card:nth-of-type(2) { animation-delay: 0.08s; }
        .stat-card:nth-of-type(3) { animation-delay: 0.14s; }
        .stat-card h2 { margin: 0 0 8px 0; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.75); font-weight: 700; }
        .stat-card .amount { font-size: 2.6rem; font-weight: 800; margin: 0; color: white; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif; }
        .stat-icon { position: absolute; right: -6px; bottom: -16px; font-size: 6rem; opacity: 0.14; pointer-events: none; }
        .stat-card.total { border-color: rgba(34,211,238,0.3); box-shadow: 0 20px 50px -20px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.in { border-color: rgba(52,211,153,0.3); box-shadow: 0 20px 50px -20px rgba(52,211,153,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.out { border-color: rgba(251,113,133,0.3); box-shadow: 0 20px 50px -20px rgba(251,113,133,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card.total:hover { box-shadow: 0 24px 55px -18px rgba(34,211,238,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.in:hover { box-shadow: 0 24px 55px -18px rgba(52,211,153,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.out:hover { box-shadow: 0 24px 55px -18px rgba(251,113,133,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }

        /* ---- Main panel ---- */
        .panel { border-radius: 22px; padding: 28px; animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both; }

        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; gap: 14px; flex-wrap: wrap; }

        .search-wrap { position: relative; flex: 1; min-width: 240px; display: flex; align-items: center; }
        .search-wrap .search-icon { position: absolute; left: 14px; font-size: 13px; opacity: 0.6; pointer-events: none; }
        .search-input {
          padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14);
          background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); color: white; font-size: 14px;
          outline: none; transition: all 0.25s ease; font-family: inherit; box-sizing: border-box;
          width: 100%; padding-left: 38px;
        }
        .search-input:focus { border-color: #67e8f9; background: rgba(15,23,42,0.65); box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.2); }

        .filter-tabs { display: flex; gap: 6px; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); padding: 6px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 14px; border-radius: 9px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-family: inherit; }
        .tab-btn.active { background: rgba(34, 211, 238, 0.22); color: #67e8f9; box-shadow: 0 2px 10px rgba(34,211,238,0.28); }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.06); }
        .tab-btn:focus-visible, .back-btn:focus-visible, .btn-inv:focus-visible { outline: 2px solid #67e8f9; outline-offset: 2px; }

        .btn-inv {
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: white;
          padding: 12px 22px; border-radius: 13px; cursor: pointer; font-weight: 700; transition: all 0.25s ease;
          display: inline-flex; align-items: center; gap: 8px; font-family: inherit; backdrop-filter: blur(10px); font-size: 14px;
        }
        .btn-inv:hover { background: rgba(34, 211, 238, 0.18); border-color: rgba(34,211,238,0.4); transform: translateY(-2px); box-shadow: 0 8px 20px -4px rgba(34,211,238,0.35); }

        /* ---- Table ---- */
        .table-wrap { border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); margin-top: 6px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th { text-align: left; padding: 15px 16px; font-size: 10.5px; color: #94a3b8; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; }
        .table td { padding: 16px; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; color: #f1f5f9; }
        .table tr { transition: background 0.2s ease, box-shadow 0.2s ease; animation: rowIn 0.35s ease both; }
        .table tr:hover { background: rgba(255,255,255,0.04); }
        .table tr.row-in td:first-child { box-shadow: inset 3px 0 0 #34d399; }
        .table tr.row-in:hover { box-shadow: inset 0 0 0 1px rgba(52,211,153,0.2); }
        .table tr.row-out td:first-child { box-shadow: inset 3px 0 0 #fb7185; }
        .table tr.row-out:hover { box-shadow: inset 0 0 0 1px rgba(251,113,133,0.2); }
        .table tr.row-adjust td:first-child { box-shadow: inset 3px 0 0 #fb923c; }
        .table tr.row-adjust:hover { box-shadow: inset 0 0 0 1px rgba(251,146,60,0.2); }

        .badge { padding: 6px 13px; border-radius: 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid; text-transform: uppercase; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulseDot 2s ease-in-out infinite; }
        .badge-in { background: rgba(52, 211, 153, 0.14); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); }
        .badge-out { background: rgba(251, 113, 133, 0.14); color: #fda4af; border-color: rgba(251, 113, 133, 0.35); }
        .badge-adjust { background: rgba(251, 146, 60, 0.14); color: #fdba74; border-color: rgba(251, 146, 60, 0.35); }

        /* ---- Loading skeletons ---- */
        .skeleton-row td { padding: 18px 16px; }
        .skeleton-bar { height: 13px; border-radius: 6px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 37%, rgba(255,255,255,0.04) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }

        .empty-block { text-align: center; padding: 60px 20px; color: #64748b; animation: fadeIn 0.4s ease both; }
        .empty-block .icon { font-size: 3rem; margin-bottom: 14px; }
        .empty-block h3 { margin: 0 0 8px 0; color: white; font-size: 1.4rem; font-family: 'Space Grotesk', sans-serif; }
        .empty-block p { margin: 0; font-size: 14px; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div className="aurora-ribbon" />
      <div className="grain-overlay" />
      <div className="bg-blob b1" />
      <div className="bg-blob b2" />
      <div className="bg-blob b3" />
      <div className="bg-blob b4" />

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <div className="logo-mark">📊</div>
            <div>
              <h1 className="page-title">Stock History Ledger</h1>
              <p className="page-subtitle">Every stock movement, timestamped and traceable.</p>
            </div>
          </div>
          <button className="btn-inv" onClick={() => navigate('/inventory')}>
            📦 View Current Inventory
          </button>
        </div>

        <div className="stats-grid">
          <div className="glass stat-card total">
            <h2>Total Audits Logged</h2>
            <p className="amount">{totalTransactions}</p>
            <div className="stat-icon">📊</div>
          </div>
          <div className="glass stat-card in">
            <h2>Stock In Transactions</h2>
            <p className="amount">{totalIn}</p>
            <div className="stat-icon">📥</div>
          </div>
          <div className="glass stat-card out">
            <h2>Stock Out Transactions</h2>
            <p className="amount">{totalOut}</p>
            <div className="stat-icon">📤</div>
          </div>
        </div>

        <div className="glass panel">
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search by product name or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              <button className={`tab-btn ${filterType === "ALL" ? "active" : ""}`} onClick={() => setFilterType("ALL")}>All</button>
              <button className={`tab-btn ${filterType === "IN" ? "active" : ""}`} onClick={() => setFilterType("IN")}>Stock In</button>
              <button className={`tab-btn ${filterType === "OUT" ? "active" : ""}`} onClick={() => setFilterType("OUT")}>Stock Out</button>
              <button className={`tab-btn ${filterType === "ADJUST" ? "active" : ""}`} onClick={() => setFilterType("ADJUST")}>Adjust</button>
            </div>
          </div>

          <div className="table-wrap">
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
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr className="skeleton-row" key={`sk-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><div className="skeleton-bar" /></td>
                      ))}
                    </tr>
                  ))}

                {!loading && filteredHistory.map((item, idx) => {
                  const action = String(item.action_type || "").toUpperCase();
                  const badgeClass = action === 'IN' ? 'badge-in' : action === 'OUT' ? 'badge-out' : 'badge-adjust';
                  const rowClass = action === 'IN' ? 'row-in' : action === 'OUT' ? 'row-out' : 'row-adjust';
                  const isPositive = Number(item.quantity_change) > 0;

                  return (
                    <tr key={item.id} className={rowClass} style={{ animationDelay: `${Math.min(idx * 0.03, 0.5)}s` }}>
                      <td style={{ color: '#94a3b8' }}>{new Date(item.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) || item.date}</td>
                      <td style={{ fontWeight: 'bold', fontSize: '1.02rem', color: 'white' }}>{item.product_name}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          <span className="badge-dot" />
                          {item.action_type}
                        </span>
                      </td>
                      <td style={{ color: '#cbd5e1' }}>{item.reference || 'N/A'}</td>
                      <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.05rem', color: isPositive ? '#6ee7b7' : '#fda4af', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {isPositive ? `+${item.quantity_change}` : item.quantity_change}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '1.05rem', fontFamily: "'Space Grotesk', sans-serif" }}>{item.closing_balance}</td>
                    </tr>
                  );
                })}

                {!loading && filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-block">
                        <div className="icon">📜</div>
                        <h3>No Audit Logs Found</h3>
                        <p>{history.length === 0 ? "No stock movements have been recorded yet." : "No transactions match your search or filter."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}