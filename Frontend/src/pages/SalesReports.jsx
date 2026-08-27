import React, { useState, useEffect, useRef } from "react";
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

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalesReports() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("monthly"); // 'weekly' | 'monthly' | 'yearly'
  const [quickFilter, setQuickFilter] = useState("custom"); // 'custom' | 'this_month' | 'ytd'
  const [barsReady, setBarsReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Date selectors
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get("/invoices");
      if (res.data) {
        setInvoices(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch invoices for reports", error);
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

  const getFilteredInvoices = () => {
    return invoices.filter((inv) => {
      const d = getInvoiceDate(inv);
      if (timeframe === "yearly") {
        return d.getFullYear() === Number(selectedYear);
      }
      if (timeframe === "monthly" || timeframe === "weekly") {
        return d.getFullYear() === Number(selectedYear) && d.getMonth() + 1 === Number(selectedMonth);
      }
      return true;
    });
  };

  const currentInvoices = getFilteredInvoices();

  const totalSales = currentInvoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
  const totalCollected = currentInvoices.reduce((acc, inv) => acc + ((inv.total_amount || 0) - (inv.remaining_amount || 0)), 0);
  const totalDue = currentInvoices.reduce((acc, inv) => acc + (inv.remaining_amount || 0), 0);
  const totalCount = currentInvoices.length;

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
            inv.payment_status || "DUE",
          ]),
          theme: "grid",
          headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 8 },
        });
      }

      doc.save(`sales_report_${timeframe}_${selectedYear}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

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

        body { background-color: #09090b; font-family: 'Plus Jakarta Sans', sans-serif; color: #f1f5f9; margin: 0; min-height: 100vh; }

        .report-shell { position: relative; min-height: 100vh; overflow: hidden; }
        .report-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.16; pointer-events: none; z-index: 0; }
        .report-orb-1 { width: 460px; height: 460px; top: -160px; right: -120px; background: radial-gradient(circle, #ea580c, transparent 70%); animation: orb-drift 16s ease-in-out infinite; }
        .report-orb-2 { width: 380px; height: 380px; bottom: -140px; left: -100px; background: radial-gradient(circle, #38bdf8, transparent 70%); animation: orb-drift 18s ease-in-out infinite reverse; }

        .report-container { position: relative; z-index: 1; max-width: 1150px; margin: 0 auto; padding: 40px 20px; }

        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; animation: fade-slide-up 0.5s ease both; }
        .back-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s ease, transform 0.15s ease; }
        .back-btn:hover { background: rgba(255,255,255,0.15); transform: translateX(-2px); }

        .toolbar-grid { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 24px; animation: fade-slide-up 0.5s ease 0.05s both; }
        .tabs-row { display: flex; gap: 8px; }
        .quick-filters { display: flex; gap: 8px; }

        .tab-btn { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; padding: 10px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; font-family: inherit; font-size: 13px; }
        .tab-btn:hover { color: #e2e8f0; border-color: rgba(255,255,255,0.2); }
        .tab-btn.active { background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; border-color: #ea580c; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35); animation: pill-pop 0.3s ease; }

        .filters-row { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); padding: 16px 20px; border-radius: 12px; display: flex; gap: 20px; align-items: center; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: fade-slide-up 0.5s ease 0.1s both; }
        .filter-group { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #94a3b8; }
        .filter-select { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px 12px; border-radius: 8px; font-family: inherit; transition: border-color 0.2s ease; }
        .filter-select:hover, .filter-select:focus { border-color: #ea580c; outline: none; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
        .stat-card { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border-radius: 16px; padding: 22px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; animation: fade-slide-up 0.5s ease both; }
        .stat-card:hover { transform: translateY(-4px); border-color: rgba(234, 88, 12, 0.4); box-shadow: 0 10px 26px rgba(0,0,0,0.6); }
        .stat-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.4px; }
        .stat-value { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }

        .breakdown-section { background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 30px; animation: fade-slide-up 0.5s ease 0.15s both; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }

        .breakdown-table { width: 100%; border-collapse: collapse; }
        .breakdown-table th, .breakdown-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13.5px; }
        .breakdown-table th { color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 11px; }
        .breakdown-table tbody tr { animation: row-in 0.4s ease both; transition: background 0.15s ease; }
        .breakdown-table tbody tr:hover { background: rgba(255,255,255,0.025); }

        .bar-track { position: relative; width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; margin-top: 6px; }
        .bar-fill { position: absolute; left: 0; top: 0; height: 100%; width: 0%; border-radius: 4px; background: linear-gradient(90deg, #38bdf8, #ea580c); transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }

        .export-btn { position: relative; overflow: hidden; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; font-family: inherit; font-size: 14px; }
        .export-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(16,185,129,0.3); }
        .export-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }

        .skeleton-row { height: 18px; border-radius: 4px; margin: 10px 0; background: linear-gradient(90deg, #131c31 0%, #1e293b 40%, #131c31 80%); background-size: 600px 100%; animation: shimmer 1.4s ease-in-out infinite; }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .stats-grid { grid-template-columns: 1fr; }
          .toolbar-grid { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <div className="report-shell">
        <div className="report-orb report-orb-1" />
        <div className="report-orb report-orb-2" />

        <div className="report-container">
          <div className="header-row">
            <div>
              <button className="back-btn" onClick={() => navigate("/")}>← Back to Dashboard</button>
              <h1 style={{ margin: "12px 0 0 0", fontSize: "24px" }}>📊 Comprehensive Sales Reports</h1>
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
          <div className="filters-row">
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
          </div>

          {/* Summary Cards */}
          <div className="stats-grid" key={`stats-${timeframe}-${selectedYear}-${selectedMonth}`}>
            <div className="stat-card" style={{ animationDelay: "0.02s" }}>
              <div className="stat-title">Total Sales</div>
              <div className="stat-value" style={{ color: "#facc15" }}>₹<AnimatedNumber value={totalSales} /></div>
            </div>
            <div className="stat-card" style={{ animationDelay: "0.08s" }}>
              <div className="stat-title">Amount Collected</div>
              <div className="stat-value" style={{ color: "#34d399" }}>₹<AnimatedNumber value={totalCollected} /></div>
            </div>
            <div className="stat-card" style={{ animationDelay: "0.14s" }}>
              <div className="stat-title">Pending Dues</div>
              <div className="stat-value" style={{ color: "#f87171" }}>₹<AnimatedNumber value={totalDue} /></div>
            </div>
            <div className="stat-card" style={{ animationDelay: "0.2s" }}>
              <div className="stat-title">Total Invoices</div>
              <div className="stat-value" style={{ color: "#ffffff" }}><AnimatedNumber value={totalCount} decimals={0} /></div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="breakdown-section">
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
            ) : (
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Period / Interval</th>
                    <th>Invoices Generated</th>
                    <th>Total Sales Volume</th>
                  </tr>
                </thead>
                <tbody key={`${timeframe}-${selectedYear}-${selectedMonth}`}>
                  {breakdown.map((row, idx) => (
                    <tr key={idx} style={{ animationDelay: `${idx * 0.05}s` }}>
                      <td style={{ fontWeight: "600" }}>{row.label}</td>
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}