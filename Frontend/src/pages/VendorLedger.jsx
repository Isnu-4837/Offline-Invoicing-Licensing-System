import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function VendorLedger() {
  const navigate = useNavigate();
  const [ledgerData, setLedgerData] = useState([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await api.get("/vendors");
      setLedgerData(res.data);
    } catch (error) {
      console.error("Failed to fetch vendor ledger", error);
    }
  };

  const totalPayable = ledgerData.reduce((acc, curr) => acc + curr.pending, 0);

  const handleMarkPaid = async (id) => {
    try {
      await api.put(`/vendors/${id}/pay`);
      fetchVendors(); // Refresh ledger data from backend
    } catch (error) {
      console.error("Failed to update vendor payment", error);
      alert("Failed to mark vendor as paid.");
    }
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

        .summary-card { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.2); display: flex; justify-content: space-between; align-items: center; }
        .summary-card h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .vendor-list { display: flex; flex-direction: column; gap: 15px; }
        .vendor-item { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
        .vendor-item:hover { background: rgba(30, 41, 59, 0.8); border-color: #f43f5e; transform: translateY(-2px); }
        
        .v-name { font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; }
        .v-meta { font-size: 0.85rem; color: #94a3b8; }
        .v-pending { font-size: 1.2rem; font-weight: 800; color: #f43f5e; text-align: right; }
        .v-settled { font-size: 1.2rem; font-weight: 800; color: #10b981; text-align: right; }
        
        .btn-pay { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; transition: 0.2s;}
        .btn-pay:hover { background: #f43f5e; border-color: #f43f5e; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Vendor Ledger</h1>
          </div>
          <button className="back-btn" style={{width: 'auto', padding: '0 20px', borderRadius: '8px'}} onClick={() => navigate('/purchase-invoices')}>
            ➕ Log New Bill
          </button>
        </div>

        <div className="summary-card">
          <div>
            <h2>Total Outstanding Payables</h2>
            <p className="amount">₹{totalPayable.toLocaleString('en-IN')}</p>
          </div>
          <div style={{ fontSize: '4rem', opacity: 0.5 }}>💸</div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Supplier Balances</h3>
          <div className="vendor-list">
            {ledgerData.map(vendor => (
              <div className="vendor-item" key={vendor.id}>
                <div>
                  <div className="v-name">{vendor.name}</div>
                  <div className="v-meta">
                    Total Billed: ₹{vendor.total_billed.toLocaleString()} | Paid: ₹{vendor.paid.toLocaleString()}
                  </div>
                  <div className="v-meta" style={{marginTop: '4px'}}>
                    Last Payment: {vendor.last_payment || 'N/A'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {vendor.pending > 0 ? (
                    <>
                      <div className="v-pending">Due: ₹{vendor.pending.toLocaleString()}</div>
                      <button className="btn-pay" onClick={() => handleMarkPaid(vendor.id)}>
                        Mark as Paid
                      </button>
                    </>
                  ) : (
                    <div className="v-settled">✓ Settled</div>
                  )}
                </div>
              </div>
            ))}
            {ledgerData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                No vendor records found. Log a purchase bill first!
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}