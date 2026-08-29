import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../api/axios";

// Animates a numeric value smoothly whenever it changes (stat cards, totals).
function AnimatedNumber({ value, decimals = 2 }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = prevValue.current;
    const end = Number(value) || 0;
    const duration = 700;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        prevValue.current = end;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      {new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(display)}
    </>
  );
}

// Small up/down badge for period-over-period comparisons.
function TrendBadge({ pct }) {
  if (pct === null || !Number.isFinite(pct)) {
    return <span className="trend-badge neutral">— vs prior period</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`trend-badge ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs prior period
    </span>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_COLORS = { Paid: "#34d399", Partial: "#facc15", Due: "#f87171" };

function classifyStatus(inv) {
  const total = Number(inv.total_amount) || 0;
  const remaining = Number(inv.remaining_amount) || 0;
  if (remaining <= 0) return "Paid";
  if (remaining < total) return "Partial";
  return "Due";
}

export default function SalesReports() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [timeframe, setTimeframe] = useState("monthly"); // 'weekly' | 'monthly' | 'yearly'
  const [quickFilter, setQuickFilter] = useState("custom"); // 'custom' | 'this_month' | 'ytd'
  const [barsReady, setBarsReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Date selectors
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

  useEffect(() => {
    fetchInvoices();
  }, []);

  const pushToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get("/invoices");
      if (res.data) {
        setInvoices(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch invoices for reports", error);
      setLoadError(true);
      pushToast("Couldn't load invoices for reporting.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // --- FILTERING & AGGREGATION LOGIC ---

  const getInvoiceDate = (inv) => {
    return inv.created_at ? new Date(inv.created_at) : new Date();
  };

  const handleQuickFilter = (type) => {
    setQuickFilter(type);
    const now = new Date();
    if (type === "this_month") {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
      setTimeframe("monthly");
    } else if (type === "ytd") {
      setSelectedYear(now.getFullYear());
      setTimeframe("yearly");
    }
  };

  const filterByPeriod = (list, year, month) => {
    return list.filter((inv) => {
      const d = getInvoiceDate(inv);
      if (timeframe === "yearly") {
        return d.getFullYear() === Number(year);
      }
      // weekly and monthly both scope to a single calendar month
      return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
    });
  };

  const currentInvoices = useMemo(
    () => filterByPeriod(invoices, selectedYear, selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, timeframe, selectedYear, selectedMonth]
  );

  // The comparable prior period: previous year for a yearly view, previous
  // calendar month (rolling across a year boundary) for weekly/monthly.
  const previousInvoices = useMemo(() => {
    if (timeframe === "yearly") {
      return filterByPeriod(invoices, Number(selectedYear) - 1, selectedMonth);
    }
    let prevMonth = Number(selectedMonth) - 1;
    let prevYear = Number(selectedYear);
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return filterByPeriod(invoices, prevYear, prevMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, timeframe, selectedYear, selectedMonth]);

  const summarize = (list) => {
    const sales = list.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
    const collected = list.reduce((acc, inv) => acc + ((inv.total_amount || 0) - (inv.remaining_amount || 0)), 0);
    const due = list.reduce((acc, inv) => acc + (inv.remaining_amount || 0), 0);
    return { sales, collected, due, count: list.length };
  };

  const pctChange = (current, prev) => {
    if (!prev) return current > 0 ? null : 0;
    return ((current - prev) / prev) * 100;
  };

  const current = summarize(currentInvoices);
  const previous = summarize(previousInvoices);

  const totalSales = current.sales;
  const totalCollected = current.collected;
  const totalDue = current.due;
  const totalCount = current.count;
  const avgInvoiceValue = totalCount > 0 ? totalSales / totalCount : 0;
  const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;

  const salesTrend = pctChange(current.sales, previous.sales);
  const collectedTrend = pctChange(current.collected, previous.collected);
  const dueTrend = pctChange(current.due, previous.due);
  const countTrend = pctChange(current.count, previous.count);

  const statusBreakdown = useMemo(() => {
    const counts = { Paid: 0, Partial: 0, Due: 0 };
    currentInvoices.forEach((inv) => {
      counts[classifyStatus(inv)] += 1;
    });
    return counts;
  }, [currentInvoices]);

  const topInvoices = useMemo(
    () => [...currentInvoices].sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0)).slice(0, 5),
    [currentInvoices]
  );

  const getBreakdownData = () => {
    if (timeframe === "yearly") {
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: new Date(selectedYear, i, 1).toLocaleString("default", { month: "long" }),
        sales: 0,
        count: 0,
      }));

      currentInvoices.forEach((inv) => {
        const d = getInvoiceDate(inv);
        const m = d.getMonth();
        months[m].sales += inv.total_amount || 0;
        months[m].count += 1;
      });
      return months;
    }

    if (timeframe === "monthly") {
      const weeks = [
        { label: "Week 1 (Days 1-7)", sales: 0, count: 0 },
        { label: "Week 2 (Days 8-14)", sales: 0, count: 0 },
        { label: "Week 3 (Days 15-21)", sales: 0, count: 0 },
        { label: "Week 4+ (Days 22-End)", sales: 0, count: 0 },
      ];

      currentInvoices.forEach((inv) => {
        const d = getInvoiceDate(inv);
        const day = d.getDate();
        const wIndex = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
        weeks[wIndex].sales += inv.total_amount || 0;
        weeks[wIndex].count += 1;
      });
      return weeks;
    }

    if (timeframe === "weekly") {
      const days = [
        { label: "Sunday", sales: 0, count: 0 },
        { label: "Monday", sales: 0, count: 0 },
        { label: "Tuesday", sales: 0, count: 0 },
        { label: "Wednesday", sales: 0, count: 0 },
        { label: "Thursday", sales: 0, count: 0 },
        { label: "Friday", sales: 0, count: 0 },
        { label: "Saturday", sales: 0, count: 0 },
      ];

      currentInvoices.forEach((inv) => {
        const d = getInvoiceDate(inv);
        const dayIdx = d.getDay();
        days[dayIdx].sales += inv.total_amount || 0;
        days[dayIdx].count += 1;
      });
      return days;
    }

    return [];
  };

  const breakdown = getBreakdownData();
  const maxBreakdownSales = Math.max(...breakdown.map((r) => r.sales), 1);
  const bestPeriod = breakdown.reduce(
    (best, row) => (row.sales > (best?.sales ?? -1) ? row : best),
    null
  );

  // Re-trigger the bar-grow animation whenever the underlying data changes
  useEffect(() => {
    setBarsReady(false);
    const t = setTimeout(() => setBarsReady(true), 60);
    return () => clearTimeout(t);
  }, [timeframe, selectedYear, selectedMonth, invoices.length]);

  // --- PDF EXPORT ---
  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const periodLabel =
        timeframe === "yearly" ? `${selectedYear}` : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.text("Sales Report Analysis", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text(`${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} report - ${periodLabel}`, 14, 27);
      doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 32);

      autoTable(doc, {
        startY: 40,
        head: [["Total Sales", "Amount Collected", "Pending Dues", "Total Invoices"]],
        body: [[
          `Rs. ${formatCurrency(totalSales)}`,
          `Rs. ${formatCurrency(totalCollected)}`,
          `Rs. ${formatCurrency(totalDue)}`,
          `${totalCount}`,
        ]],
        theme: "grid",
        headStyles: { fillColor: [234, 88, 12], halign: "center" },
        bodyStyles: { halign: "center", fontStyle: "bold" },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 12,
        head: [[`${timeframe.toUpperCase()} BREAKDOWN`, "Invoices", "Sales Volume"]],
        body: breakdown.map((row) => [row.label, String(row.count), `Rs. ${formatCurrency(row.sales)}`]),
        theme: "striped",
        headStyles: { fillColor: [26, 26, 26] },
      });

      if (currentInvoices.length) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 12,
          head: [["Invoice #", "Client", "Date", "Amount", "Status"]],
          body: currentInvoices.map((inv) => [
            inv.invoice_number || "-",
            inv.client_name || "Walk-in Customer",
            inv.created_at ? inv.created_at.split("T")[0] : "-",
            `Rs. ${formatCurrency(inv.total_amount || 0)}`,
            inv.payment_status || classifyStatus(inv),
          ]),
          theme: "grid",
          headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 8 },
        });
      }

      doc.save(`sales_report_${timeframe}_${selectedYear}.pdf`);
      pushToast("Report exported as PDF.", "success");
    } catch (err) {
      console.error("PDF export failed", err);
      pushToast("Couldn't generate the PDF. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const statusTotal = statusBreakdown.Paid + statusBreakdown.Partial + statusBreakdown.Due;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        @keyframes orb-drift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(3%, -4%) scale(1.06); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes fade-slide-up {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes row-in {
          0%   { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -300px 0; }
          100% { background-position: 300px 0; }
        }
        @keyframes pill-pop {
          0%   { transform: scale(0.94); }
          60%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes crown-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        body {
          background:
            radial-gradient(circle at 12% 8%, rgba(234, 88, 12, 0.10), transparent 40%),
            radial-gradient(circle at 88% 92%, rgba(56, 189, 248, 0.10), transparent 42%),
            #08070c;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        /* ---- Glass surface primitive ---- */
        .glass {
          position: relative;
          background: rgba(255, 255, 255, 0.045);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow:
            0 10px 34px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.09);
        }
        .glass::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0) 42%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.06));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .report-shell { position: relative; min-height: 100vh; overflow: hidden; }
        .report-orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.22; pointer-events: none; z-index: 0; }
        .report-orb-1 { width: 480px; height: 480px; top: -170px; right: -120px; background: radial-gradient(circle, #ea580c, transparent 70%); animation: orb-drift 16s ease-in-out infinite; }
        .report-orb-2 { width: 400px; height: 400px; bottom: -150px; left: -100px; background: radial-gradient(circle, #38bdf8, transparent 70%); animation: orb-drift 18s ease-in-out infinite reverse; }
        .report-orb-3 { width: 320px; height: 320px; top: 42%; left: 55%; background: radial-gradient(circle, #a78bfa, transparent 70%); animation: orb-drift 20s ease-in-out infinite; animation-delay: 4s; opacity: 0.14; }

        .report-container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 40px 20px 70px; }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; animation: fade-slide-up 0.5s ease both; flex-wrap: wrap; gap: 16px; }
        .back-btn { background: rgba(255,255,255,0.07); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.12); color: white; padding: 9px 16px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: background 0.2s ease, transform 0.15s ease, border-color 0.2s ease; font-family: inherit; }
        .back-btn:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.25); transform: translateX(-2px); }
        .page-title {
          margin: 12px 0 2px 0; font-size: 26px; font-weight: 800; font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.01em;
          background: linear-gradient(135deg, #ffffff 25%, #fdba74 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .page-subtitle { margin: 0; font-size: 12.5px; color: #7d8798; font-weight: 500; }

        .toolbar-grid { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 24px; animation: fade-slide-up 0.5s ease 0.05s both; }
        .tabs-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .quick-filters { display: flex; gap: 8px; flex-wrap: wrap; }

        .tab-btn {
          background: rgba(255,255,255,0.04); backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.09); color: #94a3b8; padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; font-family: inherit; font-size: 13px;
        }
        .tab-btn:hover { color: #e2e8f0; border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.07); }
        .tab-btn.active { background: linear-gradient(135deg, rgba(234,88,12,0.9) 0%, rgba(194,65,12,0.9) 100%); color: white; border-color: rgba(253, 186, 116, 0.5); box-shadow: 0 4px 18px rgba(234, 88, 12, 0.4), inset 0 1px 0 rgba(255,255,255,0.2); animation: pill-pop 0.3s ease; }
        .tab-btn:focus-visible, .back-btn:focus-visible, .export-btn:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }

        .filters-row { border-radius: 16px; padding: 16px 20px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 30px; animation: fade-slide-up 0.5s ease 0.1s both; }
        .filter-group { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #94a3b8; }
        .filter-select { background: rgba(15, 12, 10, 0.5); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.12); color: white; padding: 8px 12px; border-radius: 9px; font-family: inherit; transition: border-color 0.2s ease; }
        .filter-select:hover, .filter-select:focus { border-color: #ea580c; outline: none; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 18px; }
        .stat-card { border-radius: 18px; padding: 22px; transition: transform 0.25s cubic-bezier(.2,.9,.3,1.2), box-shadow 0.25s ease, border-color 0.25s ease; animation: fade-slide-up 0.5s ease both; overflow: hidden; }
        .stat-card:hover { transform: translateY(-5px); border-color: rgba(234, 88, 12, 0.4); box-shadow: 0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12); }
        .stat-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.4px; }
        .stat-value { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; font-family: 'Space Grotesk', sans-serif; }
        .trend-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; margin-top: 8px; padding: 3px 8px; border-radius: 20px; }
        .trend-badge.up { color: #34d399; background: rgba(52, 211, 153, 0.12); }
        .trend-badge.down { color: #f87171; background: rgba(248, 113, 113, 0.12); }
        .trend-badge.neutral { color: #64748b; background: rgba(100, 116, 139, 0.1); }

        .secondary-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
        .mini-stat { border-radius: 14px; padding: 16px 18px; animation: fade-slide-up 0.5s ease both; display: flex; align-items: center; gap: 12px; transition: border-color 0.2s ease, transform 0.2s ease; }
        .mini-stat:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.18); }
        .mini-stat .mini-icon { font-size: 20px; }
        .mini-stat .mini-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #7d8798; font-weight: 700; }
        .mini-stat .mini-value { font-size: 16.5px; font-weight: 800; font-family: 'Space Grotesk', sans-serif; }

        .two-col { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 30px; align-items: start; }
        @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

        .breakdown-section, .side-card { border-radius: 18px; padding: 24px; animation: fade-slide-up 0.5s ease 0.15s both; }
        .side-card + .side-card { margin-top: 24px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-family: 'Space Grotesk', sans-serif; }

        .breakdown-table { width: 100%; border-collapse: collapse; }
        .breakdown-table th, .breakdown-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13.5px; }
        .breakdown-table th { color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 11px; }
        .breakdown-table tbody tr { animation: row-in 0.4s ease both; transition: background 0.15s ease; }
        .breakdown-table tbody tr:hover { background: rgba(255,255,255,0.035); }
        .breakdown-table tbody tr.best-row { background: rgba(250, 204, 21, 0.06); }
        .crown { display: inline-block; margin-left: 6px; animation: crown-bounce 1.6s ease-in-out infinite; }

        .bar-track { position: relative; width: 100%; height: 6px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; margin-top: 6px; }
        .bar-fill { position: absolute; left: 0; top: 0; height: 100%; width: 0%; border-radius: 4px; background: linear-gradient(90deg, #38bdf8, #ea580c); transition: width 0.8s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }

        /* ---- Payment status split ---- */
        .status-stack { display: flex; width: 100%; height: 10px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.06); margin: 10px 0 16px; }
        .status-seg { height: 100%; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
        .status-legend { display: flex; flex-direction: column; gap: 10px; }
        .status-legend-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .status-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-legend-left { display: flex; align-items: center; color: #cbd5e1; font-weight: 600; }
        .status-legend-count { color: #94a3b8; font-variant-numeric: tabular-nums; }

        /* ---- Top invoices ---- */
        .top-inv-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); animation: row-in 0.4s ease both; transition: background 0.15s ease; }
        .top-inv-row:hover { background: rgba(255,255,255,0.025); }
        .top-inv-row:last-child { border-bottom: none; }
        .top-inv-name { font-weight: 700; font-size: 13.5px; }
        .top-inv-meta { font-size: 11px; color: #7d8798; margin-top: 2px; }
        .top-inv-amount { font-weight: 800; font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; }
        .status-pill { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-top: 3px; }

        .export-btn { position: relative; overflow: hidden; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: 1px solid rgba(255,255,255,0.18); padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; font-family: inherit; font-size: 14px; box-shadow: 0 4px 18px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); }
        .export-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(16,185,129,0.42); }
        .export-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }

        .skeleton-row { height: 18px; border-radius: 4px; margin: 10px 0; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.04) 80%); background-size: 600px 100%; animation: shimmer 1.4s ease-in-out infinite; }
        .skeleton-card { height: 88px; border-radius: 18px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.04) 80%); background-size: 600px 100%; animation: shimmer 1.4s ease-in-out infinite; border: 1px solid rgba(255,255,255,0.08); }

        .empty-note { text-align: center; color: #64748b; padding: 30px 10px; }
        .empty-note .empty-icon { font-size: 26px; display: block; margin-bottom: 8px; }

        .toast-stack { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 10px; z-index: 50; max-width: 340px; }
        .toast { padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 600; color: white; background: rgba(19, 20, 28, 0.55); backdrop-filter: blur(18px) saturate(160%); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.6); animation: toast-in 0.3s cubic-bezier(0.16,1,0.3,1) both; display: flex; align-items: center; gap: 8px; }
        .toast.success { border-color: rgba(16,185,129,0.4); }
        .toast.error { border-color: rgba(239,68,68,0.4); }
        .toast.info { border-color: rgba(56,189,248,0.4); }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .secondary-stats { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .stats-grid { grid-template-columns: 1fr; }
          .toolbar-grid { flex-direction: column; align-items: stretch; }
          .header-row { flex-direction: column; align-items: stretch; }
          .export-btn { justify-content: center; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div className="report-shell">
        <div className="report-orb report-orb-1" />
        <div className="report-orb report-orb-2" />
        <div className="report-orb report-orb-3" />

        <div className="report-container">
          <div className="header-row">
            <div>
              <button className="back-btn" onClick={() => navigate("/")}>← Back to Dashboard</button>
              <h1 className="page-title">📊 Comprehensive Sales Reports</h1>
              <p className="page-subtitle">Compare periods, track collections and spot your best-performing days.</p>
            </div>
            <button className="export-btn" onClick={exportToPDF} disabled={exporting || loading}>
              {exporting ? <span className="spinner" /> : "📄"}
              {exporting ? "Generating…" : "Export Report (PDF)"}
            </button>
          </div>

          {/* Toolbar with Timeframe & Quick Filters */}
          <div className="toolbar-grid">
            <div className="tabs-row">
              <button className={`tab-btn ${timeframe === "weekly" ? "active" : ""}`} onClick={() => setTimeframe("weekly")}>Weekly Report</button>
              <button className={`tab-btn ${timeframe === "monthly" ? "active" : ""}`} onClick={() => setTimeframe("monthly")}>Monthly Report</button>
              <button className={`tab-btn ${timeframe === "yearly" ? "active" : ""}`} onClick={() => setTimeframe("yearly")}>Yearly Report</button>
            </div>

            <div className="quick-filters">
              <button className={`tab-btn ${quickFilter === "this_month" ? "active" : ""}`} onClick={() => handleQuickFilter("this_month")}>This Month</button>
              <button className={`tab-btn ${quickFilter === "ytd" ? "active" : ""}`} onClick={() => handleQuickFilter("ytd")}>Year to Date</button>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-row glass">
            <div className="filter-group">
              <span>Year:</span>
              <select className="filter-select" value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setQuickFilter("custom"); }}>
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {timeframe !== "yearly" && (
              <div className="filter-group">
                <span>Month:</span>
                <select className="filter-select" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setQuickFilter("custom"); }}>
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {loadError && (
              <button className="tab-btn" onClick={fetchInvoices} style={{ marginLeft: "auto" }}>
                ↻ Retry loading invoices
              </button>
            )}
          </div>

          {/* Summary Cards */}
          {loading ? (
            <div className="stats-grid">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.06}s` }} />)}
            </div>
          ) : (
            <div className="stats-grid" key={`stats-${timeframe}-${selectedYear}-${selectedMonth}`}>
              <div className="stat-card glass" style={{ animationDelay: "0.02s" }}>
                <div className="stat-title">Total Sales</div>
                <div className="stat-value" style={{ color: "#facc15" }}>₹<AnimatedNumber value={totalSales} /></div>
                <TrendBadge pct={salesTrend} />
              </div>
              <div className="stat-card glass" style={{ animationDelay: "0.08s" }}>
                <div className="stat-title">Amount Collected</div>
                <div className="stat-value" style={{ color: "#34d399" }}>₹<AnimatedNumber value={totalCollected} /></div>
                <TrendBadge pct={collectedTrend} />
              </div>
              <div className="stat-card glass" style={{ animationDelay: "0.14s" }}>
                <div className="stat-title">Pending Dues</div>
                <div className="stat-value" style={{ color: "#f87171" }}>₹<AnimatedNumber value={totalDue} /></div>
                <TrendBadge pct={dueTrend} />
              </div>
              <div className="stat-card glass" style={{ animationDelay: "0.2s" }}>
                <div className="stat-title">Total Invoices</div>
                <div className="stat-value" style={{ color: "#ffffff" }}><AnimatedNumber value={totalCount} decimals={0} /></div>
                <TrendBadge pct={countTrend} />
              </div>
            </div>
          )}

          {/* Secondary stats */}
          {!loading && (
            <div className="secondary-stats">
              <div className="mini-stat glass" style={{ animationDelay: "0.24s" }}>
                <span className="mini-icon">🧾</span>
                <div>
                  <div className="mini-label">Avg Invoice Value</div>
                  <div className="mini-value">₹<AnimatedNumber value={avgInvoiceValue} /></div>
                </div>
              </div>
              <div className="mini-stat glass" style={{ animationDelay: "0.28s" }}>
                <span className="mini-icon">✅</span>
                <div>
                  <div className="mini-label">Collection Rate</div>
                  <div className="mini-value"><AnimatedNumber value={collectionRate} decimals={1} />%</div>
                </div>
              </div>
              <div className="mini-stat glass" style={{ animationDelay: "0.32s" }}>
                <span className="mini-icon">🏆</span>
                <div>
                  <div className="mini-label">Best {timeframe === "yearly" ? "Month" : timeframe === "weekly" ? "Day" : "Week"}</div>
                  <div className="mini-value">{bestPeriod && bestPeriod.sales > 0 ? bestPeriod.label : "—"}</div>
                </div>
              </div>
            </div>
          )}

          <div className="two-col">
            {/* Breakdown Table */}
            <div className="breakdown-section glass">
              <div className="section-title">
                <span>{timeframe.toUpperCase()} Breakdown Performance</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "400" }}>Showing stats for {selectedYear}</span>
              </div>

              {loading ? (
                <div>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              ) : currentInvoices.length === 0 ? (
                <div className="empty-note">
                  <span className="empty-icon">📭</span>
                  No invoices in this period yet. Try a different month or year.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>Period / Interval</th>
                      <th>Invoices Generated</th>
                      <th>Total Sales Volume</th>
                    </tr>
                  </thead>
                  <tbody key={`${timeframe}-${selectedYear}-${selectedMonth}`}>
                    {breakdown.map((row, idx) => {
                      const isBest = bestPeriod && row.label === bestPeriod.label && row.sales > 0;
                      return (
                        <tr key={idx} className={isBest ? "best-row" : ""} style={{ animationDelay: `${idx * 0.05}s` }}>
                          <td style={{ fontWeight: "600" }}>
                            {row.label}
                            {isBest && <span className="crown" title="Best performing period">🏆</span>}
                          </td>
                          <td>{row.count}</td>
                          <td style={{ color: "#38bdf8", fontWeight: "700" }}>
                            ₹{formatCurrency(row.sales)}
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{ width: barsReady ? `${(row.sales / maxBreakdownSales) * 100}%` : "0%" }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Side column: payment status + top invoices */}
            <div>
              <div className="side-card glass">
                <div className="section-title"><span>Payment Status Split</span></div>
                {loading ? (
                  <div className="skeleton-row" />
                ) : statusTotal === 0 ? (
                  <div className="empty-note" style={{ padding: "10px 0" }}>No invoices to summarize yet.</div>
                ) : (
                  <>
                    <div className="status-stack">
                      {["Paid", "Partial", "Due"].map((key) => (
                        <div
                          key={key}
                          className="status-seg"
                          style={{
                            width: barsReady ? `${(statusBreakdown[key] / statusTotal) * 100}%` : "0%",
                            background: STATUS_COLORS[key],
                          }}
                        />
                      ))}
                    </div>
                    <div className="status-legend">
                      {["Paid", "Partial", "Due"].map((key) => (
                        <div className="status-legend-row" key={key}>
                          <span className="status-legend-left">
                            <span className="status-dot" style={{ background: STATUS_COLORS[key] }} />
                            {key}
                          </span>
                          <span className="status-legend-count">
                            {statusBreakdown[key]} ({statusTotal ? Math.round((statusBreakdown[key] / statusTotal) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="side-card glass">
                <div className="section-title"><span>Top Invoices</span></div>
                {loading ? (
                  <div>
                    {[0, 1, 2].map((i) => <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.08}s` }} />)}
                  </div>
                ) : topInvoices.length === 0 ? (
                  <div className="empty-note" style={{ padding: "10px 0" }}>Nothing to show for this period.</div>
                ) : (
                  topInvoices.map((inv, idx) => {
                    const status = classifyStatus(inv);
                    return (
                      <div className="top-inv-row" key={inv.id ?? idx} style={{ animationDelay: `${idx * 0.05}s` }}>
                        <div>
                          <div className="top-inv-name">{inv.client_name || "Walk-in Customer"}</div>
                          <div className="top-inv-meta">
                            {inv.invoice_number || "—"} · {inv.created_at ? inv.created_at.split("T")[0] : "—"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="top-inv-amount">₹{formatCurrency(inv.total_amount || 0)}</div>
                          <span
                            className="status-pill"
                            style={{ color: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}22` }}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "ℹ️"} {t.message}
          </div>
        ))}
      </div>
    </>
  );
}