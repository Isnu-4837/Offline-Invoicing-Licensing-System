import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
    import { useNavigate } from "react-router-dom";
    import api from "../api/axios";

    // --- Segment thresholds: what counts as "frequent" or "nearby" ---
    // Kept adjustable in the UI rather than hardcoded, since every seller's
    // definition of "regular customer" and "close by" differs.
    const DEFAULT_FREQUENT_THRESHOLD = 3; // orders
    const DEFAULT_NEARBY_KM = 5; // kilometres

    const EMPTY_FORM = {
    name: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    state: "",
    state_code: "",
    place_of_supply: "",
    area: "",
    distance_km: "",
    total_orders: "",
    total_spent: "",
    last_purchase_date: "",
    notes: ""
    };

    // Indian state -> GST state code, so picking a state can auto-fill the code
    // and default Place of Supply instead of making the seller look it up.
    const STATE_CODE_MAP = {
    "Jammu and Kashmir": "01", "Himachal Pradesh": "02", "Punjab": "03",
    "Chandigarh": "04", "Uttarakhand": "05", "Haryana": "06", "Delhi": "07",
    "Rajasthan": "08", "Uttar Pradesh": "09", "Bihar": "10", "Sikkim": "11",
    "Arunachal Pradesh": "12", "Nagaland": "13", "Manipur": "14", "Mizoram": "15",
    "Tripura": "16", "Meghalaya": "17", "Assam": "18", "West Bengal": "19",
    "Jharkhand": "20", "Odisha": "21", "Chattisgarh": "22", "Madhya Pradesh": "23",
    "Gujarat": "24", "Daman and Diu": "25", "Dadra and Nagar Haveli": "26",
    "Maharashtra": "27", "Karnataka": "29", "Goa": "30", "Lakshadweep": "31",
    "Kerala": "32", "Tamil Nadu": "33", "Puducherry": "34",
    "Andaman and Nicobar Islands": "35", "Telangana": "36",
    "Andhra Pradesh": "37", "Ladakh": "38"
    };

    // Key used to hand a customer's buyer details to the Invoice Generator page.
    // The invoice page should read this on mount to auto-fill its "Buyer (Bill
    // To)" section. We write it via both router state and localStorage so the
    // autofill survives a hard refresh / direct navigation.
    const INVOICE_AUTOFILL_KEY = "invoiceAutofillBuyer";

    // A small deterministic palette so every customer gets a distinct avatar
    // treatment instead of one flat brand color repeated down the whole list.
    const AVATAR_PALETTE = [
    ["#38bdf8", "#0284c7"],
    ["#a78bfa", "#7c3aed"],
    ["#fb7185", "#e11d48"],
    ["#34d399", "#059669"],
    ["#fbbf24", "#d97706"],
    ["#22d3ee", "#0891b2"]
    ];

    const avatarGradient = (name) => {
    const str = String(name || "");
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    const [a, b] = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
    return `linear-gradient(145deg, ${a}, ${b})`;
    };

    const getInitials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

    const fmtDistance = (km) => {
    if (km === null || km === undefined || km === "") return "—";
    const n = Number(km);
    if (Number.isNaN(n)) return "—";
    return n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`;
    };

    const fmtDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Higher score = more valuable to reach out to first: frequent buyers who
    // are also close by outrank someone who orders once from across town.
    const priorityScore = (c) => {
    const orders = Number(c.total_orders) || 0;
    const distance = c.distance_km === "" || c.distance_km === null || c.distance_km === undefined
        ? 999
        : Number(c.distance_km);
    return orders * 12 - distance;
    };

    // Animates a number toward its target with an eased ramp, so the summary
    // cards feel alive whenever the underlying data set changes. Reduced-motion
    // users get the final value immediately instead of a ramp.
    const useCountUp = (value, duration = 700) => {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);

    useEffect(() => {
        const reduced = typeof window !== "undefined"
        && window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (reduced) {
        setDisplay(value);
        fromRef.current = value;
        return undefined;
        }

        const start = fromRef.current;
        const change = value - start;
        if (change === 0) return undefined;

        let raf;
        let startTime = null;
        const step = (ts) => {
        if (startTime === null) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(start + change * eased);
        if (progress < 1) {
            raf = requestAnimationFrame(step);
        } else {
            fromRef.current = value;
        }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);

    return display;
    };

    // Lightweight ripple: draws a translucent circle at the click point and
    // removes it once the animation finishes. No extra re-renders needed.
    const spawnRipple = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const span = document.createElement("span");
    span.className = "cx-ripple";
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 650);
    };

    // --- Custom animated date picker for "Last Purchase Date" -------------
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const parseISODate = (val) => {
    if (!val) return null;
    const parts = String(val).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
    };

    const toISODate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
    };

    const isSameDay = (a, b) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    function DatePicker({ value, onChange, placeholder = "Select date", max }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedDate = parseISODate(value);
    const [viewDate, setViewDate] = useState(selectedDate || new Date());
    const wrapRef = useRef(null);
    const maxDate = max ? parseISODate(max) : null;
    const today = new Date();

    useEffect(() => {
        if (isOpen) setViewDate(selectedDate || new Date());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setIsOpen(false); };
        const onKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
        document.addEventListener("mousedown", onDocClick);
        window.addEventListener("keydown", onKey);
        return () => {
        document.removeEventListener("mousedown", onDocClick);
        window.removeEventListener("keydown", onKey);
        };
    }, [isOpen]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
        const d = daysInPrevMonth - startOffset + 1 + i;
        cells.push({ day: d, current: false, date: new Date(year, month - 1, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, current: true, date: new Date(year, month, d) });
    }
    let trailDay = 1;
    while (cells.length < 42) {
        cells.push({ day: trailDay, current: false, date: new Date(year, month + 1, trailDay) });
        trailDay++;
    }

    const goMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

    const pick = (date) => {
        onChange(toISODate(date));
        setIsOpen(false);
    };

    const isDisabled = (date) => !!maxDate && date > maxDate;

    return (
        <div className="cx-datepicker" ref={wrapRef}>
        <button
            type="button"
            className={`cx-input cx-date-trigger ${isOpen ? "open" : ""}`}
            onClick={() => setIsOpen(o => !o)}
        >
            <span className={value ? "cx-date-value" : "cx-date-placeholder"}>
            {value ? fmtDate(value) : placeholder}
            </span>
            <span className={`cx-date-icon ${isOpen ? "open" : ""}`}>📅</span>
        </button>

        {isOpen && (
            <div className="cx-date-pop" role="dialog" aria-label="Choose a date">
            <div className="cx-date-pop-head">
                <button type="button" className="cx-date-nav" onMouseDown={spawnRipple} onClick={() => goMonth(-1)} aria-label="Previous month">‹</button>
                <span className="cx-date-pop-title">{MONTH_NAMES[month]} {year}</span>
                <button type="button" className="cx-date-nav" onMouseDown={spawnRipple} onClick={() => goMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="cx-date-weekdays">
                {WEEKDAY_LABELS.map(w => <span key={w}>{w}</span>)}
            </div>
            <div className="cx-date-grid">
                {cells.map((c, i) => {
                const selected = isSameDay(c.date, selectedDate);
                const isToday = isSameDay(c.date, today);
                const disabled = isDisabled(c.date);
                return (
                    <button
                    type="button"
                    key={i}
                    disabled={disabled}
                    className={[
                        "cx-date-cell",
                        !c.current && "muted",
                        selected && "selected",
                        isToday && !selected && "today",
                        disabled && "disabled"
                    ].filter(Boolean).join(" ")}
                    style={{ animationDelay: `${Math.min(i, 24) * 0.012}s` }}
                    onClick={() => pick(c.date)}
                    >
                    {c.day}
                    </button>
                );
                })}
            </div>
            <div className="cx-date-pop-footer">
                <button type="button" className="cx-date-today-btn" onClick={() => pick(today)}>Today</button>
                {value && <button type="button" className="cx-date-clear-btn" onClick={() => { onChange(""); setIsOpen(false); }}>Clear</button>}
            </div>
            </div>
        )}
        </div>
    );
    }

    export default function Customers() {
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);

    const [activeTab, setActiveTab] = useState("all"); // all | frequent | nearby | priority
    const [searchQuery, setSearchQuery] = useState("");

    const [frequentThreshold, setFrequentThreshold] = useState(DEFAULT_FREQUENT_THRESHOLD);
    const [nearbyKm, setNearbyKm] = useState(DEFAULT_NEARBY_KM);

    const [expandedId, setExpandedId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Escape closes the delete-confirmation dialog.
    useEffect(() => {
        if (!confirmDeleteId) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setConfirmDeleteId(null); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirmDeleteId]);

    const addToast = useCallback((type, message) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts(prev => [{ id, type, message }, ...prev]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
    }, []);

    const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const flashHighlight = (id) => {
        setHighlightId(id);
        setTimeout(() => setHighlightId(prev => (prev === id ? null : prev)), 2200);
    };

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
        const res = await api.get("/customers");
        setCustomers(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
        console.error("Failed to fetch customers", error);
        addToast("error", "Couldn't load customers. Check your connection and retry.");
        } finally {
        setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData(EMPTY_FORM);
        setEditingId(null);
    };

    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        gstin: customer.gstin || "",
        address: customer.address || "",
        state: customer.state || "",
        state_code: customer.state_code || "",
        place_of_supply: customer.place_of_supply || "",
        area: customer.area || "",
        distance_km: customer.distance_km ?? "",
        total_orders: customer.total_orders ?? "",
        total_spent: customer.total_spent ?? "",
        last_purchase_date: customer.last_purchase_date ? String(customer.last_purchase_date).split("T")[0] : "",
        notes: customer.notes || ""
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const requestDelete = (id) => setConfirmDeleteId(id);
    const cancelDelete = () => setConfirmDeleteId(null);

    const confirmDelete = async () => {
        const id = confirmDeleteId;
        if (!id) return;
        try {
        await api.delete(`/customers/${id}`);
        setCustomers(prev => prev.filter(c => c.id !== id));
        if (editingId === id) resetForm();
        if (expandedId === id) setExpandedId(null);
        addToast("success", "Customer removed.");
        } catch (error) {
        console.error("Failed to delete customer", error);
        addToast("error", "Failed to delete customer record.");
        } finally {
        setConfirmDeleteId(null);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.phone.trim()) {
        addToast("error", "Name and phone number are required.");
        return;
        }

        const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        gstin: formData.gstin.trim() || null,
        address: formData.address.trim() || null,
        state: formData.state.trim() || null,
        state_code: formData.state_code.trim() || null,
        place_of_supply: formData.place_of_supply.trim() || null,
        area: formData.area.trim() || null,
        distance_km: formData.distance_km === "" ? null : Number(formData.distance_km),
        total_orders: formData.total_orders === "" ? 0 : Number(formData.total_orders),
        total_spent: formData.total_spent === "" ? 0 : Number(formData.total_spent),
        last_purchase_date: formData.last_purchase_date || null,
        notes: formData.notes.trim() || null
        };

        setIsSaving(true);
        try {
        if (editingId) {
            const res = await api.put(`/customers/${editingId}`, payload);
            setCustomers(prev => prev.map(c => (c.id === editingId ? (res.data || { ...c, ...payload }) : c)));
            addToast("success", "Customer updated.");
            flashHighlight(editingId);
        } else {
            const res = await api.post("/customers", payload);
            const created = res.data && res.data.id ? res.data : { id: Date.now(), ...payload };
            setCustomers(prev => [created, ...prev]);
            addToast("success", "Customer added.");
            flashHighlight(created.id);
        }
        resetForm();
        } catch (error) {
        console.error("Failed to save customer", error);
        addToast("error", "Failed to save customer record.");
        } finally {
        setIsSaving(false);
        }
    };

    const fieldChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    // Selecting a state fills in its GST code automatically, and defaults
    // Place of Supply to the same state unless the seller already typed one.
    const stateChange = (value) => {
        setFormData(prev => ({
        ...prev,
        state: value,
        state_code: STATE_CODE_MAP[value] || prev.state_code,
        place_of_supply: prev.place_of_supply ? prev.place_of_supply : value
        }));
    };

    const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id));

    // Sends a saved customer's buyer details to the Invoice Generator page and
    // jumps there. Data goes both in router state (for an immediate mount) and
    // localStorage (so it survives a refresh/direct link on the invoice page).
    const useForInvoice = (customer) => {
        const buyer = {
        name: customer.name || "",
        phone: customer.phone || "",
        gstin: customer.gstin || "",
        address: customer.address || "",
        state: customer.state || "",
        state_code: customer.state_code || "",
        place_of_supply: customer.place_of_supply || customer.state || "",
        customer_id: customer.id
        };
        try {
        localStorage.setItem(INVOICE_AUTOFILL_KEY, JSON.stringify(buyer));
        } catch (err) {
        console.error("Could not cache buyer details for invoice autofill", err);
        }
        addToast("success", `Loading ${customer.name || "customer"} into the invoice…`);
        navigate("/invoice-generator", { state: { buyer } });
    };

    // --- Derived segments ---
    const decorated = useMemo(() => {
        return customers.map(c => ({
        ...c,
        isFrequent: (Number(c.total_orders) || 0) >= frequentThreshold,
        isNearby: c.distance_km !== null && c.distance_km !== undefined && c.distance_km !== "" && Number(c.distance_km) <= nearbyKm,
        score: priorityScore(c)
        }));
    }, [customers, frequentThreshold, nearbyKm]);

    const stats = useMemo(() => {
        const frequent = decorated.filter(c => c.isFrequent).length;
        const nearby = decorated.filter(c => c.isNearby).length;
        const priority = decorated.filter(c => c.isFrequent && c.isNearby).length;
        const lifetimeValue = decorated.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0);
        return { total: decorated.length, frequent, nearby, priority, lifetimeValue };
    }, [decorated]);

    const totalDisplay = useCountUp(stats.total);
    const frequentDisplay = useCountUp(stats.frequent);
    const nearbyDisplay = useCountUp(stats.nearby);
    const moneyDisplay = useCountUp(stats.lifetimeValue, 900);

    const filtered = useMemo(() => {
        let list = decorated;

        if (activeTab === "frequent") list = list.filter(c => c.isFrequent);
        else if (activeTab === "nearby") list = list.filter(c => c.isNearby);
        else if (activeTab === "priority") list = list.filter(c => c.isFrequent && c.isNearby);

        const q = searchQuery.trim().toLowerCase();
        if (q) {
        list = list.filter(c =>
            String(c.name || "").toLowerCase().includes(q) ||
            String(c.phone || "").toLowerCase().includes(q) ||
            String(c.area || "").toLowerCase().includes(q) ||
            String(c.gstin || "").toLowerCase().includes(q) ||
            String(c.state || "").toLowerCase().includes(q)
        );
        }

        // Default ordering surfaces the exact audience this page exists for:
        // frequent buyers who are also close by, first.
        return [...list].sort((a, b) => b.score - a.score);
    }, [decorated, activeTab, searchQuery]);

    const TABS = [
        { id: "all", label: "All Customers", count: stats.total },
        { id: "frequent", label: "🔥 Frequent", count: stats.frequent },
        { id: "nearby", label: "📍 Nearby", count: stats.nearby },
        { id: "priority", label: "⭐ Priority", count: stats.priority }
    ];

    const customerToDelete = customers.find(c => c.id === confirmDeleteId);

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
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #f1f5f9;
            margin: 0;
            min-height: 100vh;
            }

            .mono { font-family: 'JetBrains Mono', monospace; }
            .heading-font { font-family: 'Sora', 'Plus Jakarta Sans', sans-serif; }

            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes rowIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes stampIn { 0% { opacity: 0; transform: scale(1.5) rotate(-10deg); } 60% { opacity: 1; transform: scale(0.94) rotate(-4deg); } 100% { opacity: 1; transform: scale(1) rotate(-4deg); } }
            @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.45); } 50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, 0); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }
            @keyframes starPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
            @keyframes blobFloatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(60px, 40px) scale(1.15); } }
            @keyframes blobFloatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-50px, -30px) scale(1.1); } }
            @keyframes toastIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes toastShrink { from { width: 100%; } to { width: 0%; } }
            @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes rippleAnim { to { transform: scale(1); opacity: 0; } }
            @keyframes rowHighlight { 0% { background: rgba(56, 189, 248, 0.22); } 100% { background: transparent; } }
            @keyframes detailIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

            .cx-bg { position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; }
            .cx-blob { position: absolute; width: 520px; height: 520px; border-radius: 50%; filter: blur(120px); opacity: 0.16; }
            .cx-blob-a { background: var(--sky); top: -140px; left: -120px; animation: blobFloatA 22s ease-in-out infinite; }
            .cx-blob-b { background: var(--violet); bottom: -160px; right: -100px; animation: blobFloatB 26s ease-in-out infinite; }

            .cx-container { position: relative; z-index: 1; max-width: 1300px; margin: 0 auto; padding: 40px 24px 80px; }

            .cx-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; flex-wrap: wrap; gap: 14px; animation: fadeInUp 0.5s ease both; }
            .cx-header-left { display: flex; align-items: center; gap: 16px; }
            .cx-back-btn { position: relative; overflow: hidden; background: var(--panel); border: 1px solid var(--panel-border); color: white; width: 42px; height: 42px; border-radius: 50%; cursor: pointer; font-size: 1.05rem; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
            .cx-back-btn:hover { background: var(--panel-strong); transform: translateX(-3px); }
            .cx-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 3px; }
            .cx-title { margin: 0; font-family: 'Sora', sans-serif; font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(120deg, #fff 30%, var(--sky) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }

            .cx-settings { display: flex; align-items: center; gap: 14px; font-size: 12px; color: #94a3b8; background: var(--panel); border: 1px solid var(--panel-border); padding: 8px 16px; border-radius: 12px; }
            .cx-settings label { display: flex; align-items: center; gap: 6px; }
            .cx-settings input { width: 48px; background: rgba(0,0,0,0.35); border: 1px solid var(--panel-border); color: #f1f5f9; border-radius: 6px; padding: 3px 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: center; }
            .cx-settings input:focus { outline: none; border-color: var(--sky); }

            .cx-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
            .cx-stat-card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 14px; padding: 16px 18px; animation: fadeInUp 0.5s ease both; transition: 0.25s; }
            .cx-stat-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.16); }
            .cx-stat-card { position: relative; overflow: hidden; }
            .cx-stat-card::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(120deg, transparent, rgba(255,255,255,0.08), transparent); transform: skewX(-20deg); transition: left 0.7s ease; pointer-events: none; }
            .cx-stat-card:hover::after { left: 130%; }
            .cx-stat-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
            .cx-stat-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; background: rgba(255,255,255,0.06); flex-shrink: 0; }
            .cx-stat-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 0; }
            .cx-stat-value { font-family: 'JetBrains Mono', monospace; font-size: 1.35rem; font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
            .cx-stat-total .cx-stat-value { color: #f1f5f9; }
            .cx-stat-frequent .cx-stat-value { color: var(--amber); }
            .cx-stat-nearby .cx-stat-value { color: var(--sky); }
            .cx-stat-value-money { color: var(--emerald); }

            .cx-grid { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }

            .cx-card { background: linear-gradient(160deg, rgba(30,41,59,0.5), rgba(15,23,42,0.75)); border: 1px solid var(--panel-border); border-radius: 18px; padding: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.4); }
            .cx-card-sticky { position: sticky; top: 24px; }
            .cx-card-title { margin: 0 0 18px; font-family: 'Sora', sans-serif; font-size: 1.02rem; font-weight: 700; color: var(--sky); display: flex; align-items: center; gap: 9px; justify-content: space-between; }
            .cx-card-title .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sky); animation: pulseGlow 2.4s ease-in-out infinite; flex-shrink: 0; }
            .cx-card-title-left { display: flex; align-items: center; gap: 9px; }
            .cx-cancel-edit { background: none; border: none; color: #64748b; font-size: 11.5px; cursor: pointer; text-decoration: underline; font-family: inherit; }
            .cx-cancel-edit:hover { color: #f1f5f9; }

            .cx-form-section { margin: 4px 0 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sky); }
            .cx-form-section:not(:first-child) { margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--panel-border); }
            .cx-field { margin-bottom: 14px; }
            .cx-field:last-of-type { margin-bottom: 0; }
            .cx-label { display: block; font-size: 10.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
            .cx-input {
            width: 100%; background: rgba(0,0,0,0.35); border: 1px solid var(--panel-border); color: white;
            font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; padding: 11px 13px; border-radius: 9px;
            outline: none; transition: 0.2s;
            }
            .cx-input::placeholder { color: #475569; }
            .cx-input:focus { border-color: var(--sky); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18); }
            .cx-input textarea, textarea.cx-input { resize: vertical; min-height: 60px; font-family: inherit; }
            .cx-row-split { display: flex; gap: 10px; }
            .cx-row-split .cx-field { flex: 1; }

            /* --- Animated Date Picker --- */
            .cx-datepicker { position: relative; }
            .cx-date-trigger {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            cursor: pointer; text-align: left; font-family: inherit;
            }
            .cx-date-trigger:hover { border-color: rgba(255,255,255,0.22); }
            .cx-date-trigger.open { border-color: var(--sky); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18); }
            .cx-date-value { color: #f1f5f9; }
            .cx-date-placeholder { color: #475569; }
            .cx-date-icon { font-size: 13px; opacity: 0.75; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); flex-shrink: 0; }
            .cx-date-icon.open { transform: rotate(-12deg) scale(1.15); opacity: 1; }

            .cx-date-pop {
            position: absolute; top: calc(100% + 8px); left: 0; z-index: 40; width: 268px;
            background: linear-gradient(165deg, rgba(30,41,59,0.98), rgba(10,15,26,0.99));
            border: 1px solid var(--panel-border); border-radius: 14px; padding: 14px;
            box-shadow: 0 20px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.06);
            animation: datePopIn 0.22s cubic-bezier(0.16,1,0.3,1) both;
            transform-origin: top left;
            }
            @keyframes datePopIn { from { opacity: 0; transform: scale(0.92) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes dateCellIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

            .cx-date-pop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
            .cx-date-pop-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 12.5px; color: #f1f5f9; letter-spacing: 0.02em; }
            .cx-date-nav {
            position: relative; overflow: hidden;
            width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--panel-border); background: var(--panel);
            color: #94a3b8; cursor: pointer; font-size: 15px; line-height: 1; display: flex; align-items: center; justify-content: center;
            transition: 0.2s;
            }
            .cx-date-nav:hover { color: var(--sky); border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.1); transform: scale(1.08); }

            .cx-date-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
            .cx-date-weekdays span { text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; padding: 4px 0; }

            .cx-date-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
            .cx-date-cell {
            position: relative; aspect-ratio: 1; border: none; background: transparent; color: #cbd5e1;
            font-family: 'JetBrains Mono', monospace; font-size: 12px; border-radius: 8px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
            animation: dateCellIn 0.25s ease both;
            }
            .cx-date-cell:hover:not(.disabled) { background: rgba(56, 189, 248, 0.14); color: #f1f5f9; transform: scale(1.1); }
            .cx-date-cell.muted { color: #334155; }
            .cx-date-cell.today { color: var(--sky); font-weight: 700; }
            .cx-date-cell.today::after { content: ""; position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; background: var(--sky); animation: starPulse 1.6s ease-in-out infinite; }
            .cx-date-cell.selected { background: linear-gradient(135deg, #38bdf8, #0284c7); color: #04121c; font-weight: 800; box-shadow: 0 4px 14px rgba(56,189,248,0.45); }
            .cx-date-cell.selected:hover { transform: scale(1.1); }
            .cx-date-cell.disabled { color: #1e293b; cursor: not-allowed; }

            .cx-date-pop-footer { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--panel-border); }
            .cx-date-today-btn, .cx-date-clear-btn { background: none; border: none; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: 0.2s; }
            .cx-date-today-btn { color: var(--sky); }
            .cx-date-today-btn:hover { background: rgba(56,189,248,0.12); }
            .cx-date-clear-btn { color: #64748b; }
            .cx-date-clear-btn:hover { color: var(--rose); background: rgba(251,113,133,0.1); }

            .cx-save-btn {
            position: relative; overflow: hidden;
            width: 100%; background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); background-size: 160% 160%;
            color: #04121c; border: none; padding: 13px; margin-top: 8px; border-radius: 10px; font-family: inherit;
            font-size: 13.5px; font-weight: 800; cursor: pointer; transition: 0.25s; display: flex; align-items: center;
            justify-content: center; gap: 9px;
            }
            .cx-save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(56,189,248,0.35); background-position: 100% 0; }
            .cx-save-btn:disabled { opacity: 0.7; cursor: default; }
            .cx-spinner { width: 14px; height: 14px; border: 2px solid rgba(4,18,28,0.35); border-top-color: #04121c; border-radius: 50%; animation: spin 0.7s linear infinite; }

            .cx-tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
            .cx-tab {
            position: relative; overflow: hidden;
            background: var(--panel); border: 1px solid var(--panel-border); color: #94a3b8; padding: 9px 16px;
            border-radius: 999px; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: 0.2s;
            display: flex; align-items: center; gap: 7px; font-family: inherit;
            }
            .cx-tab:hover { color: #f1f5f9; border-color: rgba(255,255,255,0.2); }
            .cx-tab.active { background: rgba(56, 189, 248, 0.14); border-color: var(--sky); color: var(--sky); }
            .cx-tab-count { background: rgba(255,255,255,0.08); padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-family: 'JetBrains Mono', monospace; transition: 0.2s; }
            .cx-tab.active .cx-tab-count { background: rgba(56,189,248,0.25); }

            .cx-search-row { margin-bottom: 18px; }
            .cx-search-wrap { position: relative; }
            .cx-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 13px; opacity: 0.6; }
            .cx-search-input {
            width: 100%; background: var(--panel); border: 1px solid var(--panel-border); color: white;
            font-family: inherit; font-size: 13.5px; padding: 12px 34px 12px 38px; border-radius: 12px; outline: none; transition: 0.2s;
            }
            .cx-search-input:focus { border-color: var(--sky); box-shadow: 0 0 0 3px rgba(56,189,248,0.15); }
            .cx-clear-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; font-size: 13px; padding: 4px 6px; border-radius: 6px; transition: 0.15s; line-height: 1; }
            .cx-clear-btn:hover { color: #f1f5f9; background: rgba(255,255,255,0.08); }

            .cx-table-wrap { overflow-x: auto; }
            .cx-table { width: 100%; border-collapse: collapse; min-width: 720px; }
            .cx-table th { text-align: left; padding: 10px 12px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; border-bottom: 1px solid var(--panel-border); }
            .cx-table tbody tr.cx-row { animation: rowIn 0.4s ease both; transition: background 0.2s; cursor: pointer; }
            .cx-table tbody tr.cx-row:hover { background: rgba(56, 189, 248, 0.05); }
            .cx-table tbody tr.cx-row-highlight { animation: rowHighlight 2.2s ease; }
            .cx-table td { padding: 14px 12px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }

            .cx-customer-cell { display: flex; align-items: center; gap: 10px; }
            .cx-chevron { display: inline-block; color: #475569; font-size: 13px; transition: transform 0.25s ease, color 0.25s ease; flex-shrink: 0; }
            .cx-chevron.open { transform: rotate(90deg); color: var(--sky); }
            .cx-avatar { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 13px; color: #04121c; flex-shrink: 0; transition: transform 0.2s ease; }
            .cx-customer-cell:hover .cx-avatar { transform: scale(1.08) rotate(-2deg); }
            .cx-customer-name { font-weight: 700; color: #f1f5f9; }
            .cx-customer-phone { font-size: 11.5px; color: #64748b; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

            .cx-area-cell .area-name { color: #cbd5e1; }
            .cx-area-cell .area-distance { font-size: 11.5px; color: #64748b; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

            .cx-badges { display: flex; gap: 6px; flex-wrap: wrap; }
            .cx-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; padding: 4px 9px; border-radius: 999px; letter-spacing: 0.02em; animation: stampIn 0.4s ease both; }
            .cx-badge-frequent { background: rgba(251, 191, 36, 0.12); color: var(--amber); border: 1px solid rgba(251,191,36,0.35); }
            .cx-badge-nearby { background: rgba(56, 189, 248, 0.12); color: var(--sky); border: 1px solid rgba(56,189,248,0.35); }
            .cx-badge-priority { background: rgba(167, 139, 250, 0.15); color: var(--violet); border: 1px solid rgba(167,139,250,0.4); }
            .cx-badge-priority .star { display: inline-block; animation: starPulse 1.6s ease-in-out infinite; }

            .cx-actions { display: flex; gap: 6px; }
            .cx-icon-btn { position: relative; overflow: hidden; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--panel-border); background: var(--panel); color: #94a3b8; cursor: pointer; font-size: 12px; transition: 0.2s; }
            .cx-icon-btn:hover { color: #f1f5f9; border-color: rgba(255,255,255,0.25); transform: translateY(-1px); }
            .cx-icon-btn-danger:hover { color: var(--rose); border-color: rgba(251,113,133,0.4); background: rgba(251,113,133,0.1); }
            .cx-icon-btn-invoice:hover { color: var(--emerald); border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.1); }

            .cx-detail-row td { padding: 0; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.015); }
            .cx-detail-content { padding: 14px 20px 20px 62px; animation: detailIn 0.3s ease both; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
            .cx-detail-item .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; font-weight: 700; }
            .cx-detail-item .v { font-size: 13px; color: #e2e8f0; line-height: 1.5; }
            .cx-detail-invoice-btn { position: relative; overflow: hidden; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.4); color: var(--emerald); font-family: inherit; font-weight: 700; font-size: 12.5px; padding: 9px 14px; border-radius: 9px; cursor: pointer; transition: 0.2s; }
            .cx-detail-invoice-btn:hover { background: rgba(52,211,153,0.2); transform: translateY(-1px); }

            .cx-empty { text-align: center; padding: 56px 20px; animation: fadeIn 0.5s ease both; }
            .cx-empty .icon { font-size: 28px; margin-bottom: 10px; opacity: 0.7; display: inline-block; animation: floatIcon 3s ease-in-out infinite; }
            .cx-empty p { margin: 0; color: #94a3b8; font-size: 13.5px; }
            .cx-empty span { display: block; color: #64748b; font-size: 12px; margin-top: 4px; }

            .cx-skeleton-bar { height: 12px; border-radius: 4px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%); background-size: 200px 100%; animation: shimmer 1.4s infinite linear; }

            .cx-ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.4); transform: scale(0); animation: rippleAnim 0.6s ease-out; pointer-events: none; }

            .cx-toast-wrap { position: fixed; top: 20px; right: 20px; z-index: 70; display: flex; flex-direction: column; gap: 10px; width: min(320px, calc(100vw - 40px)); }
            .cx-toast { position: relative; overflow: hidden; background: linear-gradient(160deg, rgba(30,41,59,0.94), rgba(15,23,42,0.97)); border: 1px solid var(--panel-border); border-radius: 12px; padding: 12px 34px 14px 14px; font-size: 13px; color: #f1f5f9; box-shadow: 0 14px 32px rgba(0,0,0,0.45); animation: toastIn 0.35s cubic-bezier(0.16,1,0.3,1) both; display: flex; align-items: flex-start; gap: 9px; }
            .cx-toast-success { border-color: rgba(52,211,153,0.4); }
            .cx-toast-error { border-color: rgba(251,113,133,0.4); }
            .cx-toast-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
            .cx-toast-success .cx-toast-icon { color: var(--emerald); }
            .cx-toast-error .cx-toast-icon { color: var(--rose); }
            .cx-toast-close { position: absolute; top: 7px; right: 8px; background: none; border: none; color: #64748b; cursor: pointer; font-size: 12px; line-height: 1; padding: 2px; }
            .cx-toast-close:hover { color: #f1f5f9; }
            .cx-toast-bar { position: absolute; left: 0; bottom: 0; height: 2px; animation: toastShrink 3.2s linear forwards; }
            .cx-toast-success .cx-toast-bar { background: var(--emerald); }
            .cx-toast-error .cx-toast-bar { background: var(--rose); }

            .cx-modal-overlay { position: fixed; inset: 0; background: rgba(2,6,15,0.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 80; animation: fadeIn 0.2s ease both; padding: 20px; }
            .cx-modal { background: linear-gradient(160deg, rgba(30,41,59,0.96), rgba(15,23,42,0.99)); border: 1px solid var(--panel-border); border-radius: 16px; padding: 26px; max-width: 360px; width: 100%; box-shadow: 0 24px 60px rgba(0,0,0,0.5); animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both; text-align: center; }
            .cx-modal-icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(251,113,133,0.14); border: 1px solid rgba(251,113,133,0.35); display: flex; align-items: center; justify-content: center; font-size: 19px; margin: 0 auto 14px; }
            .cx-modal h4 { margin: 0 0 6px; font-family: 'Sora', sans-serif; font-size: 1.05rem; color: #f1f5f9; }
            .cx-modal p { margin: 0 0 20px; color: #94a3b8; font-size: 13px; line-height: 1.5; }
            .cx-modal-actions { display: flex; gap: 10px; }
            .cx-btn-ghost, .cx-btn-danger { position: relative; overflow: hidden; flex: 1; padding: 11px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: 0.2s; }
            .cx-btn-ghost { background: var(--panel); color: #cbd5e1; border: 1px solid var(--panel-border); }
            .cx-btn-ghost:hover { background: var(--panel-strong); }
            .cx-btn-danger { background: linear-gradient(135deg, #fb7185, #e11d48); color: white; border: none; }
            .cx-btn-danger:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(225,29,72,0.35); }

            @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
            }

            @media (max-width: 960px) {
            .cx-grid { grid-template-columns: 1fr; }
            .cx-card-sticky { position: static; }
            .cx-stats-grid { grid-template-columns: 1fr 1fr; }
            }
            @media (max-width: 560px) {
            .cx-stats-grid { grid-template-columns: 1fr; }
            .cx-detail-content { padding-left: 20px; }
            }
        `}</style>

        <div className="cx-bg" aria-hidden="true">
            <div className="cx-blob cx-blob-a" />
            <div className="cx-blob cx-blob-b" />
        </div>

        {toasts.length > 0 && (
            <div className="cx-toast-wrap" role="status" aria-live="polite">
            {toasts.map(t => (
                <div key={t.id} className={`cx-toast cx-toast-${t.type}`}>
                <span className="cx-toast-icon">{t.type === "success" ? "✓" : "⚠"}</span>
                <span>{t.message}</span>
                <button type="button" className="cx-toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">✕</button>
                <span className="cx-toast-bar" />
                </div>
            ))}
            </div>
        )}

        {confirmDeleteId && (
            <div className="cx-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelDelete(); }}>
            <div className="cx-modal" role="alertdialog" aria-modal="true" aria-labelledby="cx-modal-title">
                <div className="cx-modal-icon">🗑️</div>
                <h4 id="cx-modal-title">Remove this customer?</h4>
                <p>{customerToDelete ? `${customerToDelete.name}'s record` : "This record"} will be permanently deleted. This can't be undone.</p>
                <div className="cx-modal-actions">
                <button type="button" className="cx-btn-ghost" onMouseDown={spawnRipple} onClick={cancelDelete}>Cancel</button>
                <button type="button" className="cx-btn-danger" onMouseDown={spawnRipple} onClick={confirmDelete}>Delete</button>
                </div>
            </div>
            </div>
        )}

        <div className="cx-container">
            <div className="cx-header-row">
            <div className="cx-header-left">
                <button className="cx-back-btn" onMouseDown={spawnRipple} onClick={() => navigate("/")} aria-label="Back">←</button>
                <div>
                <p className="cx-eyebrow">CRM · Local Buyers</p>
                <h1 className="cx-title heading-font">Customer Directory</h1>
                </div>
            </div>

            <div className="cx-settings">
                <label>
                🔥 Frequent ≥
                <input
                    type="number"
                    min="1"
                    value={frequentThreshold}
                    onChange={(e) => setFrequentThreshold(Math.max(1, Number(e.target.value) || 1))}
                />
                orders
                </label>
                <label>
                📍 Nearby ≤
                <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={nearbyKm}
                    onChange={(e) => setNearbyKm(Math.max(0, Number(e.target.value) || 0))}
                />
                km
                </label>
            </div>
            </div>

            <div className="cx-stats-grid">
            <div className="cx-stat-card cx-stat-total" style={{ animationDelay: "0.05s" }}>
                <div className="cx-stat-head">
                <p className="cx-stat-label">Total Customers</p>
                <span className="cx-stat-icon">🧑‍🤝‍🧑</span>
                </div>
                <p className="cx-stat-value">{Math.round(totalDisplay)}</p>
            </div>
            <div className="cx-stat-card cx-stat-frequent" style={{ animationDelay: "0.1s" }}>
                <div className="cx-stat-head">
                <p className="cx-stat-label">Frequent Buyers</p>
                <span className="cx-stat-icon">🔥</span>
                </div>
                <p className="cx-stat-value">{Math.round(frequentDisplay)}</p>
            </div>
            <div className="cx-stat-card cx-stat-nearby" style={{ animationDelay: "0.15s" }}>
                <div className="cx-stat-head">
                <p className="cx-stat-label">Within {nearbyKm}km</p>
                <span className="cx-stat-icon">📍</span>
                </div>
                <p className="cx-stat-value">{Math.round(nearbyDisplay)}</p>
            </div>
            <div className="cx-stat-card" style={{ animationDelay: "0.2s" }}>
                <div className="cx-stat-head">
                <p className="cx-stat-label">Lifetime Value</p>
                <span className="cx-stat-icon">💰</span>
                </div>
                <p className="cx-stat-value cx-stat-value-money">{fmtCurrency(Math.round(moneyDisplay))}</p>
            </div>
            </div>

            <div className="cx-grid">
            {/* Add / Edit form */}
            <div className="cx-card cx-card-sticky" style={{ animation: "fadeInUp 0.5s ease 0.1s both" }}>
                <h3 className="cx-card-title">
                <span className="cx-card-title-left"><span className="dot" />{editingId ? "Edit Customer" : "Add Customer"}</span>
                {editingId && <button type="button" className="cx-cancel-edit" onClick={resetForm}>Cancel</button>}
                </h3>

                <form onSubmit={handleSave}>
                <p className="cx-form-section">Buyer (Bill To) Details</p>

                <div className="cx-field">
                    <label className="cx-label">Client Name</label>
                    <input className="cx-input" placeholder="e.g. Rina Sharma" value={formData.name} onChange={e => fieldChange("name", e.target.value)} />
                </div>

                <div className="cx-row-split">
                    <div className="cx-field">
                    <label className="cx-label">Mobile Number</label>
                    <input className="cx-input" placeholder="98XXXXXXXX" value={formData.phone} onChange={e => fieldChange("phone", e.target.value)} />
                    </div>
                    <div className="cx-field">
                    <label className="cx-label">GSTIN</label>
                    <input
                        className="cx-input"
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        value={formData.gstin}
                        onChange={e => fieldChange("gstin", e.target.value.toUpperCase())}
                    />
                    </div>
                </div>

                <div className="cx-field">
                    <label className="cx-label">Client Address</label>
                    <input className="cx-input" placeholder="Street, landmark" value={formData.address} onChange={e => fieldChange("address", e.target.value)} />
                </div>

                <div className="cx-row-split">
                    <div className="cx-field">
                    <label className="cx-label">Client State</label>
                    <input
                        className="cx-input"
                        list="cx-state-list"
                        placeholder="e.g. West Bengal"
                        value={formData.state}
                        onChange={e => stateChange(e.target.value)}
                    />
                    <datalist id="cx-state-list">
                        {Object.keys(STATE_CODE_MAP).map(s => <option key={s} value={s} />)}
                    </datalist>
                    </div>
                    <div className="cx-field">
                    <label className="cx-label">State Code</label>
                    <input className="cx-input" placeholder="19" maxLength={2} value={formData.state_code} onChange={e => fieldChange("state_code", e.target.value)} />
                    </div>
                </div>

                <div className="cx-field">
                    <label className="cx-label">Place of Supply</label>
                    <input className="cx-input" placeholder="e.g. West Bengal" value={formData.place_of_supply} onChange={e => fieldChange("place_of_supply", e.target.value)} />
                </div>

                <p className="cx-form-section">Other Details</p>

                <div className="cx-field">
                    <label className="cx-label">Email (optional)</label>
                    <input className="cx-input" placeholder="name@example.com" value={formData.email} onChange={e => fieldChange("email", e.target.value)} />
                </div>

                <div className="cx-row-split">
                    <div className="cx-field">
                    <label className="cx-label">Area / Locality</label>
                    <input className="cx-input" placeholder="e.g. Salt Lake" value={formData.area} onChange={e => fieldChange("area", e.target.value)} />
                    </div>
                    <div className="cx-field">
                    <label className="cx-label">Distance (km)</label>
                    <input type="number" min="0" step="0.1" className="cx-input" placeholder="2.5" value={formData.distance_km} onChange={e => fieldChange("distance_km", e.target.value)} />
                    </div>
                </div>

                <div className="cx-row-split">
                    <div className="cx-field">
                    <label className="cx-label">Total Orders</label>
                    <input type="number" min="0" className="cx-input" placeholder="0" value={formData.total_orders} onChange={e => fieldChange("total_orders", e.target.value)} />
                    </div>
                    <div className="cx-field">
                    <label className="cx-label">Lifetime Spend (₹)</label>
                    <input type="number" min="0" className="cx-input" placeholder="0" value={formData.total_spent} onChange={e => fieldChange("total_spent", e.target.value)} />
                    </div>
                </div>

                <div className="cx-field">
                    <label className="cx-label">Last Purchase Date</label>
                    <DatePicker
                    value={formData.last_purchase_date}
                    onChange={val => fieldChange("last_purchase_date", val)}
                    max={new Date().toISOString().split("T")[0]}
                    />
                </div>

                <div className="cx-field">
                    <label className="cx-label">Notes</label>
                    <textarea className="cx-input" placeholder="Preferences, follow-up reminders…" value={formData.notes} onChange={e => fieldChange("notes", e.target.value)} />
                </div>

                <button type="submit" className="cx-save-btn" onMouseDown={spawnRipple} disabled={isSaving}>
                    {isSaving ? (<><span className="cx-spinner" />Saving…</>) : (editingId ? "💾 Update Customer" : "➕ Add Customer")}
                </button>
                </form>
            </div>

            {/* List */}
            <div className="cx-card" style={{ animation: "fadeInUp 0.5s ease 0.15s both" }}>
                <div className="cx-tabs">
                {TABS.map(tab => (
                    <button
                    key={tab.id}
                    type="button"
                    className={`cx-tab ${activeTab === tab.id ? "active" : ""}`}
                    onMouseDown={spawnRipple}
                    onClick={() => setActiveTab(tab.id)}
                    >
                    {tab.label} <span className="cx-tab-count">{tab.count}</span>
                    </button>
                ))}
                </div>

                <div className="cx-search-row">
                <div className="cx-search-wrap">
                    <span className="cx-search-icon">🔍</span>
                    <input
                    className="cx-search-input"
                    placeholder="Search by name, phone, or area…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                    <button type="button" className="cx-clear-btn" onClick={() => setSearchQuery("")} aria-label="Clear search">✕</button>
                    )}
                </div>
                </div>

                <div className="cx-table-wrap">
                <table className="cx-table">
                    <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Area / Distance</th>
                        <th>Orders</th>
                        <th>Lifetime Spend</th>
                        <th>Last Purchase</th>
                        <th>Segment</th>
                        <th>Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading && [...Array(4)].map((_, i) => (
                        <tr key={`sk-${i}`}>
                        {[...Array(7)].map((__, j) => (
                            <td key={j}><div className="cx-skeleton-bar" style={{ width: j === 0 ? "80%" : "60%" }} /></td>
                        ))}
                        </tr>
                    ))}

                    {!isLoading && filtered.map((c, i) => {
                        const isExpanded = expandedId === c.id;
                        const hasDetails = c.email || c.address || c.notes;
                        return (
                        <React.Fragment key={c.id}>
                            <tr
                            className={`cx-row ${highlightId === c.id ? "cx-row-highlight" : ""}`}
                            style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                            onClick={() => toggleExpand(c.id)}
                            >
                            <td>
                                <div className="cx-customer-cell">
                                <span className={`cx-chevron ${isExpanded ? "open" : ""}`}>{hasDetails ? "›" : ""}</span>
                                <div className="cx-avatar" style={{ background: avatarGradient(c.name) }}>{getInitials(c.name)}</div>
                                <div>
                                    <div className="cx-customer-name">{c.name}</div>
                                    <div className="cx-customer-phone">{c.phone}</div>
                                </div>
                                </div>
                            </td>
                            <td className="cx-area-cell">
                                <div className="area-name">{c.area || "—"}</div>
                                <div className="area-distance">{fmtDistance(c.distance_km)} away</div>
                            </td>
                            <td className="mono">{Number(c.total_orders) || 0}</td>
                            <td className="mono">{fmtCurrency(c.total_spent)}</td>
                            <td>{fmtDate(c.last_purchase_date)}</td>
                            <td>
                                <div className="cx-badges">
                                {c.isFrequent && c.isNearby && (
                                    <span className="cx-badge cx-badge-priority"><span className="star">⭐</span>Priority</span>
                                )}
                                {c.isFrequent && !(c.isFrequent && c.isNearby) && <span className="cx-badge cx-badge-frequent">🔥 Frequent</span>}
                                {c.isNearby && !(c.isFrequent && c.isNearby) && <span className="cx-badge cx-badge-nearby">📍 Nearby</span>}
                                {!c.isFrequent && !c.isNearby && <span style={{ color: "#475569", fontSize: "11.5px" }}>—</span>}
                                </div>
                            </td>
                            <td>
                                <div className="cx-actions">
                                <button className="cx-icon-btn cx-icon-btn-invoice" onMouseDown={spawnRipple} onClick={(e) => { e.stopPropagation(); useForInvoice(c); }} title="Create invoice for this customer" aria-label="Create invoice">🧾</button>
                                <button className="cx-icon-btn" onMouseDown={spawnRipple} onClick={(e) => { e.stopPropagation(); handleEdit(c); }} title="Edit" aria-label="Edit customer">✎</button>
                                <button className="cx-icon-btn cx-icon-btn-danger" onMouseDown={spawnRipple} onClick={(e) => { e.stopPropagation(); requestDelete(c.id); }} title="Delete" aria-label="Delete customer">✕</button>
                                </div>
                            </td>
                            </tr>
                            {isExpanded && (
                            <tr className="cx-detail-row">
                                <td colSpan="7">
                                <div className="cx-detail-content">
                                    <div className="cx-detail-item">
                                    <div className="k">GSTIN</div>
                                    <div className="v mono">{c.gstin || "—"}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <div className="k">Email</div>
                                    <div className="v">{c.email || "—"}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <div className="k">Address</div>
                                    <div className="v">{c.address || "—"}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <div className="k">State / Code</div>
                                    <div className="v">{c.state ? `${c.state}${c.state_code ? ` (${c.state_code})` : ""}` : "—"}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <div className="k">Place of Supply</div>
                                    <div className="v">{c.place_of_supply || "—"}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <div className="k">Notes</div>
                                    <div className="v">{c.notes || "No additional notes."}</div>
                                    </div>
                                    <div className="cx-detail-item">
                                    <button
                                        type="button"
                                        className="cx-detail-invoice-btn"
                                        onMouseDown={spawnRipple}
                                        onClick={(e) => { e.stopPropagation(); useForInvoice(c); }}
                                    >
                                        🧾 Create Invoice for {c.name || "customer"}
                                    </button>
                                    </div>
                                </div>
                                </td>
                            </tr>
                            )}
                        </React.Fragment>
                        );
                    })}

                    {!isLoading && filtered.length === 0 && (
                        <tr>
                        <td colSpan="7">
                            <div className="cx-empty">
                            <div className="icon">🧑‍🤝‍🧑</div>
                            <p>{customers.length === 0 ? "No customers logged yet." : "No customers match this filter."}</p>
                            <span>{customers.length === 0 ? "Add your first customer using the form on the left." : "Try a different tab or search term."}</span>
                            </div>
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
            </div>
        </div>
        </>
    );
    }