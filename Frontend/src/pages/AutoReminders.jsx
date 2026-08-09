import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AutoReminders() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetchOverdueInvoices();
  }, []);

  const fetchOverdueInvoices = async () => {
    try {
      const res = await api.get("/invoices");
      // Filter invoices that have a remaining due amount greater than 0
      const overdueList = res.data
        .filter(inv => inv.remaining_amount > 0 && inv.doc_type === "INVOICE")
        .map(inv => ({
          id: inv.id,
          name: inv.client_name,
          mobile: inv.client_mobile || "",
          invoice: inv.invoice_number,
          due: inv.remaining_amount,
          dueDate: inv.due_date || inv.next_due_date || "N/A",
          selected: false
        }));
      setClients(overdueList);
    } catch (error) {
      console.error("Failed to fetch invoices for reminders", error);
    }
  };

  const toggleSelectAll = (e) => {
    setClients(clients.map(c => ({ ...c, selected: e.target.checked })));
  };

  const toggleClient = (id) => {
    setClients(clients.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const handleBulkSend = () => {
    const selectedClients = clients.filter(c => c.selected);
    if (selectedClients.length === 0) return alert("Please select at least one client.");
    
    // Loop through selected clients and open WhatsApp Web for each with a reminder message
    selectedClients.forEach((client, index) => {
      const cleanPhone = client.mobile ? client.mobile.replace(/[^0-9]/g, "") : "";
      const message = encodeURIComponent(`Dear ${client.name}, this is a friendly reminder from Secure Vision that your invoice ${client.invoice} has a pending balance of ₹${client.due.toLocaleString('en-IN')}. Please clear your dues at your earliest convenience. Thank you!`);
      
      // Stagger window openings slightly if multiple are selected to prevent browser popup block
      setTimeout(() => {
        if (cleanPhone) {
          window.open(`https://wa.me/${cleanPhone}?text=${message}`, `_blank_${client.id}`);
        } else {
          alert(`Client ${client.name} does not have a mobile number saved on invoice ${client.invoice}.`);
        }
      }, index * 400);
    });

    alert(`Successfully triggered reminders for ${selectedClients.length} clients!`);
    setClients(clients.map(c => ({ ...c, selected: false })));
  };

  const selectedCount = clients.filter(c => c.selected).length;

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1000px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .summary-card { background: linear-gradient(135deg, #d946ef 0%, #be185d 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(217, 70, 239, 0.2); display: flex; justify-content: space-between; align-items: center; }
        .summary-card h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.9); }
        .summary-card .amount { font-size: 3rem; font-weight: 800; margin: 5px 0 0 0; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .table th { text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; }
        .table td { padding: 16px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .table tr:hover { background: rgba(255,255,255,0.02); }
        
        .checkbox-custom { width: 18px; height: 18px; accent-color: #d946ef; cursor: pointer; }
        
        .send-btn { background: linear-gradient(135deg, #d946ef 0%, #a21caf 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; gap: 8px; align-items: center; }
        .send-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(217, 70, 239, 0.4); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Auto-Reminders</h1>
          </div>
        </div>

        <div className="summary-card">
          <div>
            <h2>Total Clients with Overdue Payments</h2>
            <p className="amount">{clients.length}</p>
          </div>
          <div style={{ fontSize: '4rem', opacity: 0.5 }}>🤖</div>
        </div>

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Bulk Payment Reminders</h3>
            <button 
              className="send-btn" 
              disabled={selectedCount === 0} 
              onClick={handleBulkSend}
            >
              <span>📨</span> Send {selectedCount > 0 ? selectedCount : ""} Reminders via WhatsApp
            </button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    className="checkbox-custom" 
                    onChange={toggleSelectAll} 
                    checked={clients.length > 0 && clients.every(c => c.selected)} 
                  />
                </th>
                <th>Client Name</th>
                <th>Invoice No.</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Pending Amount</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} onClick={() => toggleClient(client.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <input 
                      type="checkbox" 
                      className="checkbox-custom" 
                      checked={client.selected} 
                      onChange={() => {}} 
                    />
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{client.name}</td>
                  <td style={{ color: '#a78bfa' }}>{client.invoice}</td>
                  <td style={{ color: '#94a3b8' }}>{client.dueDate}</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: '#f87171' }}>
                    ₹{client.due.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No pending dues found! All invoices are paid. 🎉</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}