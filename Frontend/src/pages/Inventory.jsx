import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import api from "../api/axios"; 

export default function InventoryManager() {
  const navigate = useNavigate(); 
  const [inventoryList, setInventoryList] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef(null);

  // Form State for new product
  const [formData, setFormData] = useState({
    product_name: "",
    hsn_code: "",
    unit: "Pcs",
    purchase_price: "",
    selling_price: "",
    stock_quantity: "",
    gst_rate: 18,
  });

  // Local state for handling quick stock updates in the table
  const [updateStockData, setUpdateStockData] = useState({});

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/inventory");
      setInventoryList(res.data);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!formData.product_name || !formData.selling_price) {
      alert("Product Name and Selling Price are required.");
      return;
    }

    try {
      await api.post("/inventory", {
        ...formData,
        purchase_price: Number(formData.purchase_price || 0),
        selling_price: Number(formData.selling_price),
        stock_quantity: Number(formData.stock_quantity || 0),
        gst_rate: Number(formData.gst_rate),
      });
      
      // Reset form and refresh list
      setFormData({
        product_name: "", hsn_code: "", unit: "Pcs", purchase_price: "", selling_price: "", stock_quantity: "", gst_rate: 18
      });
      fetchInventory();
    } catch (error) {
      console.error("Failed to add product", error);
      alert("Failed to add product.");
    }
  };

  const handleStockUpdate = async (id) => {
    const newQty = updateStockData[id];
    if (newQty === undefined || newQty === "") return;

    try {
      await api.put(`/inventory/${id}?quantity=${newQty}`);
      setUpdateStockData({ ...updateStockData, [id]: "" });
      fetchInventory();
    } catch (error) {
      console.error("Failed to update stock", error);
      alert("Failed to update stock.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    try {
      await api.delete(`/inventory/${id}`);
      fetchInventory(); 
    } catch (error) {
      console.error("Failed to delete product", error);
      alert("Failed to delete product. Ensure you don't have existing invoices linked to it.");
    }
  };

  // Smart Receipt OCR Upload Handler
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

      if (res.data.success && res.data.items) {
        let addedCount = 0;
        
        for (const item of res.data.items) {
          try {
            await api.post("/inventory", {
              product_name: item.description || "Scanned Item",
              hsn_code: "",
              unit: "Pcs",
              purchase_price: Number(item.price || 0),
              selling_price: Number(item.price || 0) * 1.2,
              stock_quantity: Number(item.quantity || 1),
              gst_rate: Number(item.gst_rate || 18),
            });
            addedCount++;
          } catch (err) {
            console.error("Failed to add scanned item to DB", err);
          }
        }
        
        alert(`Successfully extracted and added ${addedCount} items to inventory! Please review their selling prices.`);
        fetchInventory();
      }
    } catch (error) {
      console.error("OCR Failed:", error);
      alert("Failed to scan receipt. Please ensure the image is clear and the backend AI is configured.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredInventory = inventoryList.filter((item) =>
    item.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (item.hsn_code && item.hsn_code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body { 
          background-color: #121212;
          background-image: 
            radial-gradient(circle at 15% 0%, rgba(20, 20, 25, 1) 0%, transparent 40%),
            radial-gradient(circle at 85% 100%, rgba(20, 20, 25, 1) 0%, transparent 40%);
          font-family: 'Plus Jakarta Sans', sans-serif; 
          color: #f1f5f9; 
          margin: 0;
          min-height: 100vh;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes rowIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulseLow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.25); }
          50% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .container { 
          max-width: 1400px; 
          margin: auto; 
          padding: 40px 20px; 
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        
        .grid { 
          display: grid; 
          grid-template-columns: 350px 1fr; 
          gap: 30px; 
          align-items: start; 
        }

        @media (max-width: 1024px) {
          .grid { 
            grid-template-columns: 1fr; 
          }
        }
        
        .panel { 
          background: #1a1a1a; 
          padding: 25px; 
          border-radius: 12px; 
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-sizing: border-box;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .panel:nth-of-type(1) { animation-delay: 0.08s; }
        .panel:nth-of-type(2) { animation-delay: 0.16s; }
        .panel h3 { margin-top: 0; color: #f8fafc; margin-bottom: 20px; font-size: 1.15rem; font-weight: 700; }
        
        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .input { 
          width: 100%; 
          padding: 10px 12px; 
          border-radius: 8px; 
          border: 1px solid rgba(255, 255, 255, 0.08); 
          background: #262626; 
          color: white; 
          font-size: 14px; 
          font-family: inherit;
          box-sizing: border-box; 
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .input::placeholder { color: #64748b; }
        .input:focus { 
          outline: none; 
          border-color: #38bdf8; 
          background: #2a2a2a;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }
        
        .btn { 
          padding: 10px 16px; 
          border-radius: 8px; 
          border: none; 
          cursor: pointer; 
          font-weight: 700; 
          font-size: 14px; 
          font-family: inherit;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background 0.25s ease;
          display: inline-flex; 
          align-items: center; 
          justify-content: center;
        }
        .btn:active { transform: scale(0.97); }

        .btn-primary { 
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
          background-size: 160% 160%;
          color: #06131f; 
          width: 100%; 
        }
        .btn-primary:hover { 
          background-position: 100% 0%;
          color: white; 
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -8px rgba(56, 189, 248, 0.45);
        }
        .btn-secondary { background: #262626; color: white; border: 1px solid rgba(255,255,255,0.06); }
        .btn-secondary:hover { background: #303030; transform: translateY(-1px); }
        .btn-success { background: #10b981; color: white; padding: 8px 12px; font-size: 12px;}
        .btn-success:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 6px 16px -6px rgba(16, 185, 129, 0.5); }
        
        .btn-danger { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); padding: 8px 12px; font-size: 12px; }
        .btn-danger:hover { background: #ef4444; color: white; transform: translateY(-1px) scale(1.03); box-shadow: 0 8px 18px -6px rgba(239, 68, 68, 0.55); }

        .ai-upload-box {
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.8));
          border: 1px dashed rgba(56, 189, 248, 0.4);
          border-radius: 12px;
          padding: 18px 16px;
          text-align: center;
          margin-bottom: 22px;
          transition: all 0.3s ease;
          box-sizing: border-box;
          width: 100%;
        }
        .ai-upload-box:hover {
          border-color: #38bdf8;
          box-shadow: 0 8px 24px -10px rgba(56, 189, 248, 0.3);
        }

        .ai-upload-btn {
          background: #0284c7;
          color: #ffffff;
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: none;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .ai-upload-btn:hover:not(:disabled) {
          background: #0ea5e9;
          transform: translateY(-1px);
        }
        .ai-upload-btn:disabled {
          background: #475569;
          color: #cbd5e1;
          cursor: not-allowed;
        }

        .inv-table-container { 
          background: #141414; 
          border-radius: 10px; 
          border: 1px solid rgba(255, 255, 255, 0.06); 
          overflow-x: auto; 
        }
        .inv-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .inv-table th { 
          background: #1c1c1c; 
          color: #94a3b8; 
          padding: 12px 15px; 
          text-align: left; 
          font-size: 11px; 
          font-weight: 700;
          text-transform: uppercase; 
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06); 
        }
        .inv-table td { padding: 12px 15px; font-size: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #f1f5f9; }
        .inv-table tbody tr { animation: rowIn 0.35s ease both; transition: background 0.2s ease; }
        .inv-table tbody tr:hover { background: rgba(255, 255, 255, 0.025); }
        
        .badge-low { 
          background: rgba(239, 68, 68, 0.12); 
          color: #f87171; 
          padding: 4px 9px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: 700; 
          border: 1px solid rgba(239, 68, 68, 0.3);
          animation: pulseLow 2s ease-in-out infinite;
          display: inline-block;
        }
        .badge-ok { 
          background: rgba(16, 185, 129, 0.12); 
          color: #34d399; 
          padding: 4px 9px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: 700; 
          border: 1px solid rgba(16, 185, 129, 0.3);
          display: inline-block;
        }

        .top-bar {
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 15px;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .back-btn {
          margin: 0; 
          padding: 0; 
          width: 38px; 
          height: 38px; 
          font-size: 18px; 
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.06);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease;
        }
        .back-btn:hover { transform: translateX(-3px); background: #303030; }

        .invoice-nav-btn {
          padding: 9px 18px; 
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          background-size: 160% 160%;
          color: white;
          border: none;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background-position 0.25s ease;
        }
        .invoice-nav-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.5);
          background-position: 100% 0%;
        }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          margin-right: 8px;
          vertical-align: middle;
        }

        .empty-state {
          text-align: center; 
          color: #64748b; 
          padding: 40px;
          animation: fadeIn 0.5s ease both;
        }
        .empty-state .empty-icon { font-size: 28px; margin-bottom: 8px; display: block; }
      `}</style>

      <div className="container">
        <div className="top-bar">
            <div style={{display:'flex', alignItems:'center', gap: '15px'}}>
              <button 
                className="btn btn-secondary back-btn" 
                title="Back to Dashboard"
                onClick={() => navigate('/')}
              >
                ←
              </button>
              <h1 style={{margin:0, color:'white', fontSize: '1.6rem', fontWeight: 800}}>Inventory Management</h1>
            </div>

            <button 
              className="btn btn-secondary invoice-nav-btn" 
              onClick={() => navigate('/invoice')}
            >
              📄 Invoice Generator
            </button>
        </div>

        <div className="grid">
          
          {/* LEFT PANEL: Add Product */}
          <div className="panel">
            <div className="ai-upload-box">
              <h4 style={{ color: "#38bdf8", marginTop: 0, marginBottom: "6px", fontSize: "15px" }}>🤖 Auto-Fill with AI</h4>
              <p style={{ fontSize: "11.5px", color: "#94a3b8", marginBottom: "14px", lineHeight: "1.4" }}>
                Upload a photo of a vendor bill to instantly extract and stock items.
              </p>
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleReceiptUpload} 
                style={{ display: "none" }} 
                id="receipt-upload"
              />
              
              <label 
                htmlFor="receipt-upload" 
                className="ai-upload-btn"
                style={{ cursor: isScanning ? "not-allowed" : "pointer" }}
              >
                {isScanning ? <><span className="spinner"></span> Scanning Bill...</> : "📸 Upload Receipt Image"}
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
              <hr style={{ flex: 1, borderColor: "rgba(255,255,255,0.05)" }} />
              <span style={{ padding: "0 10px", fontSize: "12px", color: "#64748b", fontWeight: 700 }}>OR MANUAL ENTRY</span>
              <hr style={{ flex: 1, borderColor: "rgba(255,255,255,0.05)" }} />
            </div>

            <form onSubmit={handleAddProduct}>
              <div className="input-group">
                <label>Product Name *</label>
                <input required className="input" placeholder="e.g., CCTV Camera HD" value={formData.product_name} onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} />
              </div>

              <div style={{display:'flex', gap:'10px'}}>
                  <div className="input-group" style={{flex: 1}}>
                    <label>HSN/SAC Code</label>
                    <input className="input" placeholder="e.g., 8525" value={formData.hsn_code} onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })} />
                  </div>
                  <div className="input-group" style={{width: '80px'}}>
                    <label>Unit</label>
                    <input className="input" placeholder="Pcs" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                  </div>
              </div>

              <div style={{display:'flex', gap:'10px'}}>
                  <div className="input-group" style={{flex: 1}}>
                    <label>Purchase Price (₹)</label>
                    <input type="number" step="0.01" className="input" placeholder="0.00" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} />
                  </div>
                  <div className="input-group" style={{flex: 1}}>
                    <label>Selling Price (₹) *</label>
                    <input required type="number" step="0.01" className="input" placeholder="0.00" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} />
                  </div>
              </div>
              
              <div style={{display:'flex', gap:'10px'}}>
                  <div className="input-group" style={{flex: 1}}>
                    <label>Opening Stock Qty</label>
                    <input type="number" className="input" placeholder="0" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} />
                  </div>
                  <div className="input-group" style={{flex: 1}}>
                    <label>GST Rate %</label>
                    <input type="number" className="input" placeholder="18" value={formData.gst_rate} onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })} />
                  </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{marginTop:'10px', width: '100%'}}>+ Save Product</button>
            </form>
          </div>

          {/* RIGHT PANEL: Inventory List */}
          <div className="panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'15px'}}>
                <h3 style={{margin:0}}>Current Stock</h3>
                <input className="input" style={{width: '250px'}} placeholder="Search products or HSN..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  {isLoading && (
                    <tr>
                      <td colSpan="8" className="empty-state">
                        <span className="spinner"></span>Loading inventory...
                      </td>
                    </tr>
                  )}
                  {!isLoading && filteredInventory.map((item, idx) => (
                    <tr key={item.id} style={{ animationDelay: `${Math.min(idx * 0.04, 0.6)}s` }}>
                      <td><strong>{item.product_name}</strong></td>
                      <td style={{color:'#94a3b8'}}>{item.hsn_code || '-'}</td>
                      <td>₹{item.purchase_price ? item.purchase_price.toFixed(2) : '0.00'}</td>
                      <td>₹{item.selling_price.toFixed(2)}</td>
                      <td>{item.gst_rate}%</td>
                      <td>
                        <span className={item.stock_quantity <= 5 ? "badge-low" : "badge-ok"}>
                          {item.stock_quantity} {item.unit}
                        </span>
                      </td>
                      <td style={{display:'flex', gap:'8px', alignItems:'center'}}>
                        <input 
                            type="number" 
                            className="input" 
                            style={{width:'80px', padding:'6px'}} 
                            placeholder="New Qty"
                            value={updateStockData[item.id] !== undefined ? updateStockData[item.id] : ""}
                            onChange={(e) => setUpdateStockData({...updateStockData, [item.id]: e.target.value})}
                        />
                        <button className="btn btn-success" onClick={() => handleStockUpdate(item.id)}>Set</button>
                      </td>
                      <td>
                        <button 
                          className="btn btn-danger" 
                          title="Delete Product"
                          onClick={() => handleDeleteProduct(item.id)}
                        >
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
                              No products found. Add your first item on the left.
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