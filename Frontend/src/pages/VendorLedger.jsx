import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function VendorLedger() {
  const navigate = useNavigate();
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL, PENDING, SETTLED
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get("/vendors");
      setLedgerData(res.data || []);
    } catch (error) {
      console.error("Failed to fetch vendor ledger", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPayable = ledgerData.reduce((acc, curr) => acc + (Number(curr.pending) || 0), 0);

  const handleMarkPaid = async (id, name) => {
    if (!window.confirm(`Are you sure you want to mark all pending dues for ${name} as fully settled?`)) {
      return;
    }
    
    setProcessingId(id);
    try {
      await api.put(`/vendors/${id}/pay`);
      await fetchVendors(); // Refresh ledger data from backend
    } catch (error) {
      console.error("Failed to update vendor payment", error);
      alert("Failed to mark vendor as paid. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const filteredData = ledgerData.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isPending = Number(vendor.pending) > 0;
    
    if (filter === "PENDING") return matchesSearch && isPending;
    if (filter === "SETTLED") return matchesSearch && !isPending;
    return matchesSearch;
  });

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1100px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .summary-card { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.2); display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .summary-card h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; }
        .summary-icon { position: absolute; right: -10px; bottom: -20px; font-size: 8rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 250px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #f43f5e; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.15); }
        
        .filter-tabs { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .tab-btn.active { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .vendor-list { display: flex; flex-direction: column; gap: 15px; }
        .vendor-item { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 20px; align-items: center; transition: 0.2s; }
        .vendor-item:hover { background: rgba(30, 41, 59, 0.8); border-color: rgba(244, 63, 94, 0.3); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
        @media (max-width: 768px) { .vendor-item { grid-template-columns: 1fr; gap: 15px; } }
        
        .v-name { font-size: 1.2rem; font-weight: 700; margin-bottom: 6px; color: white; }
        .v-meta { font-size: 0.85rem; color: #94a3b8; }
        
        .progress-container { width: 100%; margin-top: 10px; }
        .progress-bar-bg { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: #10b981; border-radius: 10px; transition: width 0.5s ease; }
        .progress-labels { display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; color: #64748b; font-weight: 600; }

        .v-pending { font-size: 1.3rem; font-weight: 800; color: #f43f5e; text-align: right; }
        .v-settled { font-size: 1.1rem; font-weight: 800; color: #10b981; text-align: right; display: flex; align-items: center; gap: 6px; justify-content: flex-end; padding: 8px 0;}
        
        .btn-pay { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #fca5a5; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; width: 100%; min-width: 140px; font-family: inherit;}
        .btn-pay:hover:not(:disabled) { background: #f43f5e; border-color: #f43f5e; color: white; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4); }
        .btn-pay:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-log-bill { background: rgba(255,255,255,0.1); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .btn-log-bill:hover { background: rgba(255,255,255,0.2); transform: scale(1.02); }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Vendor Ledger</h1>
          </div>
          <button className="btn-log-bill" onClick={() => navigate('/purchase-invoices')}>
            ➕ Log New Bill
          </button>
        </div>

        <div className="summary-card">
          <div style={{ zIndex: 1 }}>
            <h2>Total Outstanding Payables</h2>
            <p className="amount">₹{formatCurrency(totalPayable)}</p>
          </div>
          <div className="summary-icon">💸</div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search suppliers by name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="filter-tabs">
              <button 
                className={`tab-btn ${filter === "ALL" ? "active" : ""}`} 
                onClick={() => setFilter("ALL")}
              >
                All
              </button>
              <button 
                className={`tab-btn ${filter === "PENDING" ? "active" : ""}`} 
                onClick={() => setFilter("PENDING")}
              >
                Pending
              </button>
              <button 
                className={`tab-btn ${filter === "SETTLED" ? "active" : ""}`} 
                onClick={() => setFilter("SETTLED")}
              >
                Settled
              </button>
            </div>
          </div>

          <div className="vendor-list">
            {loading && <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading vendor data...</div>}
            
            {!loading && filteredData.map(vendor => {
              const totalBilled = Number(vendor.total_billed) || 0;
              const paid = Number(vendor.paid) || 0;
              const pending = Number(vendor.pending) || 0;
              const percentPaid = totalBilled > 0 ? Math.min(100, Math.round((paid / totalBilled) * 100)) : 100;

              return (
                <div className="vendor-item" key={vendor.id}>
                  {/* Column 1: Info */}
                  <div>
                    <div className="v-name">{vendor.name}</div>
                    <div className="v-meta">
                      Last Payment Date: {vendor.last_payment ? new Date(vendor.last_payment).toLocaleDateString('en-IN') : 'N/A'}
                    </div>
                  </div>

                  {/* Column 2: Progress */}
                  <div className="progress-container">
                    <div className="progress-labels">
                      <span>Paid: ₹{formatCurrency(paid)}</span>
                      <span>Total: ₹{formatCurrency(totalBilled)}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${percentPaid}%`, background: percentPaid === 100 ? '#10b981' : '#38bdf8' }}></div>
                    </div>
                  </div>

                  {/* Column 3: Action */}
                  <div style={{ textAlign: 'right' }}>
                    {pending > 0 ? (
                      <>
                        <div className="v-pending">Due: ₹{formatCurrency(pending)}</div>
                        <button 
                          className="btn-pay" 
                          onClick={() => handleMarkPaid(vendor.id, vendor.name)}
                          disabled={processingId === vendor.id}
                        >
                          {processingId === vendor.id ? "Processing..." : "✓ Mark as Paid"}
                        </button>
                      </>
                    ) : (
                      <div className="v-settled">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Fully Settled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {!loading && filteredData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '30px', marginBottom: '10px' }}>📦</div>
                <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>No Vendors Found</h3>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {ledgerData.length === 0 ? "You haven't logged any purchase bills yet." : "No vendors match your current filters."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}