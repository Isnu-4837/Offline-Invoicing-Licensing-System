import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function LowStockAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    try {
      const res = await api.get("/inventory");
      // Filter items where stock is 5 or less
      const lowItems = res.data.filter(item => item.stock_quantity <= 5).map(item => ({
        id: item.id,
        product: item.product_name,
        currentStock: item.stock_quantity,
        minRequired: 5,
        status: item.stock_quantity <= 2 ? "Critical" : "Low"
      }));
      setAlerts(lowItems);
    } catch (error) {
      console.error("Failed to fetch inventory alerts", error);
    }
  };

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1000px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .summary-card { background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(249, 115, 22, 0.2); display: flex; justify-content: space-between; align-items: center; }
        .summary-card h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.9); }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .alert-list { display: flex; flex-direction: column; gap: 15px; }
        .alert-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; border-left: 4px solid #f97316; }
        .alert-card:hover { background: rgba(30, 41, 59, 0.8); transform: translateY(-2px); }
        .alert-card.critical { border-left-color: #ef4444; }

        .a-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; color: #f8fafc; }
        .a-meta { font-size: 0.9rem; color: #94a3b8; }
        .a-highlight { font-weight: 800; color: #f87171; }

        .btn-action { background: #3b82f6; border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-action:hover { background: #2563eb; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Low Stock Alerts</h1>
          </div>
          <button className="back-btn" style={{width: 'auto', padding: '0 20px', borderRadius: '8px'}} onClick={() => navigate('/purchase-invoices')}>
            🛒 Order Stock
          </button>
        </div>

        <div className="summary-card">
          <div>
            <h2>Items Requiring Restock</h2>
            <p className="amount">{alerts.length}</p>
          </div>
          <div style={{ fontSize: '4rem', opacity: 0.5 }}>📉</div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Action Required</h3>
          <div className="alert-list">
            {alerts.map(alert => (
              <div className={`alert-card ${alert.status === 'Critical' ? 'critical' : ''}`} key={alert.id}>
                <div>
                  <div className="a-title">{alert.product}</div>
                  <div className="a-meta">
                    Current Stock: <span className="a-highlight">{alert.currentStock}</span> | Target Minimum: {alert.minRequired}
                  </div>
                </div>
                <div>
                  <button className="btn-action" onClick={() => navigate('/purchase-invoices')}>Restock</button>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                Inventory is healthy! No low stock alerts. ✅
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}