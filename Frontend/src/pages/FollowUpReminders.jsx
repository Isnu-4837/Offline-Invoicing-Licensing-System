import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function FollowUpReminders() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Form state for adding a new reminder
  const [formData, setFormData] = useState({
    client_name: "",
    contact: "",
    reason: "",
    scheduled_date: "Today",
    priority: "Medium"
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const res = await api.get("/follow-ups");
      setReminders(res.data);
    } catch (error) {
      console.error("Failed to fetch follow-ups", error);
    }
  };

  const handleAddReminder = async (e) => {
    e.preventDefault();
    if (!formData.client_name || !formData.reason) {
      return alert("Client Name and Reason are required!");
    }

    try {
      await api.post("/follow-ups", formData);
      setShowModal(false);
      setFormData({
        client_name: "",
        contact: "",
        reason: "",
        scheduled_date: "Today",
        priority: "Medium"
      });
      fetchReminders(); // Refresh list
    } catch (error) {
      console.error("Failed to create reminder", error);
      alert("Failed to save follow-up reminder.");
    }
  };

  const markDone = async (id) => {
    try {
      await api.put(`/follow-ups/${id}/done`);
      fetchReminders(); // Refresh list after completion
    } catch (error) {
      console.error("Failed to update reminder status", error);
      alert("Failed to mark reminder as done.");
    }
  };

  return (
    <>
      <style>{`
        body { background: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }
        .page-container { max-width: 1000px; margin: auto; padding: 40px 20px; animation: fadeInUp 0.5s ease; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .panel { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .reminder-list { display: flex; flex-direction: column; gap: 15px; }
        .reminder-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
        .reminder-card:hover { background: rgba(30, 41, 59, 0.8); transform: translateX(5px); }
        
        .reminder-card.priority-High { border-left-color: #ef4444; }
        .reminder-card.priority-Medium { border-left-color: #f59e0b; }
        .reminder-card.priority-Low { border-left-color: #10b981; }

        .r-client { font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; color: #f8fafc; }
        .r-reason { font-size: 0.9rem; color: #94a3b8; margin-bottom: 8px; }
        .r-meta { font-size: 0.8rem; color: #64748b; display: flex; gap: 15px; }
        
        .btn-done { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-done:hover { background: #10b981; color: white; }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal-card { background: #131c31; border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 16px; width: 100%; max-width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .input-label { display: block; font-size: 11px; color: #a78bfa; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; }
        .input-field { width: 100%; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 12px; border-radius: 8px; margin-bottom: 15px; box-sizing: border-box; outline: none; }
        .input-field:focus { border-color: #8b5cf6; }
        .save-btn { width: 100%; background: #8b5cf6; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .save-btn:hover { background: #7c3aed; }
      `}</style>

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Follow-up Reminders</h1>
          </div>
          <button 
            className="back-btn" 
            style={{width: 'auto', padding: '0 20px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa'}}
            onClick={() => setShowModal(true)}
          >
            + Add Reminder
          </button>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Pending Tasks</h3>
          <div className="reminder-list">
            {reminders.map(rem => (
              <div className={`reminder-card priority-${rem.priority}`} key={rem.id}>
                <div>
                  <div className="r-client">{rem.client_name}</div>
                  <div className="r-reason">{rem.reason}</div>
                  <div className="r-meta">
                    <span>📞 {rem.contact || 'No Contact'}</span>
                    <span>🕒 Scheduled: {rem.scheduled_date}</span>
                  </div>
                </div>
                <div>
                  <button className="btn-done" onClick={() => markDone(rem.id)}>✓ Mark Done</button>
                </div>
              </div>
            ))}
            {reminders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                All caught up! No pending follow-ups. 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD REMINDER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#a78bfa' }}>New Follow-up Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleAddReminder}>
              <label className="input-label">Client Name *</label>
              <input className="input-field" placeholder="e.g. Apex Industries" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} />

              <label className="input-label">Contact Number</label>
              <input className="input-field" placeholder="+91 XXXXX XXXXX" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />

              <label className="input-label">Reason / Task *</label>
              <input className="input-field" placeholder="e.g. Payment Collection" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Scheduled For</label>
                  <input className="input-field" placeholder="Today / Tomorrow" value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Priority</label>
                  <select className="input-field" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="save-btn" style={{ marginTop: '10px' }}>💾 Save Task</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}