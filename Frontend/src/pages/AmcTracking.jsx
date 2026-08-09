import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AmcTracking() {
  const navigate = useNavigate();
  const [amcData, setAmcData] = useState([]);

  useEffect(() => {
    fetchAmcContracts();
  }, []);

  const fetchAmcContracts = async () => {
    try {
      const res = await api.get("/amc");
      setAmcData(res.data);
    } catch (error) {
      console.error("Failed to fetch AMC contracts", error);
    }
  };

  const getStatusColor = (status) => {
    if (status === "Active") return "rgba(16, 185, 129, 0.2)";
    if (status === "Expiring Soon") return "rgba(245, 158, 11, 0.2)";
    return "rgba(239, 68, 68, 0.2)";
  };

  const getStatusTextColor = (status) => {
    if (status === "Active") return "#34d399";
    if (status === "Expiring Soon") return "#fbbf24";
    return "#f87171";
  };

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1100px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .summary-card { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(2, 132, 199, 0.2); display: flex; justify-content: space-between; align-items: center; }
        .summary-card h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; }
        .table td { padding: 16px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .status-badge { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; display: inline-block; text-align: center; }
        .action-btn { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 12px; }
        .action-btn:hover { background: #38bdf8; color: #0f172a; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>AMC Tracking</h1>
          </div>
        </div>

        <div className="summary-card">
          <div>
            <h2>Active Contracts Tracked</h2>
            <p className="amount">{amcData.length}</p>
          </div>
          <div style={{ fontSize: '4rem', opacity: 0.5 }}>🛠️</div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Contract Ledger</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Product / Service</th>
                <th>Install Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {amcData.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold' }}>{item.client_name}</td>
                  <td style={{ color: '#94a3b8' }}>{item.product_details}</td>
                  <td>{item.install_date}</td>
                  <td style={{ fontWeight: '600' }}>{item.expiry_date}</td>
                  <td>
                    <span 
                      className="status-badge" 
                      style={{ 
                        background: getStatusColor(item.status), 
                        color: getStatusTextColor(item.status) 
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button className="action-btn" onClick={() => alert(`Alert sent to ${item.client_name}!`)}>Send Alert</button>
                  </td>
                </tr>
              ))}
              {amcData.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No AMC contracts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}