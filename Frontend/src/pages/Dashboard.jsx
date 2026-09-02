import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../api/axios";

const COMPANY_NAME = "NextGen TechStack";
const REPORT_TITLES = {
  ALL: "Master Ledger Report",
  DUES: "Pending Dues Report",
};

// --- Smooth ease-out count-up used for the KPI numbers ---
function useCountUp(target, duration = 1200, trigger = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!trigger) return undefined;
    const safeTarget = Number(target) || 0;
    let start = null;

    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setValue(safeTarget * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(safeTarget);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, trigger]);

  return value;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_sales: 0,
    total_collected: 0,
    total_due: 0,
    total_invoices: 0
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [exportingType, setExportingType] = useState(null); // null | "ALL" | "DUES"
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchStats();
  }, []);

  // Live ticking clock for the futuristic status strip
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      if (res.data) {
        // Robust calculation guard: Re-aggregate dynamically from /invoices if dashboard totals are mismatched or missing
        const invRes = await api.get("/invoices");
        const invoices = Array.isArray(invRes.data) ? invRes.data : [];
        
        let computedSales = 0;
        let computedCollected = 0;
        let computedDue = 0;
        let validInvoicesCount = 0;

        invoices.forEach(inv => {
          const docType = String(inv.doc_type || "").split('.').pop().toUpperCase();
          if (docType === "QUOTATION") return; // Exclude quotations from financial sales totals

          validInvoicesCount++;
          const tAmount = Number(inv.total_amount) || 0;
          const advPaid = Number(inv.advance_paid) || 0;
          const status = String(inv.payment_status || "").split('.').pop().toUpperCase();

          let remAmount = Number(inv.remaining_amount);
          if (isNaN(remAmount) || remAmount < 0) {
            remAmount = Math.max(0, tAmount - advPaid);
          }

          let collected = 0;
          if (status === "PAID" || tAmount === 0) {
            collected = tAmount;
            remAmount = 0;
          } else {
            collected = advPaid;
          }

          computedSales += tAmount;
          computedCollected += collected;
          computedDue += remAmount;
        });

        setStats({
          total_sales: computedSales > 0 ? computedSales : (res.data.total_sales || 0),
          total_collected: computedCollected > 0 ? computedCollected : (res.data.total_collected || 0),
          total_due: computedDue,
          total_invoices: validInvoicesCount > 0 ? validInvoicesCount : (res.data.total_invoices || 0)
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
    } finally {
      setStatsLoaded(true);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate('/invoice', { state: { searchQuery } });
    }
  };

  const handleComingSoon = (featureName) => {
    alert(`🚀 ${featureName} is currently in development and will be available in the next update!`);
  };

  // --- Report Generation Logic (PDF) ---
  const handleDownloadReport = async (reportType) => {
    setExportingType(reportType);
    try {
      const res = await api.get("/invoices");
      let data = Array.isArray(res.data) ? res.data : [];

      if (reportType === "DUES") {
        data = data.filter(inv => {
          const status = String(inv.payment_status || "").split('.').pop().toUpperCase();
          const docType = String(inv.doc_type || "").split('.').pop().toUpperCase();
          const rem = Number(inv.remaining_amount) || 0;
          return docType !== "QUOTATION" && status !== "PAID" && rem > 0;
        });
      }

      if (!data || data.length === 0) {
        alert("No records found to generate this report.");
        return;
      }

      // Sort newest first so the report reads chronologically
      const sortedData = [...data].sort((a, b) => {
        const da = new Date(a.invoice_date || a.created_at || 0);
        const db = new Date(b.invoice_date || b.created_at || 0);
        return db - da;
      });

      // Summary totals for the report header
      const summary = sortedData.reduce(
        (acc, inv) => {
          const total = Number(inv.total_amount) || 0;
          const advance = Number(inv.advance_paid) || 0;
          const status = String(inv.payment_status || "").split(".").pop().toUpperCase();
          let remaining = Number(inv.remaining_amount);
          if (isNaN(remaining) || remaining < 0) remaining = Math.max(0, total - advance);
          const collected = status === "PAID" ? total : total - remaining;

          acc.totalAmount += total;
          acc.totalCollected += collected;
          acc.totalDue += remaining;
          return acc;
        },
        { totalAmount: 0, totalCollected: 0, totalDue: 0 }
      );

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const reportLabel = REPORT_TITLES[reportType] || "Invoice Report";
      const generatedOn = new Date().toLocaleString("en-IN");

      // --- Header ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text(COMPANY_NAME, 14, 18);

      doc.setFontSize(13);
      doc.setTextColor(60, 60, 60);
      doc.text(reportLabel, 14, 26);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated on ${generatedOn}`, 14, 32);
      doc.text(`Total records: ${sortedData.length}`, pageWidth - 14, 32, { align: "right" });

      doc.setDrawColor(230, 230, 230);
      doc.line(14, 36, pageWidth - 14, 36);

      // --- Summary strip ---
      autoTable(doc, {
        startY: 42,
        head: [["Total Billed", "Amount Collected", "Pending Dues", "Total Records"]],
        body: [[
          `Rs. ${formatCurrency(summary.totalAmount)}`,
          `Rs. ${formatCurrency(summary.totalCollected)}`,
          `Rs. ${formatCurrency(summary.totalDue)}`,
          `${sortedData.length}`,
        ]],
        theme: "grid",
        styles: { halign: "center", fontStyle: "bold", fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [251, 191, 36], textColor: [28, 19, 0], fontSize: 9 },
        bodyStyles: { textColor: [30, 30, 30] },
        margin: { left: 14, right: 14 },
      });

      // --- Detailed ledger table ---
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [["Date", "Invoice #", "Client Name", "Contact", "Grand Total", "Advance Paid", "Balance Due", "Status", "Type"]],
        body: sortedData.map((inv) => {
          const dateStr = inv.invoice_date || inv.created_at || "";
          const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString("en-IN") : "N/A";
          const total = Number(inv.total_amount) || 0;
          const advance = Number(inv.advance_paid) || 0;
          let remaining = Number(inv.remaining_amount);
          if (isNaN(remaining) || remaining < 0) remaining = Math.max(0, total - advance);

          return [
            formattedDate,
            inv.invoice_number || "N/A",
            inv.client_name || "Walk-in Customer",
            inv.client_mobile || "N/A",
            `Rs. ${formatCurrency(total)}`,
            `Rs. ${formatCurrency(advance)}`,
            `Rs. ${formatCurrency(remaining)}`,
            String(inv.payment_status || "DUE").split(".").pop(),
            String(inv.doc_type || "INVOICE").split(".").pop(),
          ];
        }),
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 3.5 },
        headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 8.5 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 7) {
            const val = String(hookData.cell.raw).toUpperCase();
            if (val === "PAID") hookData.cell.styles.textColor = [16, 128, 78];
            else if (val === "PARTIAL") hookData.cell.styles.textColor = [180, 130, 0];
            else hookData.cell.styles.textColor = [190, 40, 40];
          }
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `${COMPANY_NAME} · ${reportLabel} · Page ${pageCurrent} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: "center" }
          );
        },
      });

      doc.save(`NextGen_${reportType}_Report_${new Date().toISOString().split("T")[0]}.pdf`);
      setShowReportModal(false);

    } catch (error) {
      console.error("Failed to generate report", error);
      alert("Failed to generate the PDF report. Please check your connection.");
    } finally {
      setExportingType(null);
    }
  };

  const upcomingModules = [
    { icon: "🧾", title: "Purchase Invoices", desc: "Log bills from suppliers (buying raw materials, cameras, wire).", path: "/purchase-invoices" },
    { icon: "📒", title: "Vendor Ledger", desc: "Track money owed to suppliers vs. amounts already paid.", path: "/vendor-ledger" },
    { icon: "🛠️", title: "AMC Tracking", desc: "Alerts when a client's 1-year service warranty is about to expire.", path: "/amc-tracking" },
    { icon: "📞", title: "Follow-up Reminders", desc: "A daily alert showing which clients need a callback today.", path: "/follow-up-reminders" },
    { icon: "📉", title: "Low Stock Alerts", desc: "Flashing dashboard alerts for items below defined minimum limits.", path: "/low-stock-alerts" },
    { icon: "📋", title: "Stock History", desc: "A ledger for each product showing when it was added, sold, or adjusted.", path: "/stock-history" },
    { icon: "💬", title: "WhatsApp Integration", desc: "Instantly send generated PDF Invoices to client WhatsApp numbers.", path: "/whatsapp-integration" },
    { icon: "🤖", title: "Auto-Reminders", desc: "One-click bulk SMS/WhatsApp messages for clients with pending dues.", path: "/auto-reminders" },
    { icon: "📊", title: "Sales Reports", desc: "Comprehensive yearly, monthly, and weekly sales metrics and CSV exports.", path: "/reports" }
  ];

  // --- Animated KPI values ---
  const animatedSales = useCountUp(stats.total_sales, 1400, statsLoaded);
  const animatedCollected = useCountUp(stats.total_collected, 1400, statsLoaded);
  const animatedDue = useCountUp(stats.total_due, 1400, statsLoaded);
  const animatedInvoices = useCountUp(stats.total_invoices, 1400, statsLoaded);

  const collectedPct = stats.total_sales > 0
    ? Math.min(100, Math.round((stats.total_collected / stats.total_sales) * 100))
    : 0;

  // --- 3D tilt + cursor spotlight for glass cards ---
  const handleTilt = useCallback((e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (py - 0.5) * -10;
    card.style.setProperty("--rx", `${rotateX}deg`);
    card.style.setProperty("--ry", `${rotateY}deg`);
    card.style.setProperty("--mx", `${px * 100}%`);
    card.style.setProperty("--my", `${py * 100}%`);
  }, []);

  const resetTilt = useCallback((e) => {
    const card = e.currentTarget;
    card.style.setProperty("--rx", `0deg`);
    card.style.setProperty("--ry", `0deg`);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap');

        :root {
          --amber: #fbbf24;
          --emerald: #34d399;
          --rose: #fb7185;
          --sky: #38bdf8;
          --violet: #a78bfa;
          --cyan: #22d3ee;
          --ink: #05060a;
          --panel: rgba(255, 255, 255, 0.035);
          --panel-strong: rgba(255, 255, 255, 0.055);
          --panel-border: rgba(255, 255, 255, 0.08);
        }

        * { box-sizing: border-box; }

       body { 
  background-color: var(--ink);
  /* background-image and background-size removed */
  font-family: 'Plus Jakarta Sans', sans-serif; 
  color: #f1f5f9; 
  margin: 0; 
  min-height: 100vh;
}

        .mono { font-family: 'JetBrains Mono', monospace; }
        .heading-font { font-family: 'Sora', 'Plus Jakarta Sans', sans-serif; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes softPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.25); }
          50% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes dotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
          50% { box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); }
        }

        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(24px, -18px); }
        }

        @keyframes gradientSweep {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes scanSweep {
          0% { transform: translateY(-10%); opacity: 0; }
          8% { opacity: 0.5; }
          92% { opacity: 0.5; }
          100% { transform: translateY(110vh); opacity: 0; }
        }

        @keyframes ringSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes borderGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        .report-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* --- Futuristic backdrop layers --- */
        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
          animation: drift 14s ease-in-out infinite;
        }

        .scan-line {
          position: fixed;
          left: 0;
          right: 0;
          height: 140px;
          background: linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.06), transparent);
          pointer-events: none;
          z-index: 0;
          animation: scanSweep 9s linear infinite;
        }

        .vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%);
        }

        .dashboard-container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 40px 20px;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          position: relative;
          z-index: 1;
        }

        /* Status strip */
        .status-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          padding: 14px 20px;
          background: var(--panel);
          backdrop-filter: blur(14px);
          border: 1px solid var(--panel-border);
          border-radius: 14px;
          animation: fadeIn 0.6s ease both;
        }

        .status-strip-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-mark {
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Sora', sans-serif;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(34,211,238,0.14));
          border: 1px solid rgba(255,255,255,0.12);
          color: #fef3c7;
          flex-shrink: 0;
        }

        .brand-mark::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 14px;
          padding: 1px;
          background: conic-gradient(from 0deg, var(--amber), var(--cyan), var(--violet), var(--amber));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: ringSpin 5s linear infinite;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--emerald);
          animation: dotPulse 2s ease-in-out infinite;
        }

        .status-text {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #8b95a5;
        }

        .status-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 4px 0 0 0;
          background: linear-gradient(90deg, #ffffff 0%, var(--amber) 45%, #22d3ee 75%, #ffffff 100%);
          background-size: 260% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientSweep 8s linear infinite;
        }

        .status-strip-right {
          font-size: 11px;
          color: #64748b;
          text-align: right;
          letter-spacing: 0.4px;
        }
        .status-strip-right .clock {
          display: block;
          font-size: 16px;
          color: #e2e8f0;
          font-weight: 600;
          margin-top: 4px;
          letter-spacing: 1px;
        }

        /* --- Shared glass-card tilt + spotlight mechanics --- */
        .tilt-card {
          transform-style: preserve-3d;
          perspective: 900px;
        }

        .card-spotlight {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(480px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.10), transparent 45%);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        .tilt-card:hover .card-spotlight { opacity: 1; }

        /* Top Action Cards */
        .action-cards-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .action-card {
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          overflow: hidden;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
        }

        .action-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.07) 50%, transparent 80%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }

        .action-card:hover::before {
          transform: translateX(100%);
        }

        .action-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, var(--accent-a, var(--amber)), transparent 45%, var(--accent-b, var(--cyan)));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }

        .action-card:hover {
          transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-6px) scale(1.015);
          background: rgba(255, 255, 255, 0.06);
        }

        .action-card:hover::after {
          opacity: 1;
        }

        .action-card:active {
          transform: perspective(900px) translateY(-2px) scale(0.99);
        }

        .action-card.invoice-card {
          border: 1px solid rgba(251, 191, 36, 0.18);
          animation-delay: 0.05s;
          --accent-a: var(--amber);
          --accent-b: var(--cyan);
        }
        .action-card.invoice-card:hover {
          box-shadow: 0 18px 40px -12px rgba(251, 191, 36, 0.32);
          border-color: rgba(251, 191, 36, 0.4);
        }
        
        .action-card.saved-invoices-card {
          border: 1px solid rgba(167, 139, 250, 0.18);
          animation-delay: 0.08s;
          --accent-a: var(--violet);
          --accent-b: var(--sky);
        }
        .action-card.saved-invoices-card:hover {
          box-shadow: 0 18px 40px -12px rgba(167, 139, 250, 0.32);
          border-color: rgba(167, 139, 250, 0.4);
        }
        .saved-invoices-card .action-icon { 
          background: rgba(167, 139, 250, 0.12); 
          box-shadow: 0 0 0 1px rgba(167,139,250,0.15) inset; 
        }

        .action-card.inventory-card {
          border: 1px solid rgba(52, 211, 153, 0.18);
          animation-delay: 0.12s;
          --accent-a: var(--emerald);
          --accent-b: var(--violet);
        }
        .action-card.inventory-card:hover {
          box-shadow: 0 18px 40px -12px rgba(52, 211, 153, 0.32);
          border-color: rgba(52, 211, 153, 0.4);
        }

        .action-icon {
          position: relative;
          font-size: 24px;
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          transition: transform 0.35s ease;
        }

        .invoice-card .action-icon { background: rgba(251, 191, 36, 0.12); box-shadow: 0 0 0 1px rgba(251,191,36,0.15) inset; }
        .inventory-card .action-icon { background: rgba(52, 211, 153, 0.12); box-shadow: 0 0 0 1px rgba(52,211,153,0.15) inset; }

        .action-card:hover .action-icon {
          transform: scale(1.12) rotate(-4deg);
        }

        .action-title {
          font-weight: 700;
          font-size: 15px;
          color: #f8fafc;
          position: relative;
        }

        .action-sub {
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.3px;
          position: relative;
        }

        /* Stats Row */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 20px 22px;
          border: 1px solid var(--panel-border);
          border-left: 3px solid var(--stat-color, var(--sky));
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }

        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.16s; }
        .stat-card:nth-child(3) { animation-delay: 0.22s; }
        .stat-card:nth-child(4) { animation-delay: 0.28s; }

        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 30px -14px var(--stat-glow, rgba(56,189,248,0.35));
          border-color: color-mix(in srgb, var(--stat-color, var(--sky)) 45%, var(--panel-border));
        }

        .stat-card.stat-amber { --stat-color: var(--amber); --stat-glow: rgba(251,191,36,0.35); }
        .stat-card.stat-emerald { --stat-color: var(--emerald); --stat-glow: rgba(52,211,153,0.35); }
        .stat-card.stat-rose { --stat-color: var(--rose); --stat-glow: rgba(251,113,133,0.35); }
        .stat-card.stat-sky { --stat-color: var(--sky); --stat-glow: rgba(56,189,248,0.35); }

        .stat-top-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stat-icon {
          position: relative;
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          background: color-mix(in srgb, var(--stat-color, var(--sky)) 16%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--stat-color, var(--sky)) 30%, transparent) inset;
        }

        .stat-body { min-width: 0; flex: 1; }

        .stat-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
        }

        .stat-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.3px;
          transition: opacity 0.4s ease;
        }

        .stat-value.is-loading {
          opacity: 0.35;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
        }

        .stat-track {
          height: 4px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          overflow: hidden;
        }

        .stat-track-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, var(--stat-color, var(--sky)), color-mix(in srgb, var(--stat-color, var(--sky)) 40%, white));
          width: var(--fill, 0%);
          transition: width 1.1s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 10px var(--stat-glow, rgba(56,189,248,0.4));
        }

        .text-yellow { color: #facc15; }
        .text-green { color: #34d399; }
        .text-red { color: #f87171; }
        .text-white { color: #ffffff; }

        /* Search Bar Row */
        .search-row {
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 16px;
          align-items: center;
          border: 1px solid var(--panel-border);
          margin-bottom: 40px;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.32s;
        }

        .search-input-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          font-size: 14px;
          opacity: 0.7;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: white;
          padding: 12px 16px 12px 42px;
          border-radius: 8px;
          font-size: 13.5px;
          font-family: inherit;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: rgba(56, 189, 248, 0.45);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
        }

        .search-input::placeholder {
          color: #64748b;
        }

        .btn-reports {
          position: relative;
          background: linear-gradient(135deg, var(--amber) 0%, #f97316 100%);
          background-size: 160% 160%;
          color: #1c1300;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
          font-family: inherit;
          overflow: hidden;
          white-space: nowrap;
        }

        .btn-reports:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(251, 191, 36, 0.4);
          background-position: 100% 0%;
        }

        .btn-reports:active {
          transform: translateY(0);
        }

        /* ERP Modules Section */
        .erp-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.36s;
        }

        .erp-section-title .label {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .erp-count-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--panel-border);
          padding: 3px 9px;
          border-radius: 20px;
          letter-spacing: 0.4px;
        }

        .erp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .erp-card {
          position: relative;
          background: var(--panel);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 18px 20px;
          border: 1px solid var(--panel-border);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          overflow: hidden;
        }

        .erp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--sky), var(--violet));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .erp-card:hover::before {
          transform: scaleX(1);
        }

        .erp-grid .erp-card:nth-child(1) { animation-delay: 0.40s; }
        .erp-grid .erp-card:nth-child(2) { animation-delay: 0.44s; }
        .erp-grid .erp-card:nth-child(3) { animation-delay: 0.48s; }
        .erp-grid .erp-card:nth-child(4) { animation-delay: 0.52s; }
        .erp-grid .erp-card:nth-child(5) { animation-delay: 0.56s; }
        .erp-grid .erp-card:nth-child(6) { animation-delay: 0.60s; }
        .erp-grid .erp-card:nth-child(7) { animation-delay: 0.64s; }
        .erp-grid .erp-card:nth-child(8) { animation-delay: 0.68s; }
        .erp-grid .erp-card:nth-child(9) { animation-delay: 0.72s; }

        .erp-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(56, 189, 248, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 16px 32px -16px rgba(56, 189, 248, 0.3);
        }

        .erp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          position: relative;
        }

        .erp-title-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .erp-icon-badge {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: rgba(56, 189, 248, 0.10);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          transition: transform 0.3s ease, background 0.3s ease;
        }

        .erp-card:hover .erp-icon-badge {
          background: rgba(56, 189, 248, 0.18);
          animation: floatIcon 1.1s ease-in-out infinite;
        }

        .erp-title {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .badge-soon {
          background: rgba(139, 92, 246, 0.12);
          color: #a78bfa;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          animation: softPulse 2.4s ease-in-out infinite;
          position: relative;
        }

        .badge-live {
          background: rgba(52, 211, 153, 0.12);
          color: #6ee7b7;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          position: relative;
        }

        .erp-desc {
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
          position: relative;
        }

        /* Footer */
        .dashboard-footer {
          margin-top: 50px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          animation: fadeIn 0.8s ease both;
          animation-delay: 0.7s;
        }

        .dashboard-footer strong {
          color: #facc15;
          font-weight: 700;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 8px;
        }

        .footer-link {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s, transform 0.2s;
        }

        .footer-link:hover {
          color: #f8fafc;
          transform: translateY(-1px);
        }

        /* Modal */
        .modal-overlay { 
          position: fixed; 
          top: 0; left: 0; width: 100%; height: 100%; 
          background: rgba(0,0,0,0.72); 
          backdrop-filter: blur(8px); 
          display: flex; align-items: center; justify-content: center; 
          z-index: 100; 
          animation: fadeIn 0.2s ease both;
        }
        .modal-content { 
          position: relative;
          background: #101218;
          backdrop-filter: blur(16px);
          padding: 30px;
          border-radius: 16px;
          width: 440px; 
          max-width: calc(100vw - 32px);
          border: 1px solid rgba(251, 191, 36, 0.22); 
          box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 60px -20px rgba(56,189,248,0.25);
          animation: scaleIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .close-btn { 
          background: transparent; 
          border: none; 
          color: #a1a1aa; 
          font-size: 1.5rem; 
          float: right; 
          cursor: pointer; 
          transition: transform 0.2s ease, color 0.2s ease;
        }
        .close-btn:hover { color: white; transform: rotate(90deg); }
        .report-option {
          position: relative;
          width: 100%;
          padding: 15px;
          margin-bottom: 12px;
          background: #1a1c22;
          border: 1px solid rgba(255,255,255,0.06);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .report-option:hover {
          background: #22252d;
          border-color: rgba(56, 189, 248, 0.4);
          transform: translateX(3px);
        }
        .report-option:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
        .report-option:disabled:hover {
          background: #1a1c22;
          border-color: rgba(255,255,255,0.06);
        }

        @media (max-width: 860px) {
          .action-cards-container { grid-template-columns: 1fr 1fr; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .erp-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 640px) {
          .action-cards-container { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
          .erp-grid { grid-template-columns: 1fr; }
          .status-strip { flex-direction: column; align-items: flex-start; gap: 10px; }
          .status-strip-right { text-align: left; }
          .search-row { flex-direction: column; align-items: stretch; }
          .btn-reports { justify-content: center; }
        }
      `}</style>

      <div className="bg-orb" style={{ top: "-140px", left: "-120px", width: "380px", height: "380px", background: "rgba(251, 191, 36, 0.14)" }} />
      <div className="bg-orb" style={{ bottom: "-160px", right: "-120px", width: "440px", height: "440px", background: "rgba(52, 211, 153, 0.12)", animationDelay: "3s" }} />
      <div className="bg-orb" style={{ top: "38%", left: "58%", width: "300px", height: "300px", background: "rgba(34, 211, 238, 0.10)", animationDelay: "6s" }} />
      <div className="scan-line" />
      <div className="vignette" />

      <div className="dashboard-container">
        {/* Status Strip */}
        <div className="status-strip">
          <div className="status-strip-left">
            <div className="brand-mark">ERP</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="status-dot"></span>
                <span className="status-text">Live Overview</span>
              </div>
              <h1 className="status-title heading-font">DASHBOARD</h1>
            </div>
          </div>
          <div className="status-strip-right">
            <span>{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="clock mono">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>
        </div>

        {/* Top Action Cards */}
        <div className="action-cards-container">
          <div
            className="action-card invoice-card tilt-card"
            onClick={() => navigate("/invoice")}
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <span className="card-spotlight" />
            <div className="action-icon">📄</div>
            <div className="action-title">Invoice &amp; Quotation Generator</div>
            <div className="action-sub">Create &amp; manage billing documents</div>
          </div>
          
          <div
            className="action-card saved-invoices-card tilt-card"
            onClick={() => navigate("/saved-invoices")}
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <span className="card-spotlight" />
            <div className="action-icon">📂</div>
            <div className="action-title">Saved Invoices Menu</div>
            <div className="action-sub">Access &amp; manage past invoices</div>
          </div>

          <div
            className="action-card inventory-card tilt-card"
            onClick={() => navigate("/inventory")}
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <span className="card-spotlight" />
            <div className="action-icon">📦</div>
            <div className="action-title">Inventory Management</div>
            <div className="action-sub">Track stock levels in real time</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card stat-amber tilt-card">
            <span className="card-spotlight" />
            <div className="stat-top-row">
              <div className="stat-icon">💰</div>
              <div className="stat-body">
                <div className="stat-title">Total Sales (Billed)</div>
                <div className={`stat-value text-yellow ${!statsLoaded ? 'is-loading' : ''}`}>
                  ₹{formatCurrency(animatedSales)}
                </div>
              </div>
            </div>
            <div className="stat-track"><div className="stat-track-fill" style={{ "--fill": statsLoaded ? "100%" : "0%" }} /></div>
          </div>

          <div className="stat-card stat-emerald tilt-card">
            <span className="card-spotlight" />
            <div className="stat-top-row">
              <div className="stat-icon">✅</div>
              <div className="stat-body">
                <div className="stat-title">Amount Received</div>
                <div className={`stat-value text-green ${!statsLoaded ? 'is-loading' : ''}`}>
                  ₹{formatCurrency(animatedCollected)}
                </div>
              </div>
            </div>
            <div className="stat-track"><div className="stat-track-fill" style={{ "--fill": statsLoaded ? `${collectedPct}%` : "0%" }} /></div>
          </div>

          <div className="stat-card stat-rose tilt-card">
            <span className="card-spotlight" />
            <div className="stat-top-row">
              <div className="stat-icon">⏳</div>
              <div className="stat-body">
                <div className="stat-title">Total Due (Pending)</div>
                <div className={`stat-value text-red ${!statsLoaded ? 'is-loading' : ''}`}>
                  ₹{formatCurrency(animatedDue)}
                </div>
              </div>
            </div>
            <div className="stat-track"><div className="stat-track-fill" style={{ "--fill": statsLoaded ? `${100 - collectedPct}%` : "0%" }} /></div>
          </div>

          <div className="stat-card stat-sky tilt-card">
            <span className="card-spotlight" />
            <div className="stat-top-row">
              <div className="stat-icon">🧾</div>
              <div className="stat-body">
                <div className="stat-title">Total Invoices</div>
                <div className={`stat-value text-white ${!statsLoaded ? 'is-loading' : ''}`}>
                  {Math.round(animatedInvoices)}
                </div>
              </div>
            </div>
            <div className="stat-track"><div className="stat-track-fill" style={{ "--fill": statsLoaded ? "100%" : "0%" }} /></div>
          </div>
        </div>

        {/* Search Row */}
        <div className="search-row">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Quick Search: Type Client Name or Inv # and hit Enter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <button className="btn-reports" onClick={() => setShowReportModal(true)}>
            📊 Generate Reports
          </button>
        </div>

        {/* Upcoming ERP Modules */}
        <div className="erp-section-title">
          <span className="label">⚙️ ERP Modules &amp; Reports</span>
          <span className="erp-count-badge">{upcomingModules.length} MODULES</span>
        </div>
        <div className="erp-grid">
          {upcomingModules.map((mod, idx) => (
            <div 
              className="erp-card tilt-card" 
              key={idx} 
              onClick={() => mod.path ? navigate(mod.path) : handleComingSoon(mod.title)}
              onMouseMove={handleTilt}
              onMouseLeave={resetTilt}
            >
              <span className="card-spotlight" />
              <div className="erp-header">
                <div className="erp-title-wrapper">
                  <div className="erp-icon-badge">{mod.icon}</div>
                  <span className="erp-title">{mod.title}</span>
                </div>
                {mod.path
                  ? <span className="badge-live">LIVE</span>
                  : <span className="badge-soon">SOON</span>}
              </div>
              <p className="erp-desc">{mod.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="dashboard-footer">
          <div>Powered &amp; Developed By <strong> ISNU GUPTA</strong> © 2026</div>
          <div className="footer-links">
            <a href="https://www.linkedin.com/in/isnu-gupta-6659162b1" target="_blank" rel="noopener noreferrer" className="footer-link">🌐 LinkedIn</a>
            <a href="mailto:isnu.tech@gmail.com" className="footer-link">✉️ isnu.tech@gmail.com</a>
          </div>
        </div>
      </div>

      {/* REPORT GENERATION MODAL */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowReportModal(false)}>✕</button>
            <h2 className="heading-font" style={{marginTop: 0, color: '#f4f4f5', fontSize: '1.25rem'}}>Export Reports</h2>
            <p style={{color: '#94a3b8', fontSize: '13px', marginBottom: '20px'}}>Select a report type to view or download as a formatted PDF.</p>
            
            <div style={{display: 'flex', flexDirection: 'column'}}>
              {/* Option 1: View Sales GUI */}
              <button className="report-option" onClick={() => { setShowReportModal(false); navigate("/reports"); }} disabled={!!exportingType}>
                📈 View Dashboard Analytics
              </button>
              
              {/* Option 2: Download Everything */}
              <button className="report-option" onClick={() => handleDownloadReport("ALL")} disabled={!!exportingType}>
                {exportingType === "ALL" ? <span className="report-spinner" /> : "📥"}
                {exportingType === "ALL" ? "Generating PDF…" : "Download Master Ledger (PDF)"}
              </button>
              
              {/* Option 3: Download Only Unpaid */}
              <button className="report-option" onClick={() => handleDownloadReport("DUES")} disabled={!!exportingType}>
                {exportingType === "DUES" ? <span className="report-spinner" /> : "⏳"}
                {exportingType === "DUES" ? "Generating PDF…" : "Download Pending Dues Report (PDF)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}