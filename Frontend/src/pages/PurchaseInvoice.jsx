import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios"; // Import API for backend requests

export default function PurchaseInvoice() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  
  const [formData, setFormData] = useState({
    vendorName: "",
    billNumber: "",
    billDate: new Date().toISOString().split("T")[0],
    totalAmount: "",
    status: "UNPAID"
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const res = await api.get("/purchases");
      setPurchases(res.data);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.vendorName || !formData.totalAmount) return alert("Vendor Name and Amount are required!");
    
    try {
      // Save permanently to backend
      await api.post("/purchases", {
        vendor_name: formData.vendorName,
        bill_number: formData.billNumber,
        bill_date: formData.billDate,
        total_amount: Number(formData.totalAmount),
        status: formData.status
      });
      
      // Reset form and refresh table
      setFormData({ vendorName: "", billNumber: "", billDate: new Date().toISOString().split("T")[0], totalAmount: "", status: "UNPAID" });
      fetchPurchases();
    } catch (error) {
      console.error("Failed to save purchase", error);
      alert("Failed to save purchase bill.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) return;
    try {
      await api.delete(`/purchases/${id}`);
      fetchPurchases(); // Refresh list after deletion
    } catch (error) {
      console.error("Failed to delete purchase", error);
      alert("Failed to delete bill.");
    }
  };

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }
        
        .grid-layout { display: grid; grid-template-columns: 350px 1fr; gap: 30px; align-items: start; }
        .card { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .input-label { display: block; font-size: 11px; color: #a78bfa; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .input-field { width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; box-sizing: border-box; outline: none; transition: 0.2s; }
        .input-field:focus { border-color: #a78bfa; background: rgba(30, 41, 59, 1); }
        
        .save-btn { width: 100%; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border: none; padding: 14px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .save-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .table td { padding: 15px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
        .status-unpaid { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .status-paid { background: rgba(16, 185, 129, 0.2); color: #34d399; }

        .btn-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s; font-size: 10px; }
        .btn-danger:hover { background: #ef4444; color: white; transform: scale(1.05); }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Purchase Invoices</h1>
          </div>
          <button className="back-btn" style={{width: 'auto', padding: '0 20px', borderRadius: '8px'}} onClick={() => navigate('/vendor-ledger')}>
            📒 Go to Vendor Ledger
          </button>
        </div>

        <div className="grid-layout">
          {/* Add Purchase Form */}
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#a78bfa' }}>Log New Bill</h3>
            <form onSubmit={handleSave}>
              <label className="input-label">Supplier / Vendor Name</label>
              <input className="input-field" placeholder="e.g. CP Plus Distributors" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} />

              <label className="input-label">Bill / Invoice Number</label>
              <input className="input-field" placeholder="INV-2026-XYZ" value={formData.billNumber} onChange={e => setFormData({...formData, billNumber: e.target.value})} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Date</label>
                  <input type="date" className="input-field" value={formData.billDate} onChange={e => setFormData({...formData, billDate: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Total Amount (₹)</label>
                  <input type="number" className="input-field" placeholder="0.00" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} />
                </div>
              </div>

              <label className="input-label">Payment Status</label>
              <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="UNPAID">Unpaid / Credit</option>
                <option value="PAID">Paid in Full</option>
              </select>

              <button type="submit" className="save-btn">💾 Save Purchase Bill</button>
            </form>
          </div>

          {/* Recent Purchases Table */}
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Recent Supplier Bills</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Bill No.</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    {/* Updated mapping to match database snake_case columns */}
                    <td>{new Date(p.bill_date).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontWeight: 'bold' }}>{p.vendor_name}</td>
                    <td style={{ color: '#94a3b8' }}>{p.bill_number || '-'}</td>
                    <td>₹{Number(p.total_amount).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`status-badge ${p.status === 'PAID' ? 'status-paid' : 'status-unpaid'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(p.id)} title="Delete Record">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No purchase bills logged yet.</td>
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