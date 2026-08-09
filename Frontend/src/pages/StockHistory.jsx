import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function StockHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStockHistory();
  }, []);

  const fetchStockHistory = async () => {
    try {
      const res = await api.get("/stock-history");
      setHistory(res.data);
    } catch (error) {
      console.error("Failed to fetch stock history", error);
    }
  };

  const filteredHistory = history.filter(item => 
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .search-input { width: 100%; max-width: 300px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; outline: none; transition: 0.2s; }
        .search-input:focus { border-color: #38bdf8; background: rgba(30, 41, 59, 1); }

        .table { width: 100%; border-collapse: collapse; }
        .table th { text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; }
        .table td { padding: 16px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
        .badge-in { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .badge-out { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .badge-adjust { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Stock History Ledger</h1>
          </div>
          <button className="back-btn" style={{width: 'auto', padding: '0 20px', borderRadius: '8px'}} onClick={() => navigate('/inventory')}>
            📦 View Current Inventory
          </button>
        </div>

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Transaction Log</h3>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search product or ref..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Qty Change</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(item => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.product_name}</td>
                  <td>
                    <span className={`badge ${item.action_type === 'IN' ? 'badge-in' : item.action_type === 'OUT' ? 'badge-out' : 'badge-adjust'}`}>
                      {item.action_type}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{item.reference}</td>
                  <td style={{ fontWeight: 'bold', color: item.quantity_change > 0 ? '#34d399' : '#f87171' }}>
                    {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                  </td>
                  <td style={{ fontWeight: '800' }}>{item.closing_balance}</td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No stock transactions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}