import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AmcTracking() {
  const navigate = useNavigate();
  const [amcData, setAmcData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    client_name: "",
    product_details: "",
    install_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchAmcContracts();
  }, []);

  const fetchAmcContracts = async () => {
    try {
      const res = await api.get("/amc");
      setAmcData(res.data || []);
    } catch (error) {
      console.error("Failed to fetch AMC contracts", error);
    }
  };

  const calculateStatus = (expiryDate) => {
    if (!expiryDate) return "Unknown";
    const today = new Date();
    const exp = new Date(expiryDate);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expired";
    if (diffDays <= 30) return "Expiring Soon";
    return "Active";
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: calculateStatus(formData.expiry_date)
      };
      await api.post("/amc", payload);
      await fetchAmcContracts();
      setIsModalOpen(false);
      setFormData({
        client_name: "",
        product_details: "",
        install_date: new Date().toISOString().split("T")[0],
        expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
      });
    } catch (error) {
      console.error("Failed to add AMC", error);
      alert("Failed to save AMC contract.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendWhatsAppAlert = (amc) => {
    const status = calculateStatus(amc.expiry_date);
    let message = "";
    
    if (status === "Expired") {
      message = `Dear ${amc.client_name}, your Annual Maintenance Contract (AMC) for ${amc.product_details} expired on ${amc.expiry_date}. Please contact us to renew your contract and ensure uninterrupted service.`;
    } else if (status === "Expiring Soon") {
      message = `Dear ${amc.client_name}, this is a gentle reminder that your AMC for ${amc.product_details} is expiring soon on ${amc.expiry_date}. Kindly renew it at your earliest convenience.`;
    } else {
      message = `Dear ${amc.client_name}, your AMC for ${amc.product_details} is currently active and valid until ${amc.expiry_date}. Thank you for choosing us!`;
    }

    const searchParams = new URLSearchParams({ phone: "", message: message }).toString();
    navigate(`/whatsapp-integration?${searchParams}`);
  };

  const getStatusColor = (status) => {
    if (status === "Active") return "rgba(16, 185, 129, 0.15)";
    if (status === "Expiring Soon") return "rgba(245, 158, 11, 0.15)";
    if (status === "Expired") return "rgba(239, 68, 68, 0.15)";
    return "rgba(255, 255, 255, 0.1)";
  };

  const getStatusTextColor = (status) => {
    if (status === "Active") return "#34d399";
    if (status === "Expiring Soon") return "#fbbf24";
    if (status === "Expired") return "#f87171";
    return "#94a3b8";
  };

  const filteredData = amcData.filter(item => 
    item.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product_details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = amcData.filter(d => calculateStatus(d.expiry_date) === "Active").length;
  const expiringCount = amcData.filter(d => calculateStatus(d.expiry_date) === "Expiring Soon").length;
  const expiredCount = amcData.filter(d => calculateStatus(d.expiry_date) === "Expired").length;

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; }
        .stat-icon { position: absolute; right: -10px; bottom: -20px; font-size: 6rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; }
        .search-input { flex: 1; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #38bdf8; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15); }
        
        .add-btn { background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
        .add-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(56, 189, 248, 0.4); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 14px; font-size: 11px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
        .table td { padding: 16px 14px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .status-badge { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; display: inline-block; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        
        .action-btn { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 12px; display: inline-flex; gap: 6px; align-items: center; }
        .action-btn:hover { background: #22c55e; color: white; transform: scale(1.05); }

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(9, 13, 22, 0.8); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeInUp 0.3s ease both; }
        .modal-box { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255, 255, 255, 0.12); padding: 30px; border-radius: 16px; max-width: 500px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .modal-box h3 { margin-top: 0; margin-bottom: 20px; color: white; font-size: 1.4rem; }
        .input-label { display: block; font-size: 11px; color: #38bdf8; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
        .cancel-btn { background: rgba(255,255,255,0.1); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .cancel-btn:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Add New AMC Contract</h3>
            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: "15px" }}>
                <label className="input-label">Client Name</label>
                <input required className="search-input" style={{ width: "100%" }} placeholder="E.g. Apex Industries" value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value})} />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label className="input-label">Product / Service Details</label>
                <input required className="search-input" style={{ width: "100%" }} placeholder="E.g. 16-Channel CCTV System" value={formData.product_details} onChange={(e) => setFormData({...formData, product_details: e.target.value})} />
              </div>
              <div className="form-row">
                <div>
                  <label className="input-label">Installation Date</label>
                  <input required type="date" className="search-input" style={{ width: "100%" }} value={formData.install_date} onChange={(e) => setFormData({...formData, install_date: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Expiry Date</label>
                  <input required type="date" className="search-input" style={{ width: "100%" }} value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="add-btn" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>AMC Tracking</h1>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}>
            <h2>Active Contracts</h2>
            <p className="amount">{activeCount}</p>
            <div className="stat-icon">🛡️</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" }}>
            <h2>Expiring Soon (&lt;30 Days)</h2>
            <p className="amount">{expiringCount}</p>
            <div className="stat-icon">⏳</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" }}>
            <h2>Expired Contracts</h2>
            <p className="amount">{expiredCount}</p>
            <div className="stat-icon">⚠️</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by client or product..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="add-btn" onClick={() => setIsModalOpen(true)}>
              + Add Contract
            </button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Product / Service</th>
                <th>Install Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => {
                const dynamicStatus = calculateStatus(item.expiry_date);
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold', color: 'white' }}>{item.client_name}</td>
                    <td style={{ color: '#94a3b8' }}>{item.product_details}</td>
                    <td>{new Date(item.install_date).toLocaleDateString("en-IN")}</td>
                    <td style={{ fontWeight: '600' }}>{new Date(item.expiry_date).toLocaleDateString("en-IN")}</td>
                    <td>
                      <span 
                        className="status-badge" 
                        style={{ 
                          background: getStatusColor(dynamicStatus), 
                          color: getStatusTextColor(dynamicStatus) 
                        }}
                      >
                        {dynamicStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="action-btn" onClick={() => sendWhatsAppAlert(item)}>
                        <span>📨</span> Send Alert
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                    No contracts match your search.
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