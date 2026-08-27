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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; position: relative; z-index: 1;}
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .bg-blob { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; animation: floatSlow 9s ease-in-out infinite; }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; }
        .stat-icon { position: absolute; right: -10px; bottom: -20px; font-size: 7rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); padding: 25px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 250px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #f97316; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.15); }
        
        .filter-tabs { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .tab-btn.active { background: rgba(249, 115, 22, 0.2); color: #fdba74; }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 14px 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
        .table td { padding: 16px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; color: #f8fafc; }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge-critical { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); animation: pulseCritical 2s infinite; }
        .badge-low { background: rgba(249, 115, 22, 0.2); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); }

        @keyframes pulseCritical {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }

        .highlight-text { font-size: 1.2rem; font-weight: 800; color: #f87171; }
        
        .btn-action { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; }
        .btn-action:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4); }

        .btn-order-top { background: rgba(255,255,255,0.1); border: none; color: white; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .btn-order-top:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }
      `}</style>

      {/* Decorative Backgrounds */}
      <div className="bg-blob" style={{ top: "-100px", left: "-100px", width: "400px", height: "400px", background: "rgba(249, 115, 22, 0.12)" }} />
      <div className="bg-blob" style={{ bottom: "-100px", right: "-100px", width: "500px", height: "500px", background: "rgba(239, 68, 68, 0.1)", animationDelay: "2s" }} />

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem', zIndex: 1 }}>Inventory Health Alerts</h1>
          </div>
          <button className="btn-order-top" onClick={() => navigate('/purchase-invoices')}>
            🛒 Log Restock Bill
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)" }}>
            <h2>Total Items Low</h2>
            <p className="amount">{alerts.length}</p>
            <div className="stat-icon">📉</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
            <h2>Critical Stock (&le; 2)</h2>
            <p className="amount">{criticalCount}</p>
            <div className="stat-icon">⚠️</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}>
            <h2>Est. Restock Cost</h2>
            <p className="amount">₹{estimatedCost.toLocaleString("en-IN")}</p>
            <div className="stat-icon">💸</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search products requiring restock..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
              {loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Scanning inventory levels...
                  </td>
                </tr>
              )}
              {!loading && filteredAlerts.map(alert => (
                <tr key={alert.id}>
                  <td>
                    <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px' }}>{alert.product}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>HSN: {alert.hsn}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${alert.status === 'Critical' ? 'badge-critical' : 'badge-low'}`}>
                      {alert.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="highlight-text">{alert.currentStock}</span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold' }}>
                    +{alert.suggestedRestock} Units
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
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
                  <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#64748b', background: 'rgba(15,23,42,0.4)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                    <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>Inventory is Healthy!</h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {alerts.length === 0 ? "No low stock alerts detected." : "No alerts match your current filter."}
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