import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const PRIORITY_META = {
  High: { text: "#fda4af", glow: "rgba(251, 113, 133, 0.55)", bg: "rgba(251, 113, 133, 0.14)", border: "rgba(251, 113, 133, 0.35)" },
  Medium: { text: "#fdba74", glow: "rgba(251, 146, 60, 0.55)", bg: "rgba(251, 146, 60, 0.14)", border: "rgba(251, 146, 60, 0.35)" },
  Low: { text: "#6ee7b7", glow: "rgba(52, 211, 153, 0.55)", bg: "rgba(52, 211, 153, 0.14)", border: "rgba(52, 211, 153, 0.35)" },
};

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

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
  const dueTodayCount = useMemo(() => reminders.filter(r => isToday(r.scheduled_date)).length, [reminders]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        body {
          background-color: #08050f;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatSlow { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(3%, -5%) scale(1.08); } }
        @keyframes floatSlow2 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4%, 4%) scale(1.05); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; } 70% { box-shadow: 0 0 0 6px transparent; opacity: 0.4; } }
        @keyframes sheen { 0% { transform: translateX(-120%) skewX(-15deg); } 100% { transform: translateX(220%) skewX(-15deg); } }
        @keyframes auroraSlide { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        /* ---- Aurora ribbon + grain texture (ambient premium finish) ---- */
        .aurora-ribbon {
          position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 5; pointer-events: none;
          background: linear-gradient(90deg, #8b5cf6, #22d3ee, #34d399, #fb923c, #fb7185, #8b5cf6);
          background-size: 300% 100%; animation: auroraSlide 12s ease-in-out infinite;
          box-shadow: 0 0 18px rgba(139, 92, 246, 0.55);
        }
        .grain-overlay {
          position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* ---- Animated gradient mesh background ---- */
        .bg-blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(100px); }
        .bg-blob.b1 { top: -160px; left: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(139,92,246,0.38), transparent 70%); animation: floatSlow 16s ease-in-out infinite; }
        .bg-blob.b2 { top: 15%; right: -160px; width: 460px; height: 460px; background: radial-gradient(circle, rgba(34,211,238,0.26), transparent 70%); animation: floatSlow2 19s ease-in-out infinite; }
        .bg-blob.b3 { bottom: -180px; left: 20%; width: 520px; height: 520px; background: radial-gradient(circle, rgba(251,113,133,0.22), transparent 70%); animation: floatSlow 22s ease-in-out infinite reverse; }
        .bg-blob.b4 { bottom: 10%; right: 8%; width: 340px; height: 340px; background: radial-gradient(circle, rgba(251,146,60,0.2), transparent 70%); animation: floatSlow2 14s ease-in-out infinite reverse; }

        .page-container { max-width: 1200px; margin: auto; padding: 40px 20px 70px; animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) both; position: relative; z-index: 1; }

        /* ---- Core glass primitive ---- */
        .glass {
          background: rgba(255, 255, 255, 0.055);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 20px 50px -20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.16);
        }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
        .back-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: white; width: 42px; height: 42px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); flex-shrink: 0; }
        .back-btn:hover { background: rgba(139, 92, 246, 0.22); border-color: #a78bfa; transform: scale(1.08); }
        .logo-mark { width: 42px; height: 42px; border-radius: 13px; background: linear-gradient(135deg, #8b5cf6, #a855f7 45%, #22d3ee); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; box-shadow: 0 10px 26px -8px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.35); flex-shrink: 0; }
        .page-title {
          margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif;
          background: linear-gradient(100deg, #ffffff 22%, #d8b4fe 55%, #67e8f9 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .page-subtitle { margin: 3px 0 0; font-size: 12.5px; color: #94a3b8; font-weight: 500; }

        /* ---- Stat cards (glass, color-tinted) ---- */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }
        @media (max-width: 850px) { .stats-grid { grid-template-columns: 1fr; } }
        .stat-card { border-radius: 20px; padding: 24px; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .stat-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.9; }
        .stat-card.total::before { background: linear-gradient(90deg, #8b5cf6, #c4b5fd); }
        .stat-card.today::before { background: linear-gradient(90deg, #22d3ee, #67e8f9); }
        .stat-card.high::before { background: linear-gradient(90deg, #f43f5e, #fda4af); }
        .stat-card:nth-of-type(1) { animation-delay: 0.02s; }
        .stat-card:nth-of-type(2) { animation-delay: 0.08s; }
        .stat-card:nth-of-type(3) { animation-delay: 0.14s; }
        .stat-card h2 { margin: 0 0 8px 0; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.75); font-weight: 700; }
        .stat-card .amount { font-size: 2.6rem; font-weight: 800; margin: 0; color: white; letter-spacing: -0.02em; font-family: 'Space Grotesk', sans-serif; }
        .stat-icon { position: absolute; right: -6px; bottom: -16px; font-size: 6rem; opacity: 0.14; pointer-events: none; }
        .stat-card.total { border-color: rgba(139,92,246,0.3); box-shadow: 0 20px 50px -20px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.today { border-color: rgba(34,211,238,0.3); box-shadow: 0 20px 50px -20px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card.high { border-color: rgba(251,113,133,0.3); box-shadow: 0 20px 50px -20px rgba(251,113,133,0.25), inset 0 1px 0 rgba(255,255,255,0.16); }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card.total:hover { box-shadow: 0 24px 55px -18px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.today:hover { box-shadow: 0 24px 55px -18px rgba(34,211,238,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }
        .stat-card.high:hover { box-shadow: 0 24px 55px -18px rgba(251,113,133,0.4), inset 0 1px 0 rgba(255,255,255,0.18); }

        /* ---- Main panel ---- */
        .panel { border-radius: 22px; padding: 28px; animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both; }

        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 14px; flex-wrap: wrap; }

        .search-wrap { position: relative; flex: 1; min-width: 240px; display: flex; align-items: center; }
        .search-wrap .search-icon { position: absolute; left: 14px; font-size: 13px; opacity: 0.6; pointer-events: none; }
        .search-input, .modal-input {
          padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14);
          background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); color: white; font-size: 14px;
          outline: none; transition: all 0.25s ease; font-family: inherit; box-sizing: border-box;
        }
        .search-input { width: 100%; padding-left: 38px; }
        .search-input:focus, .modal-input:focus { border-color: #a78bfa; background: rgba(15,23,42,0.65); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.22); }

        .filter-tabs { display: flex; gap: 6px; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); padding: 6px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { background: transparent; border: none; color: #94a3b8; padding: 8px 14px; border-radius: 9px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-family: inherit; }
        .tab-btn.active { background: rgba(139, 92, 246, 0.24); color: #d8b4fe; box-shadow: 0 2px 10px rgba(139,92,246,0.3); }
        .tab-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.06); }
        .tab-btn:focus-visible, .back-btn:focus-visible, .add-btn:focus-visible, .btn-wa:focus-visible, .btn-done:focus-visible, .cancel-btn:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }

        .add-btn {
          background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); background-size: 160% 160%; color: #0c0620; border: none;
          padding: 12px 22px; border-radius: 13px; font-weight: 800; cursor: pointer; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, background-position 0.25s ease;
          display: inline-flex; align-items: center; gap: 8px; font-family: inherit; box-shadow: 0 8px 22px -6px rgba(139, 92, 246, 0.5); font-size: 14px;
          position: relative; overflow: hidden;
        }
        .add-btn::after {
          content: ""; position: absolute; top: 0; left: 0; width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: sheen 3.2s ease-in-out infinite; animation-delay: 1s; pointer-events: none;
        }
        .add-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -6px rgba(139, 92, 246, 0.65); background-position: 100% 0%; color: #0c0620; }
        .add-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .add-btn:disabled::after { display: none; }

        /* ---- Reminder cards (glass) ---- */
        .reminder-list { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .reminder-card {
          background: rgba(255, 255, 255, 0.045);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 22px; border-radius: 17px; display: flex; justify-content: space-between; align-items: center;
          transition: all 0.3s cubic-bezier(0.16,1,0.3,1); gap: 20px; position: relative; overflow: hidden;
          animation: cardIn 0.4s ease both;
        }
        .reminder-card::before { content: ""; position: absolute; top: 0; left: 0; bottom: 0; width: 4px; }
        .reminder-card.priority-High::before { background: linear-gradient(180deg, #fb7185, #f43f5e); box-shadow: 0 0 14px rgba(251,113,133,0.6); }
        .reminder-card.priority-Medium::before { background: linear-gradient(180deg, #fb923c, #f59e0b); box-shadow: 0 0 14px rgba(251,146,60,0.6); }
        .reminder-card.priority-Low::before { background: linear-gradient(180deg, #34d399, #10b981); box-shadow: 0 0 14px rgba(52,211,153,0.6); }
        .reminder-card:hover { background: rgba(255,255,255,0.07); transform: translateY(-3px); border-color: rgba(255,255,255,0.2); }
        .reminder-card.priority-High:hover { box-shadow: 0 18px 40px -16px rgba(251,113,133,0.4); }
        .reminder-card.priority-Medium:hover { box-shadow: 0 18px 40px -16px rgba(251,146,60,0.4); }
        .reminder-card.priority-Low:hover { box-shadow: 0 18px 40px -16px rgba(52,211,153,0.4); }
        @media (max-width: 768px) {
          .reminder-card { flex-direction: column; align-items: flex-start; gap: 15px; }
          .card-actions { width: 100%; display: flex; justify-content: flex-end; }
        }

        .r-client-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .r-avatar { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #a78bfa, #22d3ee); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12.5px; color: #1e0a35; flex-shrink: 0; }
        .r-client { font-size: 1.15rem; font-weight: 800; color: #f8fafc; font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }

        .priority-badge { font-size: 10px; padding: 5px 11px; border-radius: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid; display: inline-flex; align-items: center; gap: 6px; }
        .priority-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulseDot 2s ease-in-out infinite; }

        .r-reason { font-size: 1rem; color: #cbd5e1; margin-bottom: 12px; padding-left: 46px; }
        .r-meta { font-size: 0.85rem; color: #7d8798; display: flex; gap: 18px; flex-wrap: wrap; font-weight: 600; padding-left: 46px; }
        .r-meta span { display: inline-flex; align-items: center; gap: 6px; }

        .card-actions { display: flex; gap: 10px; flex-shrink: 0; }
        .btn-wa {
          background: rgba(52, 211, 153, 0.14); border: 1px solid rgba(52, 211, 153, 0.32); color: #6ee7b7;
          padding: 10px 17px; border-radius: 11px; cursor: pointer; font-weight: 700; transition: all 0.25s ease;
          display: flex; align-items: center; gap: 8px; font-family: inherit; font-size: 13px;
        }
        .btn-wa:hover { background: #34d399; color: #062b1f; transform: translateY(-2px); box-shadow: 0 8px 18px -4px rgba(52,211,153,0.5); }

        .btn-done {
          background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.16); color: #cbd5e1;
          padding: 10px 17px; border-radius: 11px; cursor: pointer; font-weight: 700; transition: all 0.25s ease;
          display: flex; align-items: center; gap: 8px; font-family: inherit; font-size: 13px;
        }
        .btn-done:hover { background: rgba(139,92,246,0.85); border-color: #a78bfa; color: white; transform: translateY(-2px); box-shadow: 0 8px 18px -4px rgba(139,92,246,0.5); }

        /* ---- Loading skeletons ---- */
        .skeleton-card { padding: 22px; border-radius: 17px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .skeleton-bar { height: 13px; border-radius: 6px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 37%, rgba(255,255,255,0.04) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }

        .empty-block { text-align: center; padding: 60px 20px; color: #64748b; animation: fadeIn 0.4s ease both; }
        .empty-block .icon { font-size: 2rem; margin-bottom: 8px; }

        /* ---- Modal (glass) ---- */
        .modal-overlay { position: fixed; inset: 0; background: rgba(4, 5, 8, 0.6); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; animation: overlayIn 0.2s ease both; }
        .modal-box {
          background: rgba(19, 24, 41, 0.75); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(139, 92, 246, 0.28); padding: 34px; border-radius: 22px; max-width: 500px; width: 100%;
          box-shadow: 0 30px 70px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.14); animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }
        .modal-close-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #94a3b8; width: 32px; height: 32px; border-radius: 9px; font-size: 1rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
        .modal-close-btn:hover { background: rgba(251,113,133,0.16); border-color: rgba(251,113,133,0.4); color: #fda4af; }
        .modal-box h3 { margin: 0 0 6px; color: white; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.01em; font-family: 'Space Grotesk', sans-serif; }
        .modal-subtitle { margin: 0 0 24px; font-size: 12.5px; color: #94a3b8; font-weight: 500; }
        .input-label { display: block; font-size: 11px; color: #c4b5fd; margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon .input-icon { position: absolute; left: 14px; font-size: 14px; opacity: 0.85; pointer-events: none; }
        .input-with-icon .modal-input { padding-left: 40px; }

        select.modal-input { cursor: pointer; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 28px; }
        .cancel-btn { background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.12); padding: 12px 22px; border-radius: 11px; cursor: pointer; font-weight: 700; font-family: inherit; transition: background 0.2s; }
        .cancel-btn:hover { background: rgba(255,255,255,0.15); }
        .spinner-sm { width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.25); border-top-color: #0c0620; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div className="aurora-ribbon" />
      <div className="grain-overlay" />
      <div className="bg-blob b1" />
      <div className="bg-blob b2" />
      <div className="bg-blob b3" />
      <div className="bg-blob b4" />

      <div className="page-container">
        <div className="header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <div className="logo-mark">🔔</div>
            <div>
              <h1 className="page-title">Follow-up Tracker</h1>
              <p className="page-subtitle">Every promised call, in one glowing queue — nothing slips through.</p>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="glass stat-card total">
            <h2>Total Pending Tasks</h2>
            <p className="amount">{reminders.length}</p>
            <div className="stat-icon">📋</div>
          </div>
          <div className="glass stat-card today">
            <h2>Due Today</h2>
            <p className="amount">{dueTodayCount}</p>
            <div className="stat-icon">🕒</div>
          </div>
          <div className="glass stat-card high">
            <h2>High Priority Items</h2>
            <p className="amount">{highPriorityCount}</p>
            <div className="stat-icon">🚨</div>
          </div>
        </div>

        <div className="glass panel">
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search tasks by client or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              <button className={`tab-btn ${filterPriority === "ALL" ? "active" : ""}`} onClick={() => setFilterPriority("ALL")}>All Tasks</button>
              <button className={`tab-btn ${filterPriority === "High" ? "active" : ""}`} onClick={() => setFilterPriority("High")}>High</button>
              <button className={`tab-btn ${filterPriority === "Medium" ? "active" : ""}`} onClick={() => setFilterPriority("Medium")}>Medium</button>
              <button className={`tab-btn ${filterPriority === "Low" ? "active" : ""}`} onClick={() => setFilterPriority("Low")}>Low</button>
            </div>
            <button className="add-btn" onClick={() => setShowModal(true)}>
              + Add Reminder
            </button>
          </div>

          <div className="reminder-list">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div className="skeleton-card" key={`sk-${i}`}>
                  <div className="skeleton-bar" style={{ width: "35%", marginBottom: 12 }} />
                  <div className="skeleton-bar" style={{ width: "60%", marginBottom: 12 }} />
                  <div className="skeleton-bar" style={{ width: "40%" }} />
                </div>
              ))}

            {!loading && filteredReminders.map(rem => {
              const meta = PRIORITY_META[rem.priority] || PRIORITY_META.Medium;
              const initials = (rem.client_name || "?").trim().slice(0, 2).toUpperCase();
              const formattedDate = rem.scheduled_date && rem.scheduled_date.includes("-")
                  ? new Date(rem.scheduled_date).toLocaleDateString('en-IN')
                  : rem.scheduled_date;

              return (
                <div className={`reminder-card priority-${rem.priority}`} key={rem.id}>
                  <div>
                    <div className="r-client-row">
                      <div className="r-avatar">{initials}</div>
                      <div className="r-client">{rem.client_name}</div>
                      <span className="priority-badge" style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}>
                        <span className="priority-dot" />
                        {rem.priority}
                      </span>
                    </div>
                    <div className="r-reason">{rem.reason}</div>
                    <div className="r-meta">
                      <span>📞 {rem.contact || 'No Contact'}</span>
                      <span>🗓️ Scheduled: {formattedDate || 'N/A'}</span>
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
              <div className="empty-block">
                <div className="icon">☕</div>
                {reminders.length === 0
                  ? "No follow-ups yet. Add your first reminder to start tracking."
                  : "All caught up! No tasks match your current filters."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD REMINDER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3>New Follow-up Task</h3>
                <p className="modal-subtitle">Log the client, the reason, and when to reach back out.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddReminder}>
              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">Client / Company Name *</label>
                <input required className="modal-input" style={{ width: "100%" }} placeholder="e.g. Apex Industries" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">Contact Number</label>
                <div className="input-with-icon">
                  <span className="input-icon">📱</span>
                  <input type="tel" inputMode="tel" className="modal-input" style={{ width: "100%" }} placeholder="e.g. 9876543210" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label className="input-label">Reason / Task Description *</label>
                <input required className="modal-input" style={{ width: "100%" }} placeholder="e.g. Call regarding pending hardware delivery" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>

              <div className="form-row">
                <div>
                  <label className="input-label">Scheduled Date</label>
                  <input type="date" className="modal-input" style={{ width: "100%", colorScheme: "dark" }} value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Priority Level</label>
                  <select className="modal-input" style={{ width: "100%" }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="High" style={{background: '#0f172a'}}>High Priority</option>
                    <option value="Medium" style={{background: '#0f172a'}}>Medium Priority</option>
                    <option value="Low" style={{background: '#0f172a'}}>Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="add-btn" disabled={isSubmitting}>
                  {isSubmitting ? (<><span className="spinner-sm" /> Saving…</>) : "💾 Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}