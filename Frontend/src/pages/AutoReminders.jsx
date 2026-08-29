import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AutoReminders() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, INVOICE, QUOTATION

  // Define your company name variable here
  const COMPANY_NAME = "NextGen TechStack";

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

  const handleDeleteDocument = async (id, invoiceNumber) => {
    if (!window.confirm(`Are you sure you want to permanently delete document ${invoiceNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/invoices/${id}`);
      // Refresh the list after successful deletion
      fetchOverdueDocuments();
    } catch (error) {
      console.error("Failed to delete document", error);
      alert("Failed to delete document. Please try again.");
    }
  };

  const redirectToWhatsApp = (client) => {
    const cleanPhone = client.mobile ? client.mobile.replace(/[^0-9]/g, "") : "";

    if (!cleanPhone) {
      alert(`Notice: ${client.name} does not have a saved phone number on document ${client.invoice}. Please enter it on the next page.`);
    }

    const docTypeLabel = client.docType === "QUOTATION" ? "Quotation" : "Invoice";

    // Uses the dynamic COMPANY_NAME variable
    const message = `Dear ${client.name}, this is a gentle reminder from ${COMPANY_NAME} regarding your ${docTypeLabel} (${client.invoice}). There is a pending balance of ₹${client.due.toLocaleString("en-IN")}. Kindly arrange for the payment at your earliest convenience. Thank you!`;

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
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          background: #08060f;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        h1, h2, h3, .heading-font { font-family: 'Sora', 'Plus Jakarta Sans', sans-serif; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes floatSlow {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(20px, -25px) scale(1.05); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .backdrop-mesh {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          background:
            radial-gradient(circle at 15% 20%, rgba(217, 70, 239, 0.16), transparent 45%),
            radial-gradient(circle at 85% 10%, rgba(139, 92, 246, 0.18), transparent 40%),
            radial-gradient(circle at 50% 90%, rgba(56, 189, 248, 0.10), transparent 45%),
            #08060f;
          pointer-events: none;
        }

        .bg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          animation: floatSlow 14s ease-in-out infinite;
        }

        .grain-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 3px 3px;
          opacity: 0.5;
          mix-blend-mode: overlay;
        }

        .page-container {
          max-width: 1240px;
          margin: auto;
          padding: 40px 24px 80px;
          animation: fadeInUp 0.6s ease;
          position: relative;
          z-index: 2;
        }

        /* --- Glass primitive --- */
        .glass {
          position: relative;
          background: rgba(255, 255, 255, 0.045);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 20px;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }
        .glass::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .back-btn {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.14);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(.2,.9,.3,1.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .back-btn:hover {
          background: rgba(217, 70, 239, 0.18);
          border-color: rgba(217, 70, 239, 0.5);
          transform: scale(1.08) translateY(-1px);
          box-shadow: 0 6px 18px rgba(217, 70, 239, 0.25);
        }

        .page-title {
          margin: 0;
          font-size: clamp(1.4rem, 3vw, 2.1rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 30%, #d8b4fe 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .page-subtitle {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: rgba(226, 232, 240, 0.55);
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 28px;
        }

        .stat-card {
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(.2,.9,.3,1.2), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          border-color: rgba(255,255,255,0.22);
          box-shadow: 0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .stat-card .stat-glow {
          position: absolute;
          top: -40%;
          right: -20%;
          width: 65%;
          height: 140%;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.55;
          pointer-events: none;
        }
        .stat-card h2 {
          margin: 0 0 10px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
        }
        .stat-card .amount {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0;
          color: white;
          letter-spacing: -0.02em;
          position: relative;
          z-index: 1;
        }
        .stat-icon-badge {
          position: absolute;
          right: 20px;
          top: 20px;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .panel {
          padding: 28px;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          gap: 14px;
          flex-wrap: wrap;
        }

        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 240px;
        }
        .search-wrap .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.45;
          pointer-events: none;
          font-size: 14px;
        }

        .search-input {
          width: 100%;
          padding: 13px 16px 13px 40px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 12, 26, 0.5);
          backdrop-filter: blur(8px);
          color: white;
          font-size: 14px;
          outline: none;
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .search-input::placeholder { color: rgba(226,232,240,0.4); }
        .search-input:focus {
          border-color: #d946ef;
          background: rgba(15, 12, 26, 0.75);
          box-shadow: 0 0 0 4px rgba(217, 70, 239, 0.16);
        }

        .filter-tabs {
          display: flex;
          gap: 6px;
          background: rgba(0, 0, 0, 0.22);
          padding: 5px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .tab-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 9px 16px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 12px;
          font-family: inherit;
          white-space: nowrap;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, rgba(217,70,239,0.35), rgba(139,92,246,0.35));
          color: #fdf4ff;
          box-shadow: 0 2px 12px rgba(217, 70, 239, 0.25), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .tab-btn:hover:not(.active) {
          color: white;
          background: rgba(255,255,255,0.06);
        }

        .ledger-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 26px 0 16px 0;
          flex-wrap: wrap;
          gap: 12px;
        }
        .ledger-header h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
        }

        .send-btn {
          background: linear-gradient(135deg, #e879f9 0%, #a21caf 100%);
          color: white;
          border: none;
          padding: 13px 22px;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(.2,.9,.3,1.2);
          display: inline-flex;
          gap: 8px;
          align-items: center;
          font-family: inherit;
          font-size: 13px;
          box-shadow: 0 4px 18px rgba(217, 70, 239, 0.35);
        }
        .send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 26px rgba(217, 70, 239, 0.5);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
          border-radius: 16px;
        }

        .table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 4px;
          min-width: 720px;
        }
        .table th {
          text-align: left;
          padding: 14px 14px;
          font-size: 10.5px;
          color: rgba(226,232,240,0.5);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 700;
          position: sticky;
          top: 0;
          background: rgba(10, 8, 18, 0.4);
          backdrop-filter: blur(6px);
        }
        .table td {
          padding: 16px 14px;
          font-size: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          vertical-align: middle;
          color: #f1f5f9;
        }
        .table tbody tr {
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .table tbody tr:hover {
          background: rgba(255,255,255,0.035);
        }

        .checkbox-custom {
          width: 18px;
          height: 18px;
          accent-color: #e879f9;
          cursor: pointer;
        }

        .type-badge {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-block;
          border: 1px solid transparent;
          backdrop-filter: blur(4px);
        }
        .type-inv {
          background: rgba(167, 139, 250, 0.14);
          color: #c4b5fd;
          border-color: rgba(167, 139, 250, 0.35);
        }
        .type-quo {
          background: rgba(251, 191, 36, 0.14);
          color: #fde047;
          border-color: rgba(251, 191, 36, 0.35);
        }

        .action-cell {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: center;
        }

        .action-row-btn {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.28);
          padding: 9px 15px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          backdrop-filter: blur(4px);
        }
        .action-row-btn:hover {
          background: #22c55e;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
        }

        .action-row-btn.delete-btn {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.28);
          padding: 9px 13px;
        }
        .action-row-btn.delete-btn:hover {
          background: #ef4444;
          color: white;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
        }

        .skeleton-row td {
          padding: 16px 14px;
        }
        .skeleton-bar {
          height: 14px;
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite linear;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #e879f9;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
        }
        .empty-state .emoji { font-size: 3rem; margin-bottom: 14px; }
        .empty-state h3 { margin: 0 0 8px 0; color: white; font-size: 1.3rem; font-weight: 700; }
        .empty-state p { margin: 0; font-size: 14px; color: rgba(226,232,240,0.55); }

        @media (max-width: 860px) {
          .stats-grid { grid-template-columns: 1fr; }
          .panel { padding: 20px; }
        }

        @media (max-width: 640px) {
          .page-container { padding: 24px 14px 60px; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .filter-tabs { justify-content: space-between; }
          .ledger-header { flex-direction: column; align-items: stretch; }
          .send-btn { justify-content: center; }
        }
      `}</style>

      <div className="backdrop-mesh">
        <div className="bg-blob" style={{ top: "-120px", left: "-120px", width: "420px", height: "420px", background: "rgba(217, 70, 239, 0.16)" }} />
        <div className="bg-blob" style={{ bottom: "-140px", right: "-100px", width: "520px", height: "520px", background: "rgba(139, 92, 246, 0.14)", animationDelay: "3s" }} />
        <div className="bg-blob" style={{ top: "40%", left: "60%", width: "300px", height: "300px", background: "rgba(56, 189, 248, 0.10)", animationDelay: "6s" }} />
      </div>
      <div className="grain-overlay" />

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <button className="back-btn" onClick={() => navigate("/")}>←</button>
            <div>
              <h1 className="page-title">Due &amp; Installment Reminders</h1>
              <p className="page-subtitle">Track outstanding balances and nudge clients in one tap</p>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card glass">
            <div className="stat-glow" style={{ background: "#d946ef" }} />
            <div className="stat-icon-badge">💸</div>
            <h2>Total Outstanding</h2>
            <p className="amount">₹{totalOutstanding.toLocaleString("en-IN")}</p>
          </div>
          <div className="stat-card glass">
            <div className="stat-glow" style={{ background: "#8b5cf6" }} />
            <div className="stat-icon-badge">📄</div>
            <h2>Pending Invoices</h2>
            <p className="amount">{invoiceCount}</p>
          </div>
          <div className="stat-card glass">
            <div className="stat-glow" style={{ background: "#f59e0b" }} />
            <div className="stat-icon-badge">📑</div>
            <h2>Pending Quotations</h2>
            <p className="amount">{quotationCount}</p>
          </div>
        </div>

        <div className="panel glass">
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search by client name or document number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              <button className={`tab-btn ${filterType === "ALL" ? "active" : ""}`} onClick={() => setFilterType("ALL")}>All Documents</button>
              <button className={`tab-btn ${filterType === "INVOICE" ? "active" : ""}`} onClick={() => setFilterType("INVOICE")}>Invoices Only</button>
              <button className={`tab-btn ${filterType === "QUOTATION" ? "active" : ""}`} onClick={() => setFilterType("QUOTATION")}>Quotations Only</button>
            </div>
          </div>

          <div className="ledger-header">
            <h3>Pending Accounts Ledger</h3>
            <button className="send-btn" disabled={selectedCount === 0} onClick={handleBulkSend}>
              <span>📨</span> Send via WhatsApp {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>

          <div className="table-scroll">
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
                  <th style={{ textAlign: "center", width: "160px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="skeleton-row">
                      <td><div className="skeleton-bar" style={{ width: "18px", height: "18px" }} /></td>
                      <td><div className="skeleton-bar" style={{ width: "70%" }} /></td>
                      <td><div className="skeleton-bar" style={{ width: "55%" }} /></td>
                      <td><div className="skeleton-bar" style={{ width: "60%" }} /></td>
                      <td><div className="skeleton-bar" style={{ width: "50%", marginLeft: "auto" }} /></td>
                      <td><div className="skeleton-bar" style={{ width: "70%", margin: "0 auto" }} /></td>
                    </tr>
                  ))
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
                      <strong style={{ display: "block", color: "white", fontSize: "1.1rem", marginBottom: "5px" }}>{client.name}</strong>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {client.mobile || "No Mobile Number"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className={`type-badge ${client.docType === "QUOTATION" ? "type-quo" : "type-inv"}`}>
                          {client.docType}
                        </span>
                        <strong style={{ color: client.docType === "QUOTATION" ? "#fbbf24" : "#a78bfa", fontSize: "1.02rem" }}>
                          {client.invoice}
                        </strong>
                      </div>
                    </td>
                    <td style={{ color: "#cbd5e1" }}>{client.dueDate}</td>
                    <td style={{ textAlign: "right", fontWeight: "800", color: "#f87171", fontSize: "1.1rem" }}>
                      ₹{client.due.toLocaleString("en-IN")}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="action-cell">
                        <button
                          className="action-row-btn"
                          onClick={() => redirectToWhatsApp(client)}
                          title="Send WhatsApp Reminder"
                        >
                          <span>💬</span> Alert
                        </button>
                        <button
                          className="action-row-btn delete-btn"
                          onClick={() => handleDeleteDocument(client.id, client.invoice)}
                          title="Delete Document"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredClients.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <div className="emoji">🎉</div>
                        <h3>All caught up!</h3>
                        <p>
                          {clients.length === 0 ? "No pending dues found. All documents are fully paid." : "No documents match your search or filter criteria."}
                        </p>
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