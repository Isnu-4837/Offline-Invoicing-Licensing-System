import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MSG_CACHE_KEY = "whatsapp_default_message";

export default function WhatsAppIntegration() {
  const navigate = useNavigate();

  // Initialize form data, fetching the message from cache if it exists
  const [formData, setFormData] = useState({
    phoneNumber: "",
    message: localStorage.getItem(MSG_CACHE_KEY) || "Dear Client, please find your attached invoice from Secure Vision. Thank you for your business!",
    file: null
  });

  // Dummy log data
  const [logs, setLogs] = useState([
    { id: 1, date: "2026-08-01 10:30 AM", client: "Apex Industries", number: "+91 9876543210", status: "Sent" },
    { id: 2, date: "2026-07-29 02:15 PM", client: "BlueRidge Retail", number: "+91 8765432109", status: "Delivered" },
    { id: 3, date: "2026-07-28 11:00 AM", client: "Unknown", number: "+91 7654321098", status: "Failed" },
  ]);

  // Auto-cache the message whenever it changes
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setFormData({ ...formData, message: newMessage });
    localStorage.setItem(MSG_CACHE_KEY, newMessage);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!formData.phoneNumber) return alert("Phone number is required!");
    
    if (formData.file) {
      alert("Note: WhatsApp security prevents auto-attaching files via web links. Please manually attach the PDF once WhatsApp opens!");
    }

    // Clean the phone number by removing any non-numeric characters
    const cleanNumber = formData.phoneNumber.replace(/[^0-9]/g, "");
    
    // Encode the message text so it formats correctly in the URL
    const encodedMessage = encodeURIComponent(formData.message);
    
    // Construct the official WhatsApp URL
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, "_blank");
    
    const newLog = {
      id: Date.now(),
      date: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      client: "New Client",
      number: formData.phoneNumber,
      status: "Sending..."
    };
    
    setLogs([newLog, ...logs]);
    setTimeout(() => {
      setLogs(current => current.map(log => log.id === newLog.id ? { ...log, status: "Sent" } : log));
    }, 1500);

    // Reset only phone and file, keeping the cached message intact
    setFormData({ ...formData, phoneNumber: "", file: null });
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

        .grid-layout { display: grid; grid-template-columns: 400px 1fr; gap: 30px; align-items: start; }
        .card { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .input-label { display: block; font-size: 11px; color: #22c55e; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .input-field { width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; outline: none; transition: 0.2s; font-family: inherit; }
        .input-field:focus { border-color: #22c55e; background: rgba(30, 41, 59, 1); }
        
        .send-btn { width: 100%; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; padding: 14px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; gap: 8px; align-items: center; }
        .send-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(34, 197, 94, 0.4); }

        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th { text-align: left; padding: 12px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .table td { padding: 15px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
        .status-sent { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        .status-failed { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>WhatsApp Integration</h1>
          </div>
        </div>

        <div className="grid-layout">
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#22c55e' }}>Direct Message</h3>
            <form onSubmit={handleSend}>
              <label className="input-label">Client Phone Number</label>
              <input className="input-field" placeholder="e.g. 919876543210" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />

              <label className="input-label">Message Body</label>
              <textarea 
                className="input-field" 
                rows="4" 
                value={formData.message} 
                onChange={handleMessageChange} 
              />

              <label className="input-label">Generated PDF (Manual Upload Required)</label>
              <input type="file" accept="application/pdf" className="input-field" style={{ padding: '9px' }} onChange={e => setFormData({...formData, file: e.target.files[0]})} />
              <p style={{fontSize: '11px', color: '#94a3b8', marginTop: '-15px', marginBottom: '20px'}}>Due to security restrictions, you must attach the PDF manually after WhatsApp opens.</p>

              <button type="submit" className="send-btn">
                <span>💬</span> Open in WhatsApp
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Recent Message Logs</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Client / Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ color: '#94a3b8' }}>{log.date}</td>
                    <td>
                      <strong>{log.client}</strong><br/>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{log.number}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${log.status === 'Failed' ? 'status-failed' : log.status === 'Sending...' ? 'status-pending' : 'status-sent'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}