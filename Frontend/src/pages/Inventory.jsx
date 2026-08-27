import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const GST_SLABS = [0, 5, 12, 18, 28];
const EMPTY_FORM = {
  product_name: "",
  hsn_code: "",
  unit: "Pcs",
  purchase_price: "",
  selling_price: "",
  stock_quantity: "",
  gst_rate: 18,
};

// Snap a raw GST guess to the nearest real Indian GST slab — receipts often
// print odd rounding (e.g. 17.5, 18.02) that shouldn't be trusted verbatim.
function nearestGstSlab(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 18;
  return GST_SLABS.reduce((best, slab) =>
    Math.abs(slab - n) < Math.abs(best - n) ? slab : best
  , GST_SLABS[0]);
}

function round2(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

let tempIdCounter = 0;
function nextTempId() {
  tempIdCounter += 1;
  return `tmp-${Date.now()}-${tempIdCounter}`;
}

export default function InventoryManager() {
  const navigate = useNavigate();
  const [inventoryList, setInventoryList] = useState([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all | low
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [entryMode, setEntryMode] = useState("ai"); // ai | manual
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [updateStockData, setUpdateStockData] = useState({});

  // Staged items pulled from a scanned receipt, awaiting human confirmation
  // before anything is written to the database.
  const [reviewItems, setReviewItems] = useState(null); // null = no scan pending

  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    fetchInventory();
  }, []);

  const pushToast = (message, type = "info") => {
    const id = nextTempId();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  };

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/inventory");
      setInventoryList(res.data);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
      pushToast("Couldn't load inventory. Check your connection.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!formData.product_name.trim() || !formData.selling_price) {
      pushToast("Product name and selling price are required.", "error");
      return;
    }

    try {
      await api.post("/inventory", {
        ...formData,
        product_name: formData.product_name.trim(),
        purchase_price: Number(formData.purchase_price || 0),
        selling_price: Number(formData.selling_price),
        stock_quantity: Number(formData.stock_quantity || 0),
        gst_rate: Number(formData.gst_rate),
      });

      setFormData(EMPTY_FORM);
      pushToast(`"${formData.product_name.trim()}" added to inventory.`, "success");
      fetchInventory();
    } catch (error) {
      console.error("Failed to add product", error);
      pushToast("Failed to add product.", "error");
    }
  };

  const handleStockUpdate = async (id) => {
    const newQty = updateStockData[id];
    if (newQty === undefined || newQty === "") return;

    try {
      await api.put(`/inventory/${id}?quantity=${newQty}`);
      setUpdateStockData({ ...updateStockData, [id]: "" });
      pushToast("Stock level updated.", "success");
      fetchInventory();
    } catch (error) {
      console.error("Failed to update stock", error);
      pushToast("Failed to update stock.", "error");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    try {
      await api.delete(`/inventory/${id}`);
      pushToast("Product deleted.", "success");
      fetchInventory();
    } catch (error) {
      console.error("Failed to delete product", error);
      pushToast("Failed to delete product. Check it isn't linked to existing invoices.", "error");
    }
  };

  // ---- Smart Receipt OCR: scan, then stage for human review ----
  // The old flow wrote every extracted line straight to the database, so a
  // single misread digit became bad stock data with no chance to catch it.
  // Now a scan only ever populates an editable review queue; nothing is
  // saved until the user confirms each row (or removes/fixes it first).
  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const res = await api.post("/ocr/receipt", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success && Array.isArray(res.data.items) && res.data.items.length > 0) {
        const staged = res.data.items.map((item) => {
          const purchase = round2(item.price || 0);
          const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
          const name = (item.description || "").trim() || "Scanned item";
          return {
            _tempId: nextTempId(),
            selected: true,
            product_name: name,
            hsn_code: (item.hsn_code || "").trim(),
            unit: (item.unit || "Pcs").trim() || "Pcs",
            purchase_price: purchase,
            // Suggest a markup instead of silently guessing — user reviews before save.
            selling_price: round2(purchase * 1.2),
            stock_quantity: qty,
            gst_rate: nearestGstSlab(item.gst_rate),
            // Flags used purely to draw the reviewer's eye to likely OCR misses.
            flagPrice: purchase <= 0,
            flagName: !item.description || !item.description.trim(),
          };
        });
        setReviewItems(staged);
        pushToast(`Found ${staged.length} item${staged.length === 1 ? "" : "s"} — review before adding.`, "info");
      } else {
        pushToast("No line items were detected in that image. Try a clearer photo.", "error");
      }
    } catch (error) {
      console.error("OCR Failed:", error);
      pushToast("Couldn't scan that receipt. Make sure the image is clear and try again.", "error");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateReviewItem = (tempId, field, value) => {
    setReviewItems((items) =>
      items.map((it) => (it._tempId === tempId ? { ...it, [field]: value } : it))
    );
  };

  const toggleReviewSelected = (tempId) => {
    setReviewItems((items) =>
      items.map((it) => (it._tempId === tempId ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleSelectAllReview = () => {
    setReviewItems((items) => {
      const allSelected = items.every((it) => it.selected);
      return items.map((it) => ({ ...it, selected: !allSelected }));
    });
  };

  const removeReviewItem = (tempId) => {
    setReviewItems((items) => {
      const next = items.filter((it) => it._tempId !== tempId);
      return next.length ? next : null;
    });
  };

  const discardReview = () => setReviewItems(null);

  const confirmReviewItems = async () => {
    const toAdd = (reviewItems || []).filter((it) => it.selected && it.product_name.trim());
    if (toAdd.length === 0) {
      pushToast("Select at least one item to add.", "error");
      return;
    }

    setIsSavingReview(true);
    let added = 0;
    let failed = 0;

    for (const item of toAdd) {
      try {
        await api.post("/inventory", {
          product_name: item.product_name.trim(),
          hsn_code: item.hsn_code,
          unit: item.unit || "Pcs",
          purchase_price: Number(item.purchase_price || 0),
          selling_price: Number(item.selling_price || 0),
          stock_quantity: Number(item.stock_quantity || 0),
          gst_rate: Number(item.gst_rate),
        });
        added++;
      } catch (err) {
        console.error("Failed to add scanned item to DB", err);
        failed++;
      }
    }

    setIsSavingReview(false);
    setReviewItems(null);
    if (added > 0) pushToast(`Added ${added} item${added === 1 ? "" : "s"} to inventory.`, "success");
    if (failed > 0) pushToast(`${failed} item${failed === 1 ? "" : "s"} failed to save.`, "error");
    fetchInventory();
  };

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase();
    return inventoryList.filter((item) => {
      const matchesSearch =
        item.product_name.toLowerCase().includes(q) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(q));
      const matchesStock = stockFilter === "all" || item.stock_quantity <= 5;
      return matchesSearch && matchesStock;
    });
  }, [inventoryList, search, stockFilter]);

  const stats = useMemo(() => {
    const totalProducts = inventoryList.length;
    const totalUnits = inventoryList.reduce((s, i) => s + (Number(i.stock_quantity) || 0), 0);
    const totalValue = inventoryList.reduce(
      (s, i) => s + (Number(i.purchase_price) || 0) * (Number(i.stock_quantity) || 0),
      0
    );
    const lowStock = inventoryList.filter((i) => i.stock_quantity <= 5).length;
    return { totalProducts, totalUnits, totalValue, lowStock };
  }, [inventoryList]);

  const selectedReviewCount = reviewItems ? reviewItems.filter((i) => i.selected).length : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }

        body {
          background-color: #0a0b0f;
          background-image:
            radial-gradient(circle at 12% -10%, rgba(56, 189, 248, 0.10) 0%, transparent 42%),
            radial-gradient(circle at 90% 110%, rgba(129, 92, 255, 0.10) 0%, transparent 45%);
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          margin: 0;
          min-height: 100vh;
        }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseLow { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.25); } 50% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes floatBlob { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, -18px) scale(1.06); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.0); } 50% { box-shadow: 0 0 26px 2px rgba(56, 189, 248, 0.18); } }

        .bg-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }
        .bg-blob.b1 { width: 380px; height: 380px; top: -120px; left: -100px; background: radial-gradient(circle, rgba(56,189,248,0.28), transparent 70%); animation: floatBlob 14s ease-in-out infinite; }
        .bg-blob.b2 { width: 420px; height: 420px; bottom: -160px; right: -120px; background: radial-gradient(circle, rgba(129,92,255,0.22), transparent 70%); animation: floatBlob 17s ease-in-out infinite reverse; }

        .container {
          max-width: 1440px;
          margin: auto;
          padding: 36px 22px 60px;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          position: relative;
          z-index: 1;
        }

        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; flex-wrap: wrap; gap: 15px; }

        .back-btn {
          width: 40px; height: 40px; font-size: 18px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease, border-color 0.25s ease;
        }
        .back-btn:hover { transform: translateX(-3px); background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); }

        .page-title { margin: 0; color: white; font-size: 1.7rem; font-weight: 800; letter-spacing: -0.01em; font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; }
        .page-subtitle { margin: 2px 0 0; color: #7d8798; font-size: 12.5px; font-weight: 500; }

        .invoice-nav-btn {
          padding: 10px 18px;
          background: linear-gradient(135deg, #3b82f6 0%, #7c5cff 100%);
          background-size: 160% 160%;
          color: white; border: none;
          border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background-position 0.25s ease;
        }
        .invoice-nav-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -10px rgba(124, 92, 255, 0.55); background-position: 100% 0%; }

        /* ---- Stat strip ---- */
        .stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }
        @media (max-width: 900px) { .stat-strip { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
          background: linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px 18px;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 0.25s ease, transform 0.25s ease;
        }
        .stat-card:hover { border-color: rgba(255,255,255,0.16); transform: translateY(-2px); }
        .stat-card:nth-of-type(1) { animation-delay: 0.02s; }
        .stat-card:nth-of-type(2) { animation-delay: 0.08s; }
        .stat-card:nth-of-type(3) { animation-delay: 0.14s; }
        .stat-card:nth-of-type(4) { animation-delay: 0.20s; }
        .stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #7d8798; font-weight: 700; margin-bottom: 6px; }
        .stat-value { font-size: 1.5rem; font-weight: 800; font-family: 'Space Grotesk', sans-serif; color: #f8fafc; }
        .stat-card.warn .stat-value { color: #fb923c; }
        .stat-icon { float: right; font-size: 18px; opacity: 0.7; }

        .grid { display: grid; grid-template-columns: 380px 1fr; gap: 22px; align-items: start; }
        @media (max-width: 1050px) { .grid { grid-template-columns: 1fr; } }

        .panel {
          background: linear-gradient(160deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
          backdrop-filter: blur(6px);
          padding: 24px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-sizing: border-box;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .panel:nth-of-type(1) { animation-delay: 0.06s; }
        .panel:nth-of-type(2) { animation-delay: 0.12s; }
        .panel h3 { margin-top: 0; color: #f8fafc; margin-bottom: 18px; font-size: 1.1rem; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }

        /* ---- Mode toggle ---- */
        .mode-toggle { display: flex; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 4px; margin-bottom: 20px; }
        .mode-toggle button {
          flex: 1; padding: 9px 10px; border: none; border-radius: 9px; background: transparent; color: #94a3b8;
          font-weight: 700; font-size: 12.5px; cursor: pointer; font-family: inherit;
          transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .mode-toggle button.active { background: linear-gradient(135deg, #38bdf8, #0284c7); color: #06131f; box-shadow: 0 6px 16px -8px rgba(56, 189, 248, 0.55); }
        .mode-toggle button:not(.active):hover { color: #e2e8f0; background: rgba(255,255,255,0.04); }

        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .input {
          width: 100%; padding: 10px 12px; border-radius: 9px;
          border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(255,255,255,0.03);
          color: white; font-size: 14px; font-family: inherit; box-sizing: border-box;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .input::placeholder { color: #5b6472; }
        .input:focus { outline: none; border-color: #38bdf8; background: rgba(56,189,248,0.06); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); }
        .input:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }

        .btn {
          padding: 10px 16px; border-radius: 9px; border: none; cursor: pointer;
          font-weight: 700; font-size: 14px; font-family: inherit;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background 0.25s ease, opacity 0.2s ease;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn:active:not(:disabled) { transform: scale(0.97); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-primary { background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); background-size: 160% 160%; color: #06131f; width: 100%; }
        .btn-primary:hover:not(:disabled) { background-position: 100% 0%; color: white; transform: translateY(-2px); box-shadow: 0 10px 22px -8px rgba(56, 189, 248, 0.45); }

        .btn-secondary { background: rgba(255,255,255,0.04); color: white; border: 1px solid rgba(255,255,255,0.08); }
        .btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.08); transform: translateY(-1px); }

        .btn-success { background: #10b981; color: white; padding: 8px 12px; font-size: 12px; }
        .btn-success:hover:not(:disabled) { background: #059669; transform: translateY(-1px); box-shadow: 0 6px 16px -6px rgba(16, 185, 129, 0.5); }

        .btn-danger { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); padding: 8px 12px; font-size: 12px; }
        .btn-danger:hover:not(:disabled) { background: #ef4444; color: white; transform: translateY(-1px) scale(1.03); box-shadow: 0 8px 18px -6px rgba(239, 68, 68, 0.55); }

        .btn-ghost-danger { background: transparent; color: #64748b; border: 1px solid rgba(255,255,255,0.08); padding: 6px 9px; font-size: 12px; }
        .btn-ghost-danger:hover:not(:disabled) { color: #f87171; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }

        .ai-upload-box {
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.7));
          border: 1.5px dashed rgba(56, 189, 248, 0.4);
          border-radius: 14px; padding: 26px 18px; text-align: center;
          transition: all 0.3s ease; box-sizing: border-box; width: 100%;
          animation: glowPulse 3.5s ease-in-out infinite;
        }
        .ai-upload-box:hover { border-color: #38bdf8; box-shadow: 0 8px 24px -10px rgba(56, 189, 248, 0.3); }
        .ai-upload-icon { font-size: 26px; margin-bottom: 6px; display: block; }

        .ai-upload-btn {
          background: #0284c7; color: #ffffff; width: 100%; padding: 11px 12px; border-radius: 9px; border: none;
          font-weight: 700; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 8px; box-sizing: border-box; transition: background 0.2s ease, transform 0.15s ease; margin-top: 14px;
        }
        .ai-upload-btn:hover:not(.disabled) { background: #0ea5e9; transform: translateY(-1px); }
        .ai-upload-btn.disabled { background: #334155; color: #94a3b8; cursor: not-allowed; }

        .divider-row { display: flex; align-items: center; margin: 18px 0; }
        .divider-row hr { flex: 1; border-color: rgba(255,255,255,0.06); }
        .divider-row span { padding: 0 10px; font-size: 11px; color: #5b6472; font-weight: 700; letter-spacing: 0.4px; }

        /* ---- Review queue (AI results awaiting confirmation) ---- */
        .review-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          background: linear-gradient(135deg, rgba(56,189,248,0.12), rgba(124,92,255,0.10));
          border: 1px solid rgba(56,189,248,0.28); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;
          animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }
        .review-banner strong { color: #7dd3fc; }
        .review-list { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
        .review-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px;
          padding: 12px 14px; animation: rowIn 0.3s ease both; transition: border-color 0.2s ease, opacity 0.2s ease;
        }
        .review-card.unselected { opacity: 0.45; }
        .review-card.flagged { border-color: rgba(251, 146, 60, 0.4); }
        .review-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .review-card-top input[type="checkbox"] { width: 16px; height: 16px; accent-color: #38bdf8; cursor: pointer; }
        .review-card-top input.name-input { flex: 1; font-weight: 700; }
        .review-flag { font-size: 10px; background: rgba(251,146,60,0.15); color: #fb923c; padding: 2px 7px; border-radius: 20px; font-weight: 700; white-space: nowrap; }
        .review-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        @media (max-width: 1300px) { .review-grid { grid-template-columns: repeat(2, 1fr); } }
        .review-grid .rf { display: flex; flex-direction: column; gap: 4px; }
        .review-grid .rf label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #64748b; font-weight: 700; }
        .review-grid .rf input, .review-grid .rf select { padding: 7px 8px; font-size: 12.5px; border-radius: 7px; }
        .review-actions { display: flex; gap: 10px; margin-top: 16px; }
        .review-actions .btn { flex: 1; }

        .inv-table-container { background: rgba(0,0,0,0.18); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.07); overflow-x: auto; }
        .inv-table { width: 100%; border-collapse: collapse; min-width: 720px; }
        .inv-table th {
          background: rgba(255,255,255,0.03); color: #94a3b8; padding: 12px 15px; text-align: left;
          font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07); position: sticky; top: 0;
        }
        .inv-table td { padding: 12px 15px; font-size: 13.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.045); color: #f1f5f9; }
        .inv-table tbody tr { animation: rowIn 0.35s ease both; transition: background 0.2s ease; }
        .inv-table tbody tr:hover { background: rgba(255, 255, 255, 0.025); }

        .badge-low { background: rgba(239, 68, 68, 0.12); color: #f87171; padding: 4px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.3); animation: pulseLow 2s ease-in-out infinite; display: inline-block; }
        .badge-ok { background: rgba(16, 185, 129, 0.12); color: #34d399; padding: 4px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3); display: inline-block; }

        .toolbar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
        .filter-chip-row { display: flex; gap: 8px; }
        .filter-chip {
          padding: 7px 13px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
          color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; font-family: inherit;
        }
        .filter-chip.active { background: linear-gradient(135deg, #38bdf8, #0284c7); color: #06131f; border-color: transparent; }
        .filter-chip:not(.active):hover { border-color: rgba(255,255,255,0.2); color: #e2e8f0; }

        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; }

        .skeleton-row td { padding: 14px 15px; }
        .skeleton-bar { height: 12px; border-radius: 6px; background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 37%, rgba(255,255,255,0.04) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }

        .empty-state { text-align: center; color: #64748b; padding: 46px 20px; animation: fadeIn 0.5s ease both; }
        .empty-state .empty-icon { font-size: 30px; margin-bottom: 10px; display: block; }
        .empty-state .empty-title { color: #cbd5e1; font-weight: 700; margin-bottom: 4px; }
        .empty-state .empty-sub { font-size: 12.5px; }

        /* ---- Toasts ---- */
        .toast-stack { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 10px; z-index: 50; max-width: 340px; }
        .toast {
          padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: white;
          background: #1c1c24; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.5);
          animation: toastIn 0.3s cubic-bezier(0.16,1,0.3,1) both; display: flex; align-items: center; gap: 8px;
        }
        .toast.success { border-color: rgba(16,185,129,0.4); }
        .toast.error { border-color: rgba(239,68,68,0.4); }
        .toast.info { border-color: rgba(56,189,248,0.4); }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div className="bg-blob b1" />
      <div className="bg-blob b2" />

      <div className="container">
        <div className="top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button className="btn btn-secondary back-btn" title="Back to Dashboard" onClick={() => navigate("/")}>
              ←
            </button>
            <div>
              <h1 className="page-title">Inventory Management</h1>
              <p className="page-subtitle">Track stock, prices and GST — or let AI read a bill for you.</p>
            </div>
          </div>

          <button className="btn btn-secondary invoice-nav-btn" onClick={() => navigate("/invoice")}>
            📄 Invoice Generator
          </button>
        </div>

        <div className="stat-strip">
          <div className="stat-card">
            <span className="stat-icon">📦</span>
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{stats.totalProducts}</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <div className="stat-label">Total Units</div>
            <div className="stat-value">{stats.totalUnits}</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-label">Stock Value</div>
            <div className="stat-value">₹{stats.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
          </div>
          <div className={`stat-card ${stats.lowStock > 0 ? "warn" : ""}`}>
            <span className="stat-icon">⚠️</span>
            <div className="stat-label">Low Stock</div>
            <div className="stat-value">{stats.lowStock}</div>
          </div>
        </div>

        <div className="grid">
          {/* LEFT PANEL: Add Product */}
          <div className="panel">
            <h3>Add Product</h3>

            <div className="mode-toggle">
              <button className={entryMode === "ai" ? "active" : ""} onClick={() => setEntryMode("ai")}>
                🤖 AI Scan
              </button>
              <button className={entryMode === "manual" ? "active" : ""} onClick={() => setEntryMode("manual")}>
                ✍️ Manual Entry
              </button>
            </div>

            {entryMode === "ai" && !reviewItems && (
              <div className="ai-upload-box">
                <span className="ai-upload-icon">🧾</span>
                <h4 style={{ color: "#38bdf8", margin: "0 0 6px", fontSize: "15px" }}>Auto-Fill with AI</h4>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                  Upload a photo of a vendor bill. AI extracts each line item, then you confirm
                  before anything is saved to stock.
                </p>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleReceiptUpload}
                  style={{ display: "none" }}
                  id="receipt-upload"
                  disabled={isScanning}
                />

                <label htmlFor="receipt-upload" className={`ai-upload-btn ${isScanning ? "disabled" : ""}`}>
                  {isScanning ? (
                    <>
                      <span className="spinner"></span> Reading bill…
                    </>
                  ) : (
                    "📸 Upload Receipt Image"
                  )}
                </label>
              </div>
            )}

            {entryMode === "ai" && reviewItems && (
              <div>
                <div className="review-banner">
                  <span>
                    <strong>{reviewItems.length}</strong> item{reviewItems.length === 1 ? "" : "s"} found — review before saving
                  </span>
                  <button className="btn btn-ghost-danger" onClick={discardReview} title="Discard scan">
                    Discard
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={reviewItems.every((i) => i.selected)}
                    onChange={toggleSelectAllReview}
                    style={{ width: 16, height: 16, accentColor: "#38bdf8", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Select all</span>
                </div>

                <div className="review-list">
                  {reviewItems.map((item) => {
                    const flagged = item.flagPrice || item.flagName;
                    return (
                      <div
                        key={item._tempId}
                        className={`review-card ${item.selected ? "" : "unselected"} ${flagged ? "flagged" : ""}`}
                      >
                        <div className="review-card-top">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleReviewSelected(item._tempId)}
                          />
                          <input
                            className="input name-input"
                            value={item.product_name}
                            onChange={(e) => updateReviewItem(item._tempId, "product_name", e.target.value)}
                            placeholder="Item name"
                          />
                          {flagged && <span className="review-flag">Check this</span>}
                          <button
                            className="btn btn-ghost-danger"
                            onClick={() => removeReviewItem(item._tempId)}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="review-grid">
                          <div className="rf">
                            <label>HSN</label>
                            <input
                              className="input"
                              value={item.hsn_code}
                              onChange={(e) => updateReviewItem(item._tempId, "hsn_code", e.target.value)}
                            />
                          </div>
                          <div className="rf">
                            <label>Qty</label>
                            <input
                              type="number"
                              className="input"
                              value={item.stock_quantity}
                              onChange={(e) => updateReviewItem(item._tempId, "stock_quantity", e.target.value)}
                            />
                          </div>
                          <div className="rf">
                            <label>Purchase ₹</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={item.purchase_price}
                              onChange={(e) => updateReviewItem(item._tempId, "purchase_price", e.target.value)}
                            />
                          </div>
                          <div className="rf">
                            <label>Sell ₹</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={item.selling_price}
                              onChange={(e) => updateReviewItem(item._tempId, "selling_price", e.target.value)}
                            />
                          </div>
                          <div className="rf">
                            <label>GST %</label>
                            <select
                              className="input"
                              value={item.gst_rate}
                              onChange={(e) => updateReviewItem(item._tempId, "gst_rate", e.target.value)}
                            >
                              {GST_SLABS.map((g) => (
                                <option key={g} value={g}>
                                  {g}%
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="review-actions">
                  <button className="btn btn-secondary" onClick={discardReview} disabled={isSavingReview}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={confirmReviewItems} disabled={isSavingReview}>
                    {isSavingReview ? (
                      <>
                        <span className="spinner"></span> Saving…
                      </>
                    ) : (
                      `✓ Add ${selectedReviewCount} Item${selectedReviewCount === 1 ? "" : "s"} to Inventory`
                    )}
                  </button>
                </div>
              </div>
            )}

            {entryMode === "manual" && (
              <form onSubmit={handleAddProduct}>
                <div className="input-group">
                  <label>Product Name *</label>
                  <input
                    required
                    className="input"
                    placeholder="e.g., CCTV Camera HD"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>HSN/SAC Code</label>
                    <input
                      className="input"
                      placeholder="e.g., 8525"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    />
                  </div>
                  <div className="input-group" style={{ width: "90px" }}>
                    <label>Unit</label>
                    <input
                      className="input"
                      placeholder="Pcs"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Selling Price (₹) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Opening Stock Qty</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>GST Rate %</label>
                    <select
                      className="input"
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                    >
                      {GST_SLABS.map((g) => (
                        <option key={g} value={g}>
                          {g}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: "10px" }}>
                  + Save Product
                </button>
              </form>
            )}
          </div>

          {/* RIGHT PANEL: Inventory List */}
          <div className="panel">
            <div className="toolbar-row">
              <h3 style={{ margin: 0 }}>Current Stock</h3>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <div className="filter-chip-row">
                  <button className={`filter-chip ${stockFilter === "all" ? "active" : ""}`} onClick={() => setStockFilter("all")}>
                    All
                  </button>
                  <button className={`filter-chip ${stockFilter === "low" ? "active" : ""}`} onClick={() => setStockFilter("low")}>
                    Low Stock
                  </button>
                </div>
                <input
                  className="input"
                  style={{ width: "230px" }}
                  placeholder="Search products or HSN…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>HSN</th>
                    <th>Purchase Price</th>
                    <th>Sell Price</th>
                    <th>GST</th>
                    <th>Stock Level</th>
                    <th>Update Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr className="skeleton-row" key={`sk-${i}`}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j}>
                            <div className="skeleton-bar" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!isLoading &&
                    filteredInventory.map((item, idx) => (
                      <tr key={item.id} style={{ animationDelay: `${Math.min(idx * 0.04, 0.6)}s` }}>
                        <td>
                          <strong>{item.product_name}</strong>
                        </td>
                        <td style={{ color: "#94a3b8" }}>{item.hsn_code || "-"}</td>
                        <td>₹{item.purchase_price ? item.purchase_price.toFixed(2) : "0.00"}</td>
                        <td>₹{item.selling_price.toFixed(2)}</td>
                        <td>{item.gst_rate}%</td>
                        <td>
                          <span className={item.stock_quantity <= 5 ? "badge-low" : "badge-ok"}>
                            {item.stock_quantity} {item.unit}
                          </span>
                        </td>
                        <td style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="number"
                            className="input"
                            style={{ width: "80px", padding: "6px" }}
                            placeholder="New Qty"
                            value={updateStockData[item.id] !== undefined ? updateStockData[item.id] : ""}
                            onChange={(e) => setUpdateStockData({ ...updateStockData, [item.id]: e.target.value })}
                          />
                          <button className="btn btn-success" onClick={() => handleStockUpdate(item.id)}>
                            Set
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-danger" title="Delete Product" onClick={() => handleDeleteProduct(item.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}

                  {!isLoading && filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state">
                          <span className="empty-icon">📦</span>
                          <div className="empty-title">
                            {search || stockFilter === "low" ? "No matching products" : "No products yet"}
                          </div>
                          <div className="empty-sub">
                            {search || stockFilter === "low"
                              ? "Try a different search term or clear the filter."
                              : "Scan a bill or add your first item on the left."}
                          </div>
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