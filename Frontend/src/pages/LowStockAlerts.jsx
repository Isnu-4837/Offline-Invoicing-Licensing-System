import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function LowStockAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, CRITICAL, LOW

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    setLoading(true);
    try {
      const res = await api.get("/inventory");

      const lowItems = res.data
        .filter(item => Number(item.stock_quantity) <= 5)
        .map(item => {
          const current = Number(item.stock_quantity) || 0;
          const cost = Number(item.purchase_price) || 0;
          // Smart AI-like Restock Prediction: Aim to restock to at least 10 units
          const suggestedRestock = Math.max(10 - current, 5);

          return {
            id: item.id,
            product: item.product_name,
            hsn: item.hsn_code || "N/A",
            currentStock: current,
            suggestedRestock: suggestedRestock,
            costEstimate: suggestedRestock * cost,
            status: current <= 2 ? "Critical" : "Low"
          };
        })
        .sort((a, b) => a.currentStock - b.currentStock); // Sort lowest stock first

      setAlerts(lowItems);
    } catch (error) {
      console.error("Failed to fetch inventory alerts", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || alert.status.toUpperCase() === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const criticalCount = alerts.filter(a => a.status === "Critical").length;
  const estimatedCost = alerts.reduce((sum, a) => sum + a.costEstimate, 0);

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
        @keyframes pulseCritical { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0.45); } 50% { box-shadow: 0 0 0 6px rgba(251, 113, 133, 0); } }
        @keyframes sheen { 0% { transform: translateX(-120%) skewX(-15deg); } 100% { transform: translateX(220%) skewX(-15deg); } }
        @keyframes auroraSlide { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        /* ---- Aurora ribbon + grain texture (ambient premium finish) ---- */
        .aurora-ribbon {
          position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 5; pointer-events: none;
          background: linear-gradient(90deg, #fb923c, #fb7185, #8b5cf6, #22d3ee, #fb923c);
          background-size: 300% 100%; animation: auroraSlide 12s ease-in-out infinite;
          box-shadow: 0 0 18px rgba(251, 146, 60, 0.5);
        }
        .grain-overlay {
          position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* ---- Animated gradient mesh background ---- */
        .bg-blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(100px); }
        .bg-blob.b1 { top: -160px; left: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(251,146,60,0.36), transparent 70%); animation: floatSlow 16s ease-in-out infinite; }
        .bg-blob.b2 { top: 15%; right: -160px; width: 460px; height: 460px; background: radial-gradient(circle, rgba(251,113,133,0.26), transparent 70%); animation: floatSlow2 19s ease-in-out infinite; }
        .bg-blob.b3 { bottom: -180px; left: 20%; width: 520px; height: 520px; background: radial-gradient(circle, rgba(139,92,246,0.24), transparent 70%); animation: floatSlow 22s ease-in-out infinite reverse; }
        .bg-blob.b4 { bottom: 10%; right: 8%; width: 340px; height: 340px; background: radial-gradient(circle, rgba(34,211,238,0.22), transparent 70%); animation: floatSlow2 14s ease-in-out infinite reverse; }

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
        .back-btn:hover { background: rgba(251, 146, 60, 0.22); border-color: #fdba74; transform: scale(1.08); }
        .logo-mark { width: 42px; height: 42px; border-radius: 13px; background: linear-gradient(135deg, #fb923c, #fb7185 60%, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; box-shadow: 0 10px 26px -8px rgba(251,146,60,0.55), inset 0 1px 0 rgba(255,255,255,0.35); flex-shrink: 0; }
        .page-title {
          margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif;
          background: linear-gradient(100deg, #ffffff 22%, #fed7aa 55%, #fda4af 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .page-subtitle { margin: 3px 0 0; font-size: 12.5px; color: #94a3b8; font-weight: 500; }

        /* ---- Stat cards (glass, color-tinted) ---- */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }
        @media (max-width: 850px) { .stats-grid { grid-template-columns: 1fr; } }
        .stat-card { border-radius: 20px; padding: 24px; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .stat-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.9; }
        .stat-card.low::before { background: linear-gradient(90deg, #fb923c, #fdba74); }
        .stat-card.critical::before { background: linear-gradient(90deg, #f43f5e, #fda4af); }
        .stat-card.cost::before { background: linear-gradient(90deg, #8b5cf6, #c4b5fd); }
        .stat-card:nth-of-type(1) { animation-delay: 0.02s; }
        .stat-card:nth-of-type(2) { animation-delay: 0.08s; }
        .stat-card:nth-of-type(3) { animation-delay: 0.14s; }
        .stat-card h2 { margin: 0 0 8px 0; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.75); font-weight: 700; }
        .stat-card .amount { font-size: 2.6rem; font-weight: 800; margin: 0; color: white; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif; }
        .stat-icon { position: absolute; right: -6px; bottom: -16px; font-size: 6rem; opacity: 0.14; pointer-events: none; }
        .stat-card.low { border-color: rgba(251,146,60,0.3); box-shadow: 0 20px 50px -20px rgba(251,146,60,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.critical { border-color: rgba(251,113,133,0.3); box-shadow: 0 20px 50px -20px rgba(251,113,133,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.cost { border-color: rgba(139,92,246,0.3); box-shadow: 0 20px 50px -20px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card.low:hover { box-shadow: 0 24px 55px -18px rgba(251,146,60,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.critical:hover { box-shadow: 0 24px 55px -18px rgba(251,113,133,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.cost:hover { box-shadow: 0 24px 55px -18px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }

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
        .search-input:focus { border-color: #fdba74; background: rgba(15,23,42,0.65); box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.2); }

        .filter-tabs { display: flex; gap: 6px; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); padding: 6px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 14px; border-radius: 9px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-family: inherit; }
        .tab-btn.active { background: rgba(251, 146, 60, 0.22); color: #fdba74; box-shadow: 0 2px 10px rgba(251,146,60,0.28); }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.06); }
        .tab-btn:focus-visible, .back-btn:focus-visible, .btn-order-top:focus-visible, .btn-action:focus-visible { outline: 2px solid #fdba74; outline-offset: 2px; }

        .btn-order-top {
          background: linear-gradient(135deg, #fb923c 0%, #e11d48 100%); background-size: 160% 160%; color: #180608; border: none;
          padding: 12px 22px; border-radius: 13px; font-weight: 800; cursor: pointer; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, background-position 0.25s ease;
          display: inline-flex; align-items: center; gap: 8px; font-family: inherit; box-shadow: 0 8px 22px -6px rgba(251, 146, 60, 0.5); font-size: 14px;
          position: relative; overflow: hidden;
        }
        .btn-order-top::after {
          content: ""; position: absolute; top: 0; left: 0; width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.5), transparent);
          animation: sheen 3.2s ease-in-out infinite; animation-delay: 1s; pointer-events: none;
        }
        .btn-order-top:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -6px rgba(251, 146, 60, 0.65); background-position: 100% 0%; color: #180608; }

        /* ---- Table ---- */
        .table-wrap { border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); margin-top: 6px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th { text-align: left; padding: 15px 16px; font-size: 10.5px; color: #94a3b8; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; }
        .table td { padding: 16px; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; color: #f1f5f9; }
        .table tr { transition: background 0.2s ease, box-shadow 0.2s ease; animation: rowIn 0.35s ease both; }
        .table tr:hover { background: rgba(255,255,255,0.04); }
        .table tr.row-critical td:first-child { box-shadow: inset 3px 0 0 #fb7185; }
        .table tr.row-critical:hover { box-shadow: inset 0 0 0 1px rgba(251,113,133,0.22); }
        .table tr.row-low td:first-child { box-shadow: inset 3px 0 0 #fb923c; }
        .table tr.row-low:hover { box-shadow: inset 0 0 0 1px rgba(251,146,60,0.22); }

        .badge { padding: 6px 13px; border-radius: 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid; text-transform: uppercase; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .badge-critical { background: rgba(251, 113, 133, 0.14); color: #fda4af; border-color: rgba(251, 113, 133, 0.35); animation: pulseCritical 2s infinite ease-in-out; }
        .badge-critical .badge-dot { animation: pulseDot 2s ease-in-out infinite; }
        .badge-low { background: rgba(251, 146, 60, 0.14); color: #fdba74; border-color: rgba(251, 146, 60, 0.35); }

        .highlight-text { font-size: 1.3rem; font-weight: 800; color: #fb7185; font-family: 'Space Grotesk', sans-serif; }

        .btn-action {
          background: rgba(34, 211, 238, 0.14); border: 1px solid rgba(34, 211, 238, 0.32); color: #67e8f9;
          padding: 9px 16px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.25s ease;
          font-family: inherit; display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px;
        }
        .btn-action:hover { background: #22d3ee; color: #062a30; transform: translateY(-2px); box-shadow: 0 8px 18px -4px rgba(34,211,238,0.5); }

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
            <div className="logo-mark">📉</div>
            <div>
              <h1 className="page-title">Inventory Health Alerts</h1>
              <p className="page-subtitle">Stock running low, sorted by urgency — restock before it becomes a stockout.</p>
            </div>
          </div>
          <button className="btn-order-top" onClick={() => navigate('/purchase-invoices')}>
            🛒 Log Restock Bill
          </button>
        </div>

        <div className="stats-grid">
          <div className="glass stat-card low">
            <h2>Total Items Low</h2>
            <p className="amount">{alerts.length}</p>
            <div className="stat-icon">📉</div>
          </div>
          <div className="glass stat-card critical">
            <h2>Critical Stock (&le; 2)</h2>
            <p className="amount">{criticalCount}</p>
            <div className="stat-icon">⚠️</div>
          </div>
          <div className="glass stat-card cost">
            <h2>Est. Restock Cost</h2>
            <p className="amount">₹{estimatedCost.toLocaleString("en-IN")}</p>
            <div className="stat-icon">💸</div>
          </div>
        </div>

        <div className="glass panel">
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search products requiring restock..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              <button
                className={`tab-btn ${filterStatus === "ALL" ? "active" : ""}`}
                onClick={() => setFilterStatus("ALL")}
              >
                All Alerts
              </button>
              <button
                className={`tab-btn ${filterStatus === "CRITICAL" ? "active" : ""}`}
                onClick={() => setFilterStatus("CRITICAL")}
              >
                Critical Only
              </button>
              <button
                className={`tab-btn ${filterStatus === "LOW" ? "active" : ""}`}
                onClick={() => setFilterStatus("LOW")}
              >
                Low Only
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Information</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Current Stock</th>
                  <th style={{ textAlign: 'center' }}>Smart Restock Qty</th>
                  <th style={{ textAlign: 'right' }}>Est. Cost</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr className="skeleton-row" key={`sk-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><div className="skeleton-bar" /></td>
                      ))}
                    </tr>
                  ))}

                {!loading && filteredAlerts.map((alert, idx) => (
                  <tr key={alert.id} className={alert.status === 'Critical' ? 'row-critical' : 'row-low'} style={{ animationDelay: `${Math.min(idx * 0.04, 0.5)}s` }}>
                    <td>
                      <strong style={{ display: 'block', fontSize: '1.05rem', marginBottom: '6px', color: 'white' }}>{alert.product}</strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HSN: {alert.hsn}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${alert.status === 'Critical' ? 'badge-critical' : 'badge-low'}`}>
                        <span className="badge-dot" />
                        {alert.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="highlight-text">{alert.currentStock}</span>
                    </td>
                    <td style={{ textAlign: 'center', color: '#22d3ee', fontWeight: 'bold', fontSize: '1.05rem' }}>
                      +{alert.suggestedRestock} Units
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '1.05rem' }}>
                      ₹{alert.costEstimate.toLocaleString("en-IN")}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-action" onClick={() => navigate('/purchase-invoices')}>
                        <span>🛒</span> Restock
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && filteredAlerts.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-block">
                        <div className="icon">✅</div>
                        <h3>Inventory is Healthy!</h3>
                        <p>{alerts.length === 0 ? "No low stock alerts detected." : "No alerts match your current filter."}</p>
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