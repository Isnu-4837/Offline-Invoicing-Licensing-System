import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function FollowUpReminders() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL"); // ALL, High, Medium, Low

  const [formData, setFormData] = useState({
    client_name: "",
    contact: "",
    reason: "",
    scheduled_date: new Date().toISOString().split("T")[0],
    priority: "Medium"
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/follow-ups");
      setReminders(res.data || []);
    } catch (error) {
      console.error("Failed to fetch follow-ups", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = async (e) => {
    e.preventDefault();
    if (!formData.client_name || !formData.reason) {
      return alert("Client Name and Reason are required!");
    }

    setIsSubmitting(true);
    try {
      await api.post("/follow-ups", formData);
      setShowModal(false);
      setFormData({
        client_name: "",
        contact: "",
        reason: "",
        scheduled_date: new Date().toISOString().split("T")[0],
        priority: "Medium"
      });
      await fetchReminders();
    } catch (error) {
      console.error("Failed to create reminder", error);
      alert("Failed to save follow-up reminder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const markDone = async (id, name) => {
    if (!window.confirm(`Are you sure you want to mark ${name}'s follow-up as complete?`)) return;
    
    try {
      await api.put(`/follow-ups/${id}/done`);
      await fetchReminders(); 
    } catch (error) {
      console.error("Failed to update reminder status", error);
      alert("Failed to mark reminder as done.");
    }
  };

  const handleWhatsAppAction = (rem) => {
    const cleanPhone = rem.contact ? rem.contact.replace(/[^0-9]/g, "") : "";
    
    if (!cleanPhone) {
      alert(`No valid contact number found for ${rem.client_name}.`);
    }

    const message = `Hello ${rem.client_name}, this is a follow-up from Secure Vision regarding: ${rem.reason}. Please let us know a convenient time to connect.`;
    
    const searchParams = new URLSearchParams({
      phone: cleanPhone,
      message: message
    }).toString();

    navigate(`/whatsapp-integration?${searchParams}`);
  };

  const filteredReminders = reminders.filter(rem => {
    const matchesSearch = rem.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rem.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === "ALL" || rem.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const highPriorityCount = reminders.filter(r => r.priority === "High").length;

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1100px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .stat-card h2 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); }
        .stat-card .amount { font-size: 2.5rem; font-weight: 800; margin: 0; color: white; }
        .stat-icon { position: absolute; right: -10px; bottom: -20px; font-size: 7rem; opacity: 0.15; }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 15px; flex-wrap: wrap; }
        .search-input { flex: 1; min-width: 250px; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.7); color: white; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
        .search-input:focus { border-color: #8b5cf6; background: rgba(30, 41, 59, 1); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.15); }
        
        .filter-tabs { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .tab-btn.active { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .btn-add { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
        .btn-add:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4); }

        .reminder-list { display: grid; grid-template-columns: 1fr; gap: 15px; }
        .reminder-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-left: 5px solid #8b5cf6; padding: 22px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; gap: 20px;}
        .reminder-card:hover { background: rgba(30, 41, 59, 0.8); transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        @media (max-width: 768px) { .reminder-card { flex-direction: column; align-items: flex-start; gap: 15px; } .card-actions { width: 100%; display: flex; justify-content: flex-end; } }
        
        .reminder-card.priority-High { border-left-color: #ef4444; }
        .reminder-card.priority-Medium { border-left-color: #f59e0b; }
        .reminder-card.priority-Low { border-left-color: #10b981; }

        .r-client { font-size: 1.25rem; font-weight: 800; margin-bottom: 6px; color: #f8fafc; display: flex; align-items: center; gap: 10px;}
        .priority-badge { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .bg-high { background: rgba(239,68,68,0.2); color: #fca5a5; }
        .bg-medium { background: rgba(245,158,11,0.2); color: #fcd34d; }
        .bg-low { background: rgba(16,185,129,0.2); color: #6ee7b7; }

        .r-reason { font-size: 1rem; color: #cbd5e1; margin-bottom: 12px; }
        .r-meta { font-size: 0.85rem; color: #64748b; display: flex; gap: 20px; flex-wrap: wrap; font-weight: 500; }
        
        .card-actions { display: flex; gap: 10px; }
        .btn-wa { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .btn-wa:hover { background: #22c55e; color: white; transform: translateY(-1px); }

        .btn-done { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px;}
        .btn-done:hover { background: #10b981; border-color: #10b981; color: white; transform: translateY(-1px); }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(9, 13, 22, 0.85); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeInUp 0.2s ease out; }
        .modal-card { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .input-label { display: block; font-size: 11px; color: #a78bfa; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .input-field { width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 14px; border-radius: 10px; margin-bottom: 18px; box-sizing: border-box; outline: none; font-size: 14px; font-family: inherit; transition: 0.2s; }
        .input-field:focus { border-color: #8b5cf6; background: rgba(15, 23, 42, 0.9); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.15); }
        .save-btn { width: 100%; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border: none; padding: 14px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 15px; margin-top: 10px; }
        .save-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4); }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Follow-up Tracker</h1>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}>
            <h2>Total Pending Tasks</h2>
            <p className="amount">{reminders.length}</p>
            <div className="stat-icon">📋</div>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
            <h2>High Priority Items</h2>
            <p className="amount">{highPriorityCount}</p>
            <div className="stat-icon">🚨</div>
          </div>
        </div>

        <div className="panel">
          <div className="toolbar">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search tasks by client or reason..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="filter-tabs">
              <button className={`tab-btn ${filterPriority === "ALL" ? "active" : ""}`} onClick={() => setFilterPriority("ALL")}>All Tasks</button>
              <button className={`tab-btn ${filterPriority === "High" ? "active" : ""}`} onClick={() => setFilterPriority("High")}>High</button>
              <button className={`tab-btn ${filterPriority === "Medium" ? "active" : ""}`} onClick={() => setFilterPriority("Medium")}>Medium</button>
              <button className={`tab-btn ${filterPriority === "Low" ? "active" : ""}`} onClick={() => setFilterPriority("Low")}>Low</button>
            </div>
            <button className="btn-add" onClick={() => setShowModal(true)}>
              + Add Reminder
            </button>
          </div>

          <div className="reminder-list">
            {loading && <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading follow-ups...</div>}
            
            {!loading && filteredReminders.map(rem => {
              const bgClass = rem.priority === "High" ? "bg-high" : rem.priority === "Medium" ? "bg-medium" : "bg-low";
              const formattedDate = rem.scheduled_date && rem.scheduled_date.includes("-") 
                  ? new Date(rem.scheduled_date).toLocaleDateString('en-IN') 
                  : rem.scheduled_date;

              return (
                <div className={`reminder-card priority-${rem.priority}`} key={rem.id}>
                  <div>
                    <div className="r-client">
                      {rem.client_name}
                      <span className={`priority-badge ${bgClass}`}>{rem.priority}</span>
                    </div>
                    <div className="r-reason">{rem.reason}</div>
                    <div className="r-meta">
                      <span>📞 {rem.contact || 'No Contact'}</span>
                      <span>🕒 Scheduled: {formattedDate || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="btn-wa" onClick={() => handleWhatsAppAction(rem)} title="Message Client">
                      💬 Message
                    </button>
                    <button className="btn-done" onClick={() => markDone(rem.id, rem.client_name)} title="Mark Complete">
                      ✓ Done
                    </button>
                  </div>
                </div>
              );
            })}
            
            {!loading && filteredReminders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '30px', marginBottom: '10px' }}>☕</div>
                <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>All caught up!</h3>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {reminders.length === 0 ? "You have no pending follow-up tasks." : "No tasks match your current filters."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD REMINDER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.4rem' }}>New Follow-up Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer', transition: '0.2s' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddReminder}>
              <label className="input-label">Client / Company Name *</label>
              <input required className="input-field" placeholder="e.g. Apex Industries" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} />

              <label className="input-label">Contact Number</label>
              <input className="input-field" placeholder="e.g. 9876543210" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />

              <label className="input-label">Reason / Task Description *</label>
              <input required className="input-field" placeholder="e.g. Call regarding pending hardware delivery" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label className="input-label">Scheduled Date</label>
                  <input type="date" className="input-field" value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Priority Level</label>
                  <select className="input-field" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="High" style={{background: '#0f172a'}}>High Priority</option>
                    <option value="Medium" style={{background: '#0f172a'}}>Medium Priority</option>
                    <option value="Low" style={{background: '#0f172a'}}>Low Priority</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="save-btn" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "💾 Save Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}