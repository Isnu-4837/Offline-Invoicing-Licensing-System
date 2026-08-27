import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AutoReminders() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, INVOICE, QUOTATION

  useEffect(() => {
    fetchOverdueDocuments();
  }, []);

  const fetchOverdueDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/invoices");
      const rawData = Array.isArray(res.data) ? res.data : [];

      const overdueList = rawData
        .map((inv) => {
          const docType = String(inv.doc_type || "INVOICE").split(".").pop().toUpperCase();
          const status = String(inv.payment_status || "DUE").split(".").pop().toUpperCase();
          
          const totalAmt = Number(inv.total_amount) || 0;
          const advAmt = Number(inv.advance_paid) || 0;
          
          // Robust calculation for balance
          let remaining = Number(inv.remaining_amount);
          if (isNaN(remaining) || remaining <= 0) {
            remaining = Math.max(0, totalAmt - advAmt);
          }
          if (remaining === 0 && totalAmt > 0 && status !== "PAID") {
            remaining = totalAmt;
          }

          return {
            id: inv.id,
            name: inv.client_name || "Walk-in Customer",
            mobile: inv.client_mobile || "",
            invoice: inv.invoice_number || `DOC-#${inv.id}`,
            due: remaining,
            total: totalAmt,
            dueDate: inv.due_date || inv.next_due_date || inv.emi_start_date || "N/A",
            docType: docType.includes("QUO") ? "QUOTATION" : "INVOICE",
            status: status,
            selected: false,
          };
        })
        // Show ALL items that are NOT paid and have a pending balance
        .filter((item) => {
          const isPaid = item.status === "PAID" || (item.total > 0 && item.due <= 0 && !item.status.includes("INSTALLMENT") && !item.status.includes("DUE"));
          return !isPaid && item.due > 0;
        });

      setClients(overdueList);
    } catch (error) {
      console.error("Failed to fetch documents for reminders", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (e) => {
    setClients(clients.map((c) => ({ ...c, selected: e.target.checked })));
  };

  const toggleClient = (id) => {
    setClients(clients.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  };

  const redirectToWhatsApp = (client) => {
    const cleanPhone = client.mobile ? client.mobile.replace(/[^0-9]/g, "") : "";
    
    if (!cleanPhone) {
      alert(`Notice: ${client.name} does not have a saved phone number on document ${client.invoice}. Please enter it on the next page.`);
    }

    const docTypeLabel = client.docType === "QUOTATION" ? "Quotation" : "Invoice";
    const message = `Dear ${client.name}, this is a gentle reminder from Secure Vision regarding your ${docTypeLabel} (${client.invoice}). There is a pending balance of ₹${client.due.toLocaleString("en-IN")}. Kindly arrange for the payment at your earliest convenience. Thank you!`;

    // 1. Save to LocalStorage as bulletproof fallback for HashRouter
    localStorage.setItem(
      "wa_prefill_data",
      JSON.stringify({ phone: cleanPhone, message: message })
    );

    // 2. Query Params
    const query = new URLSearchParams({
      phone: cleanPhone,
      message: message,
    }).toString();

    // 3. Navigate with both query string and state
    navigate(`/whatsapp-integration?${query}`, {
      state: { phone: cleanPhone, message: message },
    });
  };

  const handleBulkSend = () => {
    const selectedClients = filteredClients.filter((c) => c.selected);
    if (selectedClients.length === 0) {
      return alert("Please select at least one client from the list.");
    }
    if (selectedClients.length > 1) {
      return alert("Please select only ONE client at a time to auto-fill the WhatsApp composer.");
    }
    redirectToWhatsApp(selectedClients[0]);
  };

  // Derived Statistics
  const totalOutstanding = clients.reduce((sum, c) => sum + c.due, 0);
  const invoiceCount = clients.filter(c => c.docType === "INVOICE").length;
  const quotationCount = clients.filter(c => c.docType === "QUOTATION").length;

  // Filter Logic
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.invoice.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "ALL" || c.docType === filterType;
    return matchesSearch && matchesType;
  });

  const selectedCount = filteredClients.filter((c) => c.selected).length;

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1150px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; }
        .stat-icon { position: absolute; right: -10px; bottom: -20px; font-size: 7rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 250px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #d946ef; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(217, 70, 239, 0.15); }
        
        .filter-tabs { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .tab-btn.active { background: rgba(217, 70, 239, 0.2); color: #f5d0fe; }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 14px 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
        .table td { padding: 16px 12px; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .checkbox-custom { width: 18px; height: 18px; accent-color: #d946ef; cursor: pointer; }
        
        .type-badge { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 8px; display: inline-block;}
        .type-inv { background: rgba(167, 139, 250, 0.2); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.3); }
        .type-quo { background: rgba(251, 191, 36, 0.2); color: #fde047; border: 1px solid rgba(251, 191, 36, 0.3); }

        .send-btn { background: linear-gradient(135deg, #d946ef 0%, #a21caf 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; gap: 8px; align-items: center; font-family: inherit;}
        .send-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(217, 70, 239, 0.4); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .action-row-btn { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .action-row-btn:hover { background: #22c55e; color: white; transform: scale(1.05); }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <button className="back-btn" onClick={() => navigate("/")}>←</button>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Due & Installment Reminders</h1>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #d946ef 0%, #be185d 100%)" }}>
            <h2>Total Outstanding Amount</h2>
            <p className="amount">₹{totalOutstanding.toLocaleString("en-IN")}</p>
            <div className="stat-icon">💸</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }}>
            <h2>Pending Invoices</h2>
            <p className="amount">{invoiceCount}</p>
            <div className="stat-icon">📄</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)" }}>
            <h2>Pending Quotations</h2>
            <p className="amount">{quotationCount}</p>
            <div className="stat-icon">📑</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by client name or document number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="filter-tabs">
              <button className={`tab-btn ${filterType === "ALL" ? "active" : ""}`} onClick={() => setFilterType("ALL")}>All Documents</button>
              <button className={`tab-btn ${filterType === "INVOICE" ? "active" : ""}`} onClick={() => setFilterType("INVOICE")}>Invoices Only</button>
              <button className={`tab-btn ${filterType === "QUOTATION" ? "active" : ""}`} onClick={() => setFilterType("QUOTATION")}>Quotations Only</button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0 }}>Pending Accounts Ledger</h3>
            <button className="send-btn" disabled={selectedCount === 0} onClick={handleBulkSend}>
              <span>📨</span> Send via WhatsApp {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    onChange={toggleSelectAll}
                    checked={filteredClients.length > 0 && filteredClients.every((c) => c.selected)}
                  />
                </th>
                <th>Client Name</th>
                <th>Document Details</th>
                <th>Due Date</th>
                <th style={{ textAlign: "right" }}>Pending Balance</th>
                <th style={{ textAlign: "center", width: "120px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading pending documents...</td>
                </tr>
              )}
              {!loading && filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      checked={client.selected}
                      onChange={() => toggleClient(client.id)}
                    />
                  </td>
                  <td>
                    <strong style={{ display: "block", color: "white", fontSize: "1.1rem" }}>{client.name}</strong>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {client.mobile || "No Mobile Number"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`type-badge ${client.docType === "QUOTATION" ? "type-quo" : "type-inv"}`}>
                        {client.docType}
                      </span>
                      <strong style={{ color: client.docType === "QUOTATION" ? "#fbbf24" : "#a78bfa" }}>
                        {client.invoice}
                      </strong>
                    </div>
                  </td>
                  <td style={{ color: "#94a3b8" }}>{client.dueDate}</td>
                  <td style={{ textAlign: "right", fontWeight: "800", color: "#f87171", fontSize: "16px" }}>
                    ₹{client.due.toLocaleString("en-IN")}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="action-row-btn"
                      onClick={() => redirectToWhatsApp(client)}
                      title="Send WhatsApp Reminder"
                    >
                      <span>💬</span> Alert
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredClients.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "50px", color: "#64748b", background: "rgba(15,23,42,0.4)", borderRadius: "12px" }}>
                    <div style={{ fontSize: "30px", marginBottom: "10px" }}>🎉</div>
                    <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>All caught up!</h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {clients.length === 0 ? "No pending dues found. All documents are fully paid." : "No documents match your search or filter criteria."}
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