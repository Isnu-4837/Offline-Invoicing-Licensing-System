import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const COMPANY_CACHE_KEY = "billing_company_header_details";
const DRAFT_STORAGE_KEY = "billing_console_autosave_draft";

const LoadingButton = ({ onClick, children, className, style, title, type = "button", disabled }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    if (!onClick) return;
    setIsLoading(true);
    try {
      const result = onClick(e);
      if (result instanceof Promise) {
        await result;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type={type}
      className={`${className} ${isLoading ? "is-loading" : ""}`}
      style={{ ...style, position: "relative" }}
      onClick={handleClick}
      disabled={isLoading || disabled}
      title={title}
    >
      {isLoading && <span className="loader-ring"></span>}
      <span className="btn-content">{children}</span>
    </button>
  );
};

export default function BillingConsole() {
  const invoiceRef = useRef(null);
  const navigate = useNavigate();

  const [paperSize, setPaperSize] = useState("a4");
  const [isPaidMarked, setIsPaidMarked] = useState(false);
  const [preMarkAdvance, setPreMarkAdvance] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  const getInitialCompanyDetails = () => {
    try {
      const cached = localStorage.getItem(COMPANY_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Failed to parse cached company details", e);
    }
    return {};
  };

  const cachedDetails = getInitialCompanyDetails();

  const getInitialDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        return JSON.parse(savedDraft);
      }
    } catch (e) {
      console.error("Failed to load saved draft", e);
    }
    return null;
  };

  const initialDraft = getInitialDraft();

  const [formData, setFormData] = useState({
    doc_type: initialDraft?.formData?.doc_type || "INVOICE",

    company_name: initialDraft?.formData?.company_name || cachedDetails.company_name || "",
    company_address: initialDraft?.formData?.company_address || cachedDetails.company_address || "",
    company_showroom: initialDraft?.formData?.company_showroom || cachedDetails.company_showroom || "",
    company_gstin: initialDraft?.formData?.company_gstin || cachedDetails.company_gstin || "",
    company_state: initialDraft?.formData?.company_state || cachedDetails.company_state || "",
    company_state_code: initialDraft?.formData?.company_state_code || cachedDetails.company_state_code || "",
    company_phones: initialDraft?.formData?.company_phones || cachedDetails.company_phones || "",
    company_email: initialDraft?.formData?.company_email || cachedDetails.company_email || "",
    company_pan: initialDraft?.formData?.company_pan || cachedDetails.company_pan || "",
    company_logo: initialDraft?.formData?.company_logo || cachedDetails.company_logo || "",

    client_name: initialDraft?.formData?.client_name || "",
    client_mobile: initialDraft?.formData?.client_mobile || "",
    client_email: initialDraft?.formData?.client_email || "",
    client_address: initialDraft?.formData?.client_address || "",
    client_gstin: initialDraft?.formData?.client_gstin || "",
    client_state: initialDraft?.formData?.client_state || "",
    client_state_code: initialDraft?.formData?.client_state_code || "",
    place_of_supply: initialDraft?.formData?.place_of_supply || "",

    invoice_number: initialDraft?.formData?.invoice_number || "",
    invoice_date: initialDraft?.formData?.invoice_date || new Date().toISOString().split("T")[0],
    delivery_note: initialDraft?.formData?.delivery_note || "",
    
    payment_mode: initialDraft?.formData?.payment_mode || "FULL",
    advance_paid: initialDraft?.formData?.advance_paid || 0,
    due_date: initialDraft?.formData?.due_date || "",
    emi_start_date: initialDraft?.formData?.emi_start_date || "",

    reference_no_date: initialDraft?.formData?.reference_no_date || "",
    other_references: initialDraft?.formData?.other_references || "",
    buyers_order_no: initialDraft?.formData?.buyers_order_no || "",
    order_dated: initialDraft?.formData?.order_dated || "",
    dispatch_doc_no: initialDraft?.formData?.dispatch_doc_no || "",
    delivery_note_date: initialDraft?.formData?.delivery_note_date || "",
    dispatched_through: initialDraft?.formData?.dispatched_through || "",
    destination: initialDraft?.formData?.destination || "",
    terms_of_delivery: initialDraft?.formData?.terms_of_delivery || "",

    bank_name: initialDraft?.formData?.bank_name || cachedDetails.bank_name || "",
    account_no: initialDraft?.formData?.account_no || cachedDetails.account_no || "",
    branch_ifsc: initialDraft?.formData?.branch_ifsc || cachedDetails.branch_ifsc || "",
    qr_code_image: initialDraft?.formData?.qr_code_image || cachedDetails.qr_code_image || "",
    digital_signature: initialDraft?.formData?.digital_signature || cachedDetails.digital_signature || "",
    
    installation_charges: initialDraft?.formData?.installation_charges || 0,
    is_gst_enabled: initialDraft?.formData?.is_gst_enabled ?? true,

    show_company_logo: initialDraft?.formData?.show_company_logo ?? cachedDetails.show_company_logo ?? true,
    show_digital_signature: initialDraft?.formData?.show_digital_signature ?? cachedDetails.show_digital_signature ?? true,
    show_qr_code: initialDraft?.formData?.show_qr_code ?? cachedDetails.show_qr_code ?? true,
  });

  const [items, setItems] = useState(
    initialDraft?.items || [
      {
        id: null,
        description: "",
        hsn_code: "",
        price: 0,
        gst_rate: 18,
        discount_percent: 0,
        manual_quantity: null,
        subItems: [{ sn_code: "" }],
      },
    ]
  );

  const [invoiceList, setInvoiceList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [search, setSearch] = useState("");

  const getNextInvoiceNumber = (invoices, docType = "INVOICE") => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const prefix = docType === "QUOTATION" ? `QUO-${month}/${year}-` : `INV-${month}/${year}-`;

    if (!Array.isArray(invoices)) return `${prefix}1`;

    let maxNum = 0;
    for (const inv of invoices) {
      if (inv.invoice_number && inv.invoice_number.trim().startsWith(prefix)) {
        const suffix = inv.invoice_number.trim().substring(prefix.length);
        const numPart = parseInt(suffix, 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }

    return `${prefix}${maxNum + 1}`;
  };

  const getEffectiveQty = (item) => {
    if (item.manual_quantity !== undefined && item.manual_quantity !== null && item.manual_quantity !== "") {
      return Number(item.manual_quantity) || 0;
    }
    return item.subItems ? item.subItems.length : 0;
  };

  const hasManualQuantity = (item) => {
    return item.manual_quantity !== undefined && item.manual_quantity !== null && item.manual_quantity !== "";
  };

  useEffect(() => {
    fetchInvoices();
    fetchInventory();
  }, []);

  useEffect(() => {
    try {
      const draftData = { formData, items };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (e) {
      console.error("Failed to persist autosave draft", e);
    }
  }, [formData, items]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get("/invoices");
      const invoices = res.data || [];
      setInvoiceList(invoices);
      
      setFormData((prev) => {
        const now = new Date();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const y = String(now.getFullYear()).slice(-2);
        const expectedPrefix = prev.doc_type === "QUOTATION" ? `QUO-${m}/${y}-` : `INV-${m}/${y}-`;
        
        if (!prev.invoice_number || !prev.invoice_number.startsWith(expectedPrefix)) {
          return { ...prev, invoice_number: getNextInvoiceNumber(invoices, prev.doc_type) };
        }
        return prev;
      });
      
      return invoices;
    } catch (error) {
      console.error("Failed to fetch invoices", error);
      setInvoiceList([]);
      return [];
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get("/inventory");
      setInventoryList(res.data || []);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
      setInventoryList([]);
    }
  };

  const formatError = (error) => {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (Array.isArray(detail)) {
        return detail.map(err => `• ${err.loc.slice(-1)}: ${err.msg}`).join('\n');
      }
      if (typeof detail === 'object') {
        return JSON.stringify(detail);
      }
      return detail;
    }
    return error.message || "An unknown error occurred.";
  };

  const loadInvoiceData = async (invSummary) => {
    try {
      const res = await api.get(`/invoices/${invSummary.id}`);
      const inv = res.data;

      setSelectedInvoice(inv);
      
      const isFullyPaid = inv.payment_status === "PAID";
      
      setIsPaidMarked(isFullyPaid);
      setPreMarkAdvance(isFullyPaid ? 0 : (Number(inv.advance_paid) || 0));

      const safeDate = (dateString) => {
        if (!dateString) return "";
        try {
          return new Date(dateString).toISOString().split("T")[0];
        } catch (e) {
          return "";
        }
      };

      setFormData(prev => ({
        ...prev,
        doc_type: inv.doc_type || "INVOICE",
        
        client_name: inv.client_name || "",
        client_mobile: inv.client_mobile || "",
        client_email: inv.client_email || "",
        client_address: inv.client_address || "",
        client_gstin: inv.client_gstin || "",
        client_state: inv.client_state || "",
        client_state_code: inv.client_state_code || "",
        place_of_supply: inv.place_of_supply || "",
        
        invoice_number: inv.invoice_number || "",
        invoice_date: safeDate(inv.created_at || inv.invoice_date),
        payment_mode: inv.payment_mode || "FULL",
        advance_paid: Number(inv.advance_paid) || 0,
        due_date: safeDate(inv.due_date),
        emi_start_date: safeDate(inv.emi_start_date),

        installation_charges: Number(inv.installation_charges) || 0,
        is_gst_enabled: inv.is_gst_enabled !== undefined ? inv.is_gst_enabled : true,

        company_name: inv.company_name || prev.company_name,
        company_address: inv.company_address || prev.company_address,
        company_showroom: inv.company_showroom || prev.company_showroom,
        company_gstin: inv.company_gstin || prev.company_gstin,
        company_state: inv.company_state || prev.company_state,
        company_state_code: inv.company_state_code || prev.company_state_code,
        company_phones: inv.company_phones || prev.company_phones,
        company_email: inv.company_email || prev.company_email,
        company_pan: inv.company_pan || prev.company_pan,
        
        bank_name: inv.bank_name || "",
        account_no: inv.account_no || "",
        branch_ifsc: inv.branch_ifsc || "",
        qr_code_image: inv.qr_code_image || "",
        
        delivery_note: inv.delivery_note || "",
        reference_no_date: inv.reference_no_date || "",
        other_references: inv.other_references || "",
        buyers_order_no: inv.buyers_order_no || "",
        order_dated: safeDate(inv.order_dated),
        dispatch_doc_no: inv.dispatch_doc_no || "",
        delivery_note_date: safeDate(inv.delivery_note_date),
        dispatched_through: inv.dispatched_through || "",
        destination: inv.destination || "",
        terms_of_delivery: inv.terms_of_delivery || "",
      }));

      let parsedItems = [];
      if (typeof inv.items === 'string') {
          try {
              parsedItems = JSON.parse(inv.items);
          } catch (e) {
              console.error("Failed to parse items JSON from DB", e);
          }
      } else if (Array.isArray(inv.items)) {
          parsedItems = inv.items;
      }

      if (parsedItems && parsedItems.length > 0) {
        const grouped = [];
        parsedItems.forEach((dbItem) => {
          const group = grouped.find(
            (g) =>
              g.description === dbItem.description &&
              Number(g.price) === Number(dbItem.price)
          );

          const snCode = dbItem.sn_code || dbItem.serial_number || "";

          if (group) {
            group.subItems.push({ sn_code: snCode });
            if (dbItem.quantity !== undefined && dbItem.quantity > group.subItems.length) {
              group.manual_quantity = dbItem.quantity;
            }
          } else {
            grouped.push({
              id: dbItem.product_id || dbItem.id || null,
              description: dbItem.description || "",
              hsn_code: dbItem.hsn_code || "",
              price: Number(dbItem.price) || 0,
              gst_rate: Number(dbItem.gst_rate) || 18,
              discount_percent: Number(dbItem.discount_percent) || 0,
              manual_quantity: dbItem.quantity !== undefined ? dbItem.quantity : null,
              subItems: [{ sn_code: snCode }],
            });
          }
        });
        setItems(grouped);
      } else {
        setItems([{ id: null, description: "", hsn_code: "", price: 0, gst_rate: 18, discount_percent: 0, manual_quantity: null, subItems: [{ sn_code: "" }] }]);
      }
    } catch (error) {
      console.error("Failed to load invoice details", error);
      alert("Failed to load full invoice details.");
    }
  };

  const cacheCompanyDetails = (data) => {
    const cacheData = {
      company_name: data.company_name,
      company_address: data.company_address,
      company_showroom: data.company_showroom,
      company_gstin: data.company_gstin,
      company_state: data.company_state,
      company_state_code: data.company_state_code,
      company_phones: data.company_phones,
      company_email: data.company_email,
      company_pan: data.company_pan,
      company_logo: data.company_logo,
      digital_signature: data.digital_signature,
      bank_name: data.bank_name,
      account_no: data.account_no,
      branch_ifsc: data.branch_ifsc,
      qr_code_image: data.qr_code_image,
      show_company_logo: data.show_company_logo,
      show_digital_signature: data.show_digital_signature,
      show_qr_code: data.show_qr_code,
    };
    localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(cacheData));
  };

  const handleCompanyChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    cacheCompanyDetails(updatedData);
  };

  const logoInputRef = React.useRef(null);
  const signatureInputRef = React.useRef(null);
  const qrInputRef = React.useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCompanyChange("company_logo", reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCompanyChange("digital_signature", reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetImageField = (field, inputRef) => {
    handleCompanyChange(field, "");
    if (inputRef.current) inputRef.current.value = "";
  };
  const handleResetLogo = () => resetImageField("company_logo", logoInputRef);
  const handleResetSignature = () => resetImageField("digital_signature", signatureInputRef);
  const handleResetQr = () => resetImageField("qr_code_image", qrInputRef);

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    let totalDiscount = 0;

    items.forEach((item) => {
      const qty = getEffectiveQty(item);
      const baseItemTotal = (Number(item.price) || 0) * qty;
      const discPct = Number(item.discount_percent) || 0;
      const discAmt = baseItemTotal * (discPct / 100);
      
      const discountedItemTotal = baseItemTotal - discAmt;

      totalDiscount += discAmt;
      subtotal += discountedItemTotal;

      if (formData.is_gst_enabled) {
        const gstRate = Number(item.gst_rate) || 0;
        tax += discountedItemTotal * (gstRate / 100);
      }
    });

    const installation = Number(formData.installation_charges) || 0;
    const grandTotal = subtotal + tax + installation;
    
    const advance = isPaidMarked ? grandTotal : (Number(formData.advance_paid) || 0);
    const balance = isPaidMarked ? 0 : Math.max(0, grandTotal - advance);

    return { subtotal, tax, installation, grandTotal, balance, totalDiscount };
  };

  const { subtotal, tax, installation, grandTotal, balance, totalDiscount } = calculateTotals();

  const addItem = () => {
    setItems([
      ...items,
      {
        id: null,
        description: "",
        hsn_code: "",
        price: 0,
        gst_rate: 18,
        discount_percent: 0,
        manual_quantity: null,
        subItems: [{ sn_code: "" }],
      },
    ]);
  };

  const handleItemChange = (i, field, value) => {
    const updated = [...items];

    if (field === "description") {
      updated[i][field] = value;
      const matchedProduct = inventoryList.find(
        (p) => p.product_name === value,
      );

      if (matchedProduct) {
        updated[i].id = matchedProduct.id;
        updated[i].gst_rate = matchedProduct.gst_rate || 18;
        if (matchedProduct.hsn_code) {
          updated[i].hsn_code = matchedProduct.hsn_code;
        }
      } else {
        updated[i].id = null;
      }
    } else if (field === "manual_quantity") {
      updated[i][field] = value === "" ? null : value;
    } else {
      updated[i][field] =
        value === "" ? "" : field === "hsn_code" ? value : Number(value);
    }

    setItems(updated);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCompanyChange("qr_code_image", reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const compilePayload = () => {
    let flattenedItems = [];
    items.forEach((item) => {
      const effectiveQty = getEffectiveQty(item);

      if (item.subItems && item.subItems.length > 0) {
        for (let q = 0; q < effectiveQty; q++) {
          const sub = item.subItems[q] || { sn_code: "" };
          flattenedItems.push({
            product_id: item.id || null,
            description: item.description || "General Item",
            hsn_code:
              (sub.hsn_code ? sub.hsn_code.trim() : "") ||
              (item.hsn_code ? item.hsn_code.trim() : ""),
            quantity: 1,
            price: Number(item.price) || 0,
            gst_rate: Number(item.gst_rate) || 18,
            discount_percent: Number(item.discount_percent) || 0,
            sn_code: sub.sn_code || "", 
          });
        }
      } else {
        for (let q = 0; q < effectiveQty; q++) {
          flattenedItems.push({
            product_id: item.id || null,
            description: item.description || "General Item",
            hsn_code: item.hsn_code ? item.hsn_code.trim() : "",
            quantity: 1,
            price: Number(item.price) || 0,
            gst_rate: Number(item.gst_rate) || 18,
            discount_percent: Number(item.discount_percent) || 0,
            sn_code: "",
          });
        }
      }
    });

    const finalAdvance = isPaidMarked ? grandTotal : (Number(formData.advance_paid) || 0);

    const explicitStatus = isPaidMarked 
      ? "PAID" 
      : (formData.payment_mode && formData.payment_mode.includes("INSTALLMENT") ? "INSTALLMENT" : "DUE");

    return {
      doc_type: formData.doc_type || "INVOICE",
      company_name: formData.company_name || "",
      company_address: formData.company_address || "",
      company_showroom: formData.company_showroom || "",
      company_gstin: formData.company_gstin || "",
      company_state: formData.company_state || "",
      company_state_code: formData.company_state_code || "",
      company_phones: formData.company_phones || "",
      company_email: formData.company_email || "",
      company_pan: formData.company_pan || "",
      company_logo: formData.company_logo || "",

      client_name: formData.client_name || "Walk-in Customer",
      client_mobile: formData.client_mobile || "",
      client_email: formData.client_email || "",
      client_address: formData.client_address || "",
      client_gstin: formData.client_gstin || "",
      client_state: formData.client_state || "",
      client_state_code: formData.client_state_code || "",
      place_of_supply: formData.place_of_supply || "",
      firm_state_code: formData.company_state_code || "",

      invoice_number: formData.invoice_number || getNextInvoiceNumber(invoiceList, formData.doc_type),
      invoice_date: formData.invoice_date || new Date().toISOString().split("T")[0],
      delivery_note: formData.delivery_note || "",
      reference_no_date: formData.reference_no_date || "",
      other_references: formData.other_references || "",
      buyers_order_no: formData.buyers_order_no || "",
      order_dated: formData.order_dated || null,
      dispatch_doc_no: formData.dispatch_doc_no || "",
      delivery_note_date: formData.delivery_note_date || null,
      dispatched_through: formData.dispatched_through || "",
      destination: formData.destination || "",
      terms_of_delivery: formData.terms_of_delivery || "",

      bank_name: formData.bank_name || "",
      account_no: formData.account_no || "",
      branch_ifsc: formData.branch_ifsc || "",
      qr_code_image: formData.qr_code_image || "",
      digital_signature: formData.digital_signature || "",

      is_gst_enabled: formData.is_gst_enabled !== undefined ? formData.is_gst_enabled : true,
      installation_charges: Number(formData.installation_charges) || 0,
      
      payment_mode: formData.payment_mode || "FULL",
      advance_paid: finalAdvance,
      payment_status: explicitStatus,
      due_date: isPaidMarked && formData.payment_mode === "FULL" ? null : (formData.due_date || null),
      emi_start_date: formData.emi_start_date || null,

      items: flattenedItems,
    };
  };

  const handleSaveInvoiceData = async () => {
    if (!formData.client_name || !formData.client_name.trim()) {
      alert("Please enter a Client Name before saving.");
      throw new Error("Missing client name");
    }
    try {
      const payload = compilePayload();
      if (selectedInvoice && selectedInvoice.id) {
        await api.put(`/invoices/${selectedInvoice.id}`, payload);
      } else {
        await api.post("/invoices", payload);
      }
      const updatedInvoices = await fetchInvoices();
      await fetchInventory();
      return updatedInvoices;
    } catch (error) {
      const errMsg = formatError(error);
      console.error("Failed to save invoice", error.response?.data || error.message);
      alert(`Failed to save invoice:\n${errMsg}`);
      throw error;
    }
  };

  const clearDraftAndResetForm = (latestInvoices = invoiceList) => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setIsPaidMarked(false);
    setPreMarkAdvance(0);
    
    setFormData(prev => ({
      ...prev,
      company_name: prev.company_name,
      company_address: prev.company_address,
      company_showroom: prev.company_showroom,
      company_gstin: prev.company_gstin,
      company_state: prev.company_state,
      company_state_code: prev.company_state_code,
      company_phones: prev.company_phones,
      company_email: prev.company_email,
      company_pan: prev.company_pan,
      company_logo: prev.company_logo,
      digital_signature: prev.digital_signature,
      
      bank_name: prev.bank_name,
      account_no: prev.account_no,
      branch_ifsc: prev.branch_ifsc,
      qr_code_image: prev.qr_code_image,

      show_company_logo: prev.show_company_logo,
      show_digital_signature: prev.show_digital_signature,
      show_qr_code: prev.show_qr_code,
      
      invoice_number: getNextInvoiceNumber(latestInvoices, prev.doc_type || "INVOICE"),
      
      client_name: "",
      client_mobile: "",
      client_email: "",
      client_address: "",
      client_gstin: "",
      client_state: "",
      client_state_code: "",
      place_of_supply: "",
      invoice_date: new Date().toISOString().split("T")[0],
      delivery_note: "",
      payment_mode: "FULL",
      advance_paid: 0,
      due_date: "",
      emi_start_date: "",
      reference_no_date: "",
      other_references: "",
      buyers_order_no: "",
      order_dated: "",
      dispatch_doc_no: "",
      delivery_note_date: "",
      dispatched_through: "",
      destination: "",
      terms_of_delivery: "",
      installation_charges: 0,
      is_gst_enabled: true
    }));

    setItems([{
      id: null,
      description: "",
      hsn_code: "",
      price: 0,
      gst_rate: 18,
      discount_percent: 0,
      manual_quantity: null,
      subItems: [{ sn_code: "" }],
    }]);
    setSelectedInvoice(null);
  };

  const handleDeleteInvoice = (invoiceId) => {
    setInvoiceToDelete(invoiceId);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    
    try {
      await api.delete(`/invoices/${invoiceToDelete}`);
      const updatedInvoices = await fetchInvoices();
      await fetchInventory();
      
      if (selectedInvoice && selectedInvoice.id === invoiceToDelete) {
        clearDraftAndResetForm(updatedInvoices);
      }
      
      setInvoiceToDelete(null);
    } catch (error) {
      const errMsg = formatError(error);
      console.error("Failed to delete invoice", error.response?.data || error.message);
      alert(`Failed to delete invoice:\n${errMsg}`);
      setInvoiceToDelete(null);
    }
  };

  const downloadPDF = async () => {
    const pages = document.querySelectorAll(".invoice-page");
    if (pages.length === 0) return;

    pages.forEach((page) => {
      page.style.boxShadow = "none";
      page.style.transform = "none";
      page.style.margin = "0";
      page.style.zoom = "1";
    });

    try {
      const payload = compilePayload();
      let res;
      if (selectedInvoice && selectedInvoice.id) {
        res = await api.put(`/invoices/${selectedInvoice.id}`, payload);
      } else {
        res = await api.post("/invoices", payload);
      }
      const updatedInvoices = await fetchInvoices();
      await fetchInventory();

      const savedInvoiceNum = res.data?.invoice_number || payload.invoice_number;

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: paperSize,
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        const element = pages[i];

        const canvas = await html2canvas(element, {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollY: 0,
        });

        const imgData = canvas.toDataURL("image/png");

        if (i > 0) pdf.addPage();

        pdf.addImage(
          imgData,
          "PNG",
          0,
          0,
          pdfWidth,
          pdfPageHeight,
          undefined,
          "FAST"
        );
      }

      pdf.save(
        `${formData.doc_type}_${savedInvoiceNum}_${paperSize.toUpperCase()}.pdf`,
      );

      clearDraftAndResetForm(updatedInvoices);

    } catch (error) {
      const errMsg = formatError(error);
      console.error("Failed to save and download PDF", error.response?.data || error.message);
      alert(`Failed to save invoice before download:\n${errMsg}`);
    } finally {
      pages.forEach((page) => {
        page.style.boxShadow = "";
        page.style.transform = "";
        page.style.margin = "";
        page.style.zoom = ""; 
      });
    }
  };

  const handleNavigationRequest = (url) => {
    setPendingNavigationUrl(url);
    setShowExitModal(true);
  };

  const handleModalSaveAndExit = async () => {
    if (!formData.client_name || !formData.client_name.trim()) {
      clearDraftAndResetForm();
      setShowExitModal(false);
      if (pendingNavigationUrl) {
        navigate(pendingNavigationUrl);
      }
      return;
    }

    try {
      const updatedInvoices = await handleSaveInvoiceData();
      clearDraftAndResetForm(updatedInvoices);
      setShowExitModal(false);
      if (pendingNavigationUrl) {
        navigate(pendingNavigationUrl);
      }
    } catch (e) {
      // Keep modal open if save fails
    }
  };

  const handleModalDontSaveAndExit = () => {
    clearDraftAndResetForm();
    setShowExitModal(false);
    if (pendingNavigationUrl) {
      navigate(pendingNavigationUrl);
    }
  };

  const filteredInvoices = invoiceList.filter(
    (inv) =>
      inv.client_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusColor = (status) => {
    if (status === "PAID") return "#10b981";
    if (status === "PARTIAL") return "#f59e0b";
    return "#ef4444";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const numberToWords = (num) => {
    const fixedNum = Number(num).toFixed(2);
    const [rupeeStr, paiseStr] = fixedNum.split(".");
    
    let n = parseInt(rupeeStr, 10);
    const paise = parseInt(paiseStr, 10);

    if (n === 0 && paise === 0) return "Zero";

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen",
    ];
    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    const twoDigits = (val) => {
      if (val < 20) return ones[val];
      return tens[Math.floor(val / 10)] + (val % 10 ? "-" + ones[val % 10] : "");
    };

    const threeDigits = (val) => {
      if (val < 100) return twoDigits(val);
      return (
        ones[Math.floor(val / 100)] +
        " Hundred" +
        (val % 100 ? " " + twoDigits(val % 100) : "")
      );
    };

    let result = "";

    if (n > 0) {
      const crore = Math.floor(n / 10000000);
      n %= 10000000;
      const lakh = Math.floor(n / 100000);
      n %= 100000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;
      const rest = n;

      if (crore) result += threeDigits(crore) + " Crore ";
      if (lakh) result += threeDigits(lakh) + " Lakh ";
      if (thousand) result += threeDigits(thousand) + " Thousand ";
      if (rest) result += threeDigits(rest);
      
      result = result.trim();
    } else {
      result = "Zero";
    }

    if (paise > 0) {
      const paiseWords = twoDigits(paise);
      if (result === "Zero") {
        result = paiseWords + " Paise";
      } else {
        result += " and " + paiseWords + " Paise";
      }
    }

    return result.trim();
  };

  const ROWS_PER_FULL_PAGE = paperSize === "a5" ? 20 : 18; 
  const ROWS_PER_LAST_PAGE = paperSize === "a5" ? 10 : 12;

  const mainRows = items.map((item, index) => ({ type: "main", item, index }));
  const invoicePages = [];

  let remainingRows = [...mainRows];

  if (remainingRows.length === 0) {
    let pageItems = [];
    while (pageItems.length < ROWS_PER_LAST_PAGE) {
      pageItems.push({ type: "empty" });
    }
    invoicePages.push(pageItems);
  } else {
    while (remainingRows.length > 0) {
      if (remainingRows.length <= ROWS_PER_LAST_PAGE) {
        let pageItems = remainingRows.splice(0, remainingRows.length);
        while (pageItems.length < ROWS_PER_LAST_PAGE) {
          pageItems.push({ type: "empty" });
        }
        invoicePages.push(pageItems);
      } else {
        let pageItems = remainingRows.splice(0, ROWS_PER_FULL_PAGE);
        while (pageItems.length < ROWS_PER_FULL_PAGE) {
          pageItems.push({ type: "empty" });
        }
        invoicePages.push(pageItems);

        if (remainingRows.length === 0) {
          let footerPage = [];
          while (footerPage.length < ROWS_PER_LAST_PAGE) {
            footerPage.push({ type: "empty" });
          }
          invoicePages.push(footerPage);
        }
      }
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes spinSmooth {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        .btn.is-loading {
          pointer-events: none;
          opacity: 0.9;
        }

        .btn-content {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s ease;
          width: 100%;
        }

        .btn.is-loading .btn-content {
          opacity: 0;
        }

        .loader-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spinSmooth 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes bgDrift {
          0% { background-position: 0% 0%, 100% 100%, 0 0; }
          50% { background-position: 10% 5%, 90% 95%, 0 0; }
          100% { background-position: 0% 0%, 100% 100%, 0 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes gradientText {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.35); }
          50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, 0); }
        }
        @keyframes badgeBreathe {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.12); }
        }
        @keyframes shimmerSweep {
          0% { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(220%) skewX(-15deg); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        body { 
          background:
            radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.10), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(129, 90, 245, 0.10), transparent 40%),
            #090d16;
          background-size: 200% 200%, 200% 200%, auto;
          animation: bgDrift 22s ease-in-out infinite;
          font-family: 'Plus Jakarta Sans', sans-serif; 
          color: #f1f5f9; 
          margin: 0; 
          scroll-behavior: smooth;
        }
        
        .container { 
          max-width: 1700px; 
          margin: auto; 
          padding: 30px 20px; 
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          position: relative;
          z-index: 1;
        }

        .grid { 
          display: grid; 
          grid-template-columns: 540px 1fr; 
          gap: 30px; 
          align-items: start; 
        } 

        .panel { 
          background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); 
          padding: 30px; 
          border-radius: 20px; 
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
          animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: box-shadow 0.35s ease, border-color 0.35s ease;
        }

        .panel::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #38bdf8, #815af5, transparent);
          background-size: 200% 100%;
          animation: gradientText 6s linear infinite;
          opacity: 0.8;
        }

        .panel:hover {
          box-shadow: 0 24px 48px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.08);
        }

        .panel h3 { 
          margin-top: 0; 
          color: #ffffff; 
          margin-bottom: 24px; 
          font-size: 1.35rem; 
          font-weight: 700;
          letter-spacing: -0.01em;
          background: linear-gradient(90deg, #ffffff 0%, #38bdf8 50%, #ffffff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientText 5s ease-in-out infinite;
          display: inline-block;
        }

        .input-group { 
          margin-bottom: 20px; 
          background: rgba(15, 23, 42, 0.6); 
          padding: 20px; 
          border-radius: 14px; 
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
        }

        .input-group:hover {
          border-color: rgba(56, 189, 248, 0.2);
          box-shadow: 0 8px 24px -12px rgba(56, 189, 248, 0.2);
        }

        .input-group label { 
          display: block; 
          font-size: 11px; 
          color: #38bdf8; 
          margin-bottom: 12px; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 1px;
        }

        .input { 
          width: 100%; 
          padding: 12px 14px; 
          border-radius: 10px; 
          border: 1px solid rgba(255, 255, 255, 0.1); 
          background: rgba(30, 41, 59, 0.7); 
          color: #ffffff; 
          font-size: 13.5px; 
          box-sizing: border-box; 
          transition: all 0.25s ease;
          font-family: inherit;
        }

        .input:hover {
          border-color: rgba(56, 189, 248, 0.35);
        }

        .input:focus { 
          outline: none; 
          border-color: #38bdf8; 
          background: rgba(30, 41, 59, 1);
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15);
          transform: translateY(-1px);
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        @media (max-width: 560px) {
          .field-row { grid-template-columns: 1fr; }
        }

        .img-upload-card {
          display: flex;
          flex-direction: column;
        }
        .img-upload-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .img-upload-show {
          font-size: 10px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .img-preview-box {
          height: 56px;
          border-radius: 8px;
          border: 1px dashed rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          overflow: hidden;
        }
        .img-preview-box img {
          max-height: 44px;
          max-width: 100%;
          object-fit: contain;
        }
        .img-preview-empty {
          font-size: 10px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
        }
        .img-upload-actions {
          display: flex;
          gap: 6px;
          align-items: stretch;
        }
        .img-upload-actions .file-input-wrap {
          flex: 1;
        }
        .img-reset-btn {
          flex-shrink: 0;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.12);
          color: #fca5a5;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.15s ease, border-color 0.2s ease;
        }
        .img-reset-btn:hover {
          background: rgba(248, 113, 113, 0.22);
          border-color: rgba(248, 113, 113, 0.5);
          transform: translateY(-1px);
        }
        .img-reset-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        .item-card { 
          background: rgba(30, 41, 59, 0.5); 
          padding: 18px; 
          border-radius: 12px; 
          margin-bottom: 16px; 
          border: 1px solid rgba(255, 255, 255, 0.06); 
          animation: fadeInScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
        }

        .item-card:hover {
          border-color: rgba(56, 189, 248, 0.25);
          background: rgba(30, 41, 59, 0.75);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -14px rgba(56, 189, 248, 0.35);
        }

        .item-label { 
          font-size: 10px; 
          color: #94a3b8; 
          text-transform: uppercase; 
          margin-bottom: 6px; 
          display: block; 
          font-weight: 700; 
          letter-spacing: 0.5px;
        }

        .btn { 
          padding: 12px 20px; 
          border-radius: 10px; 
          border: none; 
          cursor: pointer; 
          font-weight: 600; 
          font-size: 13.5px; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          display: inline-flex; 
          align-items: center; 
          justify-content: center; 
          gap: 8px;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        .btn:active {
          transform: scale(0.96);
        }

        .btn-primary { 
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); 
          color: #0f172a; 
          width: 100%; 
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
        }

        .btn-primary::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
          transform: translateX(-120%) skewX(-15deg);
        }

        .btn-primary:hover::after {
          animation: shimmerSweep 0.9s ease;
        }
        
        .btn-primary:hover { 
          background: linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%); 
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(56, 189, 248, 0.45);
        }

        .btn-secondary { 
          background: rgba(51, 65, 85, 0.8); 
          color: white; 
          width: 100%; 
          margin-bottom: 10px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .btn-secondary:hover { 
          background: rgba(71, 85, 105, 1); 
          transform: translateY(-1px);
          box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.5);
        }

        .btn-danger { 
          background: rgba(239, 68, 68, 0.15); 
          color: #f87171; 
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 10px; 
        }
        .btn-danger:hover {
          background: #ef4444;
          color: white;
          transform: translateY(-1px) rotate(-1deg);
          box-shadow: 0 6px 14px -6px rgba(239, 68, 68, 0.6);
        }

        .history-list { 
          max-height: 420px; 
          overflow-y: auto; 
          padding-right: 4px; 
        }
        .history-list::-webkit-scrollbar { width: 5px; }
        .history-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        .history-item { 
          padding: 16px; 
          border-radius: 12px; 
          border: 1px solid rgba(255, 255, 255, 0.06); 
          margin-bottom: 12px; 
          cursor: pointer; 
          background: rgba(15, 23, 42, 0.5); 
          transition: all 0.2s ease; 
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .history-item:hover { 
          border-color: #38bdf8; 
          background: rgba(30, 41, 59, 0.7);
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 10px 26px -14px rgba(56, 189, 248, 0.5);
        }
        .history-item-content { flex-grow: 1; margin-right: 15px; }
        .history-item-header { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; color: white; text-transform: uppercase; letter-spacing: 0.5px; animation: badgeBreathe 2.6s ease-in-out infinite; display: inline-block; }
        
        .history-delete-btn {
          background: none;
          border: none;
          color: rgba(239, 68, 68, 0.6);
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
          transition: color 0.2s ease, transform 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .history-delete-btn:hover {
          color: #ef4444;
          transform: scale(1.1);
        }

        .invoice-wrapper { 
          overflow-x: hidden;
          background: linear-gradient(145deg, #131c31 0%, #0e1626 100%); 
          padding: 25px; 
          border-radius: 20px; 
          display: flex; 
          flex-direction: column; 
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.08s;
        }

        .invoice-wrapper .ti-paper {
          transition: box-shadow 0.4s ease, transform 0.4s ease;
        }
        .invoice-wrapper .ti-paper:hover {
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          transform: translateY(-3px);
        }

        @media (max-width: 1650px) { .ti-paper { zoom: 0.88; } }
        @media (max-width: 1500px) { .ti-paper { zoom: 0.78; } }
        @media (max-width: 1350px) { .ti-paper { zoom: 0.68; } }
        @media (max-width: 1200px) { .ti-paper { zoom: 0.58; } }
        @media (max-width: 1050px) {
          .grid { grid-template-columns: 1fr; } 
          .ti-paper { zoom: 0.85; } 
        }
        @media (max-width: 768px) { .ti-paper { zoom: 0.6; } }

        .ti-paper { 
          background: white; 
          color: #000; 
          width: 210mm; 
          min-height: 297mm; 
          padding: 14mm 12mm; 
          box-sizing: border-box; 
          position: relative; 
          font-family: "Arial", sans-serif; 
          box-shadow: 0 15px 35px rgba(0,0,0,0.4); 
          overflow: hidden; 
          font-size: 11px; 
          line-height: 1.45;
          display: flex; 
          flex-direction: column;
        }
        
        .ti-paper.ti-a5-preview { 
          width: 148mm !important; 
          min-height: 210mm !important; 
          padding: 6mm 6mm !important;
          font-size: 7.5px !important; 
          line-height: 1.2 !important;
        }

        .ti-paper.ti-a5-preview .ti-items td:nth-child(2) strong { font-size: 9px !important; }
        .ti-paper.ti-a5-preview .ti-items td:nth-child(2) div { font-size: 8px !important; line-height: 1.2 !important; }
        
        .ti-paper.ti-a5-preview .ti-title { font-size: 12px !important; margin-bottom: 4px !important; letter-spacing: 1px !important; }
        .ti-paper.ti-a5-preview .ti-box { padding: 6px !important; }
        .ti-paper.ti-a5-preview .ti-top, .ti-paper.ti-a5-preview .ti-company-name, .ti-paper.ti-a5-preview .ti-bottom { padding: 0 !important; }
        .ti-paper.ti-a5-preview .ti-buyer-name { font-size: 9px !important; }
        .ti-paper.ti-a5-preview .ti-meta-table td { padding: 4px 6px !important; font-size: 7.5px !important; height: 22px !important;}
        
        .ti-paper.ti-a5-preview .ti-items th { padding: 8px 5px !important; font-size: 8.5px !important; }
        .ti-paper.ti-a5-preview .ti-items td { padding: 8px 5px !important; font-size: 8px !important; }
        
        .ti-paper.ti-a5-preview .text-center, 
        .ti-paper.ti-a5-preview .text-right,
        .ti-paper.ti-a5-preview .ti-items th { white-space: nowrap !important; width: 1%; }
        
        .ti-paper.ti-a5-preview .ti-items th:nth-child(2),
        .ti-paper.ti-a5-preview .ti-items td:nth-child(2) { white-space: normal !important; width: auto; word-break: break-word; overflow-wrap: anywhere;}
        .ti-paper.ti-a5-preview .ti-decl-text { font-size: 6.5px !important; line-height: 1.15 !important; }
        .ti-paper.ti-a5-preview .ti-sig-space { height: 14px !important; }
        .ti-paper.ti-a5-preview .ti-footer-page { font-size: 7.5px !important; margin-top: 5px !important; }

        .avoid-break { page-break-inside: avoid; break-inside: avoid; }

        .ti-title { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 0 0 10px 0; text-transform: uppercase; position: relative; z-index: 1;}
        .ti-box { border: 1px solid #000; padding: 8px 10px; position: relative; z-index: 1; margin-top: -1px; }
        .ti-box p { margin: 2px 0; }

        .ti-top { display: flex; padding: 0; }
        .ti-top-left{ flex: 1.45; padding: 8px 10px; border-right: 1px solid #000; line-height: 1.35; }
        .ti-top-left p{ margin:2px 0; }
        .ti-company-name{ font-size:18px; font-weight:bold; }
        .ti-buyer-name{ font-size:16px; font-weight:bold; }
        
        .ti-meta-table { flex: 1; border-collapse: separate; border-spacing: 0; }
        .ti-meta-table td { border: none; border-bottom: 1px solid #000; padding: 5px 8px; font-size: 11px; vertical-align: top; height: 28px; }
        .ti-meta-table td:first-child { border-right: 1px solid #000; }
        .ti-meta-table tr:last-child td { border-bottom: none; }

        .ti-table-wrapper {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .ti-items { width: 100%; height: 100%; border-collapse: separate; border-spacing: 0; margin-top: -1px; position: relative; z-index: 1; }
        
        .ti-items th { border-bottom: 1px solid #000; border-right: 1px solid #000; border-top: 1px solid #000; border-left: none; padding: 12px 10px; font-size: 10.5px; font-weight: bold; text-align: center; background: #f8fafc; }
        .ti-items th:first-child { border-left: 1px solid #000; }
        
        .ti-items td { border-right: 1px solid #000; border-left: none; padding: 12px 10px; font-size: 11px; vertical-align: top; }
        .ti-items td:first-child { border-left: 1px solid #000; }
        .ti-items tbody tr:first-child td { border-top: none; }
        .ti-items tr.ti-tax-row td { padding-top: 6px; padding-bottom: 6px; color: #000; border-bottom: none !important; font-size: 11px; font-weight: 600; }
        .ti-items tr.ti-tax-row.top-line td { border-top: 1px solid #000 !important; }
        .ti-items tr.ti-tax-row:not(.top-line) td { border-top: none !important; }
        .ti-items tfoot td { border-top: 1px solid #000; border-bottom: 1px solid #000; border-right: 1px solid #000; border-left: none; padding: 10px 8px; font-size: 12px; background: #f8fafc; }
        .ti-items tfoot td:first-child { border-left: 1px solid #000; }
        .ti-items .text-center { text-align: center; }

        .ti-footer-block {
          margin-top: auto; 
          flex-shrink: 0;
        }

        .ti-words { font-size: 11.5px; background: #fdfdfd; }
        .ti-bottom { display: flex; padding: 0; }
        .ti-bottom-left { flex: 1.5; padding: 8px 10px; border-right: 1px solid #000; }
        .ti-bottom-right { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; }
        .ti-decl-title { font-weight: bold; text-decoration: underline; margin-top: 8px !important; }
        .ti-decl-text { font-size: 9.5px; color: #333; line-height: 1.5; }
        .ti-bank-title { font-weight: bold; text-align: center; margin-bottom: 6px !important; }
        .ti-for-company { margin-top: 18px !important; font-weight: 500; }
        .ti-sig-space { height: 34px; }
        .ti-sig-label { text-align: right; font-weight: bold; margin-top: 0 !important; }
        .ti-footer-page { font-size: 10px; color: #64748b; margin-top: 10px; position: relative; z-index: 1; }

        .text-right { text-align: right !important; }

        .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; color: #94a3b8; transition: color 0.3s ease; }
        .summary-row.total { font-size: 17px; font-weight: 800; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 12px; margin-top: 6px; }
        .summary-row.advance { font-weight: bold; }
        .summary-row.balance { font-weight: 800; font-size: 15px; padding-top: 4px; color: #38bdf8 !important; animation: pulseGlow 2.4s ease-in-out infinite; border-radius: 8px; }

        .bg-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
          animation: floatSlow 9s ease-in-out infinite;
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(9, 13, 22, 0.8);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeInUp 0.3s ease both;
        }
        .modal-box {
          background: linear-gradient(145deg, #131c31 0%, #0e1626 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 30px;
          border-radius: 16px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 50px rgba(0,0,0,0.6);
        }
        .modal-box h4 {
          margin-top: 0;
          color: #ffffff;
          font-size: 1.25rem;
          margin-bottom: 12px;
        }
        .modal-box p {
          color: #94a3b8;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            background-attachment: initial !important;
          }
        }
      `}</style>

      {showExitModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>Save Invoice Draft?</h4>
            <p>You have unsaved changes or active edits in this document. Would you like to save this invoice before leaving?</p>
            <div className="modal-actions">
              <LoadingButton
                className="btn btn-secondary"
                style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                onClick={handleModalDontSaveAndExit}
              >
                Don't Save
              </LoadingButton>
              <LoadingButton
                className="btn btn-primary"
                style={{ background: "#10b981", color: "white" }}
                onClick={handleModalSaveAndExit}
              >
                Save Invoice
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⚠️</div>
            <h4 style={{ color: "#f87171" }}>Permanently Delete?</h4>
            <p>
              Are you absolutely sure you want to delete this document? 
              This action cannot be undone and will affect inventory stock levels linked to it.
            </p>
            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <LoadingButton
                className="btn btn-secondary"
                onClick={() => setInvoiceToDelete(null)}
              >
                Cancel
              </LoadingButton>
              <LoadingButton
                className="btn btn-danger"
                style={{ background: "#ef4444", color: "white" }}
                onClick={confirmDeleteInvoice}
              >
                Delete Permanently
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      <div
        className="bg-blob"
        style={{
          top: "-120px",
          left: "-100px",
          width: "360px",
          height: "360px",
          background: "rgba(56, 189, 248, 0.16)",
        }}
      />
      <div
        className="bg-blob"
        style={{
          bottom: "-140px",
          right: "-100px",
          width: "420px",
          height: "420px",
          background: "rgba(129, 90, 245, 0.14)",
          animationDelay: "2s",
        }}
      />

      <datalist id="inventory-list">
        {inventoryList.map((product) => (
          <option key={product.id} value={product.product_name}>
            ₹{product.selling_price} (Stock: {product.stock_quantity})
          </option>
        ))}
      </datalist>

      <div
        className="container"
        onKeyDown={(e) => e.stopPropagation()}
        onKeyPress={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <div className="grid">
          {/* ================= LEFT PANEL ================= */}
          <div className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <LoadingButton
                  className="btn btn-secondary"
                  title="Back to Dashboard"
                  style={{
                    margin: 0,
                    padding: 0,
                    width: "36px",
                    height: "36px",
                    fontSize: "18px",
                    background: "rgba(51, 65, 85, 0.6)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                  }}
                  onClick={() => handleNavigationRequest("/")}
                >
                  ←
                </LoadingButton>
                <h3 style={{ margin: 0 }}>Billing Console</h3>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <LoadingButton
                  className="btn btn-secondary"
                  style={{
                    margin: 0,
                    padding: "10px 14px",
                    background: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                  onClick={() => handleNavigationRequest("/inventory")}
                >
                  📦 Inventory
                </LoadingButton>
                <select
                  className="input"
                  style={{
                    width: "auto",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    fontWeight: "700",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                  value={formData.doc_type}
                  onChange={(e) => {
                    const newDocType = e.target.value;
                    setFormData((prev) => ({ 
                      ...prev, 
                      doc_type: newDocType,
                      invoice_number: getNextInvoiceNumber(invoiceList, newDocType)
                    }));
                  }}
                >
                  <option value="INVOICE" style={{ background: "#0f172a" }}>
                    TAX INVOICE
                  </option>
                  <option value="QUOTATION" style={{ background: "#0f172a" }}>
                    QUOTATION
                  </option>
                </select>
              </div>
            </div>

            {/* COMPANY HEADER DETAILS & LOGO / SIGNATURE UPLOAD */}
            <div className="input-group">
              <label>Company Header Details & Branding</label>
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Company Name"
                value={formData.company_name}
                onChange={(e) => handleCompanyChange("company_name", e.target.value)}
              />
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Company Address"
                value={formData.company_address}
                onChange={(e) => handleCompanyChange("company_address", e.target.value)}
              />

              <div className="field-row">
                <input
                  className="input"
                  placeholder="Company GSTIN"
                  value={formData.company_gstin}
                  onChange={(e) => handleCompanyChange("company_gstin", e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Company PAN"
                  value={formData.company_pan}
                  onChange={(e) => handleCompanyChange("company_pan", e.target.value.toUpperCase())}
                />
              </div>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Company State"
                  value={formData.company_state}
                  onChange={(e) => handleCompanyChange("company_state", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="State Code (e.g. 19)"
                  value={formData.company_state_code}
                  onChange={(e) => handleCompanyChange("company_state_code", e.target.value)}
                />
              </div>
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Phone Numbers"
                value={formData.company_phones}
                onChange={(e) => handleCompanyChange("company_phones", e.target.value)}
              />
              <input
                className="input"
                style={{ marginBottom: "15px" }}
                placeholder="Company Email"
                value={formData.company_email}
                onChange={(e) => handleCompanyChange("company_email", e.target.value)}
              />

              {/* LOGO & SIGNATURE UPLOADS */}
              <div className="field-row" style={{ marginBottom: 0 }}>
                <div className="img-upload-card">
                  <div className="img-upload-head">
                    <span className="item-label" style={{ color: "#38bdf8", margin: 0 }}>Company Logo</span>
                    <label className="img-upload-show">
                      <input type="checkbox" checked={formData.show_company_logo} onChange={(e) => handleCompanyChange("show_company_logo", e.target.checked)} style={{ accentColor: "#38bdf8" }} />
                      Show
                    </label>
                  </div>
                  <div className="img-preview-box">
                    {formData.company_logo ? (
                      <img src={formData.company_logo} alt="Logo" />
                    ) : (
                      <span className="img-preview-empty">No logo</span>
                    )}
                  </div>
                  <div className="img-upload-actions">
                    <div className="file-input-wrap">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ padding: "6px", fontSize: "11px", background: "rgba(30, 41, 59, 0.7)", width: "100%", boxSizing: "border-box", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      />
                    </div>
                    <button type="button" className="img-reset-btn" onClick={handleResetLogo} disabled={!formData.company_logo} title="Remove logo">
                      Reset
                    </button>
                  </div>
                </div>
                <div className="img-upload-card">
                  <div className="img-upload-head">
                    <span className="item-label" style={{ color: "#38bdf8", margin: 0 }}>Digital Signature</span>
                    <label className="img-upload-show">
                      <input type="checkbox" checked={formData.show_digital_signature} onChange={(e) => handleCompanyChange("show_digital_signature", e.target.checked)} style={{ accentColor: "#38bdf8" }} />
                      Show
                    </label>
                  </div>
                  <div className="img-preview-box" style={{ background: formData.digital_signature ? "#fff" : "rgba(15, 23, 42, 0.5)" }}>
                    {formData.digital_signature ? (
                      <img src={formData.digital_signature} alt="Signature" />
                    ) : (
                      <span className="img-preview-empty">No signature</span>
                    )}
                  </div>
                  <div className="img-upload-actions">
                    <div className="file-input-wrap">
                      <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        style={{ padding: "6px", fontSize: "11px", background: "rgba(30, 41, 59, 0.7)", width: "100%", boxSizing: "border-box", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      />
                    </div>
                    <button type="button" className="img-reset-btn" onClick={handleResetSignature} disabled={!formData.digital_signature} title="Remove signature">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* BUYER DETAILS */}
            <div className="input-group">
              <label>Buyer (Bill To) Details</label>
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Client Name"
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
              />
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Mobile Number"
                  value={formData.client_mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, client_mobile: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="GSTIN"
                  value={formData.client_gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, client_gstin: e.target.value })
                  }
                />
              </div>
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Client Address"
                value={formData.client_address}
                onChange={(e) =>
                  setFormData({ ...formData, client_address: e.target.value })
                }
              />
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Client State"
                  value={formData.client_state}
                  onChange={(e) =>
                    setFormData({ ...formData, client_state: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="State Code"
                  value={formData.client_state_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      client_state_code: e.target.value,
                    })
                  }
                />
              </div>
              <input
                className="input"
                placeholder="Place of Supply"
                value={formData.place_of_supply}
                onChange={(e) =>
                  setFormData({ ...formData, place_of_supply: e.target.value })
                }
              />
            </div>

            {/* INVOICE REFERENCE & METADATA */}
            <div className="input-group">
              <label>Invoice Reference & Metadata</label>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Invoice No."
                  value={formData.invoice_number}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_number: e.target.value })
                  }
                />
                <input
                  type="date"
                  className="input"
                  placeholder="Dated"
                  value={formData.invoice_date}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_date: e.target.value })
                  }
                />
              </div>
              
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
              >
                <div style={{ flex: 1 }}>
                  <span className="item-label" style={{ color: "#38bdf8" }}>Delivery Note</span>
                  <input
                    className="input"
                    placeholder="Delivery Note"
                    value={formData.delivery_note}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_note: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* PAYMENT MODE & TERMS SELECTION */}
              <div style={{ display: "grid", gridTemplateColumns: formData.payment_mode === "FULL" ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <span className="item-label" style={{ color: "#38bdf8" }}>Payment Mode</span>
                  <select
                    className="input"
                    value={formData.payment_mode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      setFormData({ 
                        ...formData, 
                        payment_mode: newMode,
                        ...(newMode === "FULL" ? { advance_paid: 0 } : {}) 
                      });
                    }}
                  >
                    <option value="FULL">Full Payment</option>
                    <option value="INSTALLMENT">Installment (General)</option>
                    <option value="INSTALLMENT_3">3-Part Installment</option>
                    <option value="INSTALLMENT_4">4-Part Installment</option>
                  </select>
                </div>
                
                {formData.payment_mode !== "FULL" && !isPaidMarked && (
                  <div>
                    <span className="item-label" style={{ color: "#38bdf8" }}>Advance Paid (₹)</span>
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      value={formData.advance_paid}
                      onChange={(e) => setFormData({ ...formData, advance_paid: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "10px" }}>
                {formData.payment_mode === "FULL" && !isPaidMarked ? (
                  <div>
                    <span className="item-label" style={{ color: "#38bdf8" }}>Due Date</span>
                    <input
                      type="date"
                      className="input"
                      value={formData.due_date || ""}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                ) : !isPaidMarked ? (
                  <div>
                    <span className="item-label" style={{ color: "#38bdf8" }}>EMI Start Date</span>
                    <input
                      type="date"
                      className="input"
                      value={formData.emi_start_date || ""}
                      onChange={(e) => setFormData({ ...formData, emi_start_date: e.target.value })}
                    />
                  </div>
                ) : null}
              </div>

              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Reference No. & Date"
                  value={formData.reference_no_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reference_no_date: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="Other References"
                  value={formData.other_references}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      other_references: e.target.value,
                    })
                  }
                />
              </div>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Buyer's Order No."
                  value={formData.buyers_order_no}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      buyers_order_no: e.target.value,
                    })
                  }
                />
                <input
                  type="date"
                  className="input"
                  placeholder="Order Dated"
                  value={formData.order_dated}
                  onChange={(e) =>
                    setFormData({ ...formData, order_dated: e.target.value })
                  }
                />
              </div>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Dispatch Doc No."
                  value={formData.dispatch_doc_no}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dispatch_doc_no: e.target.value,
                    })
                  }
                />
                <input
                  type="date"
                  className="input"
                  placeholder="Delivery Note Date"
                  value={formData.delivery_note_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delivery_note_date: e.target.value,
                    })
                  }
                />
              </div>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Dispatched Through"
                  value={formData.dispatched_through}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dispatched_through: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="Destination"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                />
              </div>
              <input
                className="input"
                placeholder="Terms of Delivery"
                value={formData.terms_of_delivery}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    terms_of_delivery: e.target.value,
                  })
                }
              />
            </div>

            {/* LINE ITEMS */}
            <div className="input-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <label style={{ margin: 0 }}>Line Items</label>
                <label
                  style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    color: "#f1f5f9",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.is_gst_enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_gst_enabled: e.target.checked,
                      })
                    }
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "#38bdf8",
                    }}
                  />
                  Enable GST
                </label>
              </div>

              {items.map((item, i) => {
                const autoQty = item.subItems ? item.subItems.length : 0;
                const qty = getEffectiveQty(item);

                const baseTotal = (Number(item.price) || 0) * qty;
                const discAmt = baseTotal * ((Number(item.discount_percent) || 0) / 100);
                const displayedTotal = baseTotal - discAmt;

                return (
                  <div key={i} className="item-card">
                    <div style={{ marginBottom: "12px" }}>
                      <span className="item-label">
                        Brand / Product Category Name
                      </span>
                      <input
                        className="input"
                        list="inventory-list"
                        placeholder="E.g., CP Plus / Hikvision"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(i, "description", e.target.value)
                        }
                        autoComplete="off"
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <span className="item-label">Product HSN Number</span>
                        <input
                          className="input"
                          placeholder="HSN No."
                          value={item.hsn_code}
                          onChange={(e) =>
                            handleItemChange(i, "hsn_code", e.target.value)
                          }
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <span className="item-label">Price (₹)</span>
                        <input
                          className="input"
                          type="number"
                          placeholder="0"
                          value={item.price || ""}
                          onChange={(e) =>
                            handleItemChange(i, "price", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.4)",
                        padding: "12px",
                        borderRadius: "10px",
                        marginBottom: "10px",
                        borderLeft: "3px solid #38bdf8",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "10px",
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <span
                            className="item-label"
                            style={{ fontSize: "9px" }}
                          >
                            Individual Serial Number
                          </span>
                          <input
                            className="input"
                            style={{ padding: "8px 10px", fontSize: "13px" }}
                            placeholder="Serial Number"
                            value={item.subItems[0]?.sn_code || ""}
                            onChange={(e) => {
                              const updated = [...items];
                              if(updated[i].subItems.length === 0) {
                                  updated[i].subItems.push({ sn_code: "" });
                              }
                              updated[i].subItems[0].sn_code = e.target.value;
                              setItems(updated);
                            }}
                          />
                        </div>
                        <LoadingButton
                          type="button"
                          className="btn"
                          style={{
                            background: "rgba(16, 185, 129, 0.2)",
                            color: "#34d399",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            padding: "0",
                            width: "38px",
                            height: "38px",
                            fontSize: "16px",
                          }}
                          title="Add item variant"
                          onClick={() => {
                            const updated = [...items];
                            updated[i].subItems.push({ sn_code: "" });
                            setItems(updated);
                          }}
                        >
                          +
                        </LoadingButton>
                      </div>
                    </div>

                    {item.subItems &&
                      item.subItems.slice(1).map((sub, sIndex) => {
                        const actualIndex = sIndex + 1;
                        return (
                          <div
                            key={actualIndex}
                            style={{
                              background: "rgba(15, 23, 42, 0.4)",
                              padding: "12px",
                              borderRadius: "10px",
                              marginBottom: "10px",
                              borderLeft: "3px solid #10b981",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto auto",
                                gap: "10px",
                                alignItems: "end",
                              }}
                            >
                              <div>
                                <span
                                  className="item-label"
                                  style={{ fontSize: "9px" }}
                                >
                                  Individual Serial Number
                                </span>
                                <input
                                  className="input"
                                  style={{
                                    padding: "8px 10px",
                                    fontSize: "13px",
                                  }}
                                  placeholder="Serial Number"
                                  value={sub.sn_code}
                                  onChange={(e) => {
                                    const updated = [...items];
                                    updated[i].subItems[actualIndex].sn_code =
                                      e.target.value;
                                    setItems(updated);
                                  }}
                                />
                              </div>
                              <LoadingButton
                                type="button"
                                className="btn btn-danger"
                                style={{
                                  padding: "0",
                                  width: "38px",
                                  height: "38px",
                                }}
                                onClick={() => {
                                  const updated = [...items];
                                  updated[i].subItems.splice(actualIndex, 1);
                                  setItems(updated);
                                }}
                              >
                                ✕
                              </LoadingButton>
                              <LoadingButton
                                type="button"
                                className="btn"
                                style={{
                                  background: "rgba(16, 185, 129, 0.2)",
                                  color: "#34d399",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  padding: "0",
                                  width: "38px",
                                  height: "38px",
                                  fontSize: "16px",
                                }}
                                title="Add item variant"
                                onClick={() => {
                                  const updated = [...items];
                                  updated[i].subItems.splice(
                                    actualIndex + 1,
                                    0,
                                    {
                                      sn_code: "",
                                    },
                                  );
                                  setItems(updated);
                                }}
                              >
                                +
                              </LoadingButton>
                            </div>
                          </div>
                        );
                      })}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: formData.is_gst_enabled
                          ? "1fr 1fr 1fr 1fr auto"
                          : "1fr 1fr 1fr auto",
                        gap: "12px",
                        alignItems: "end",
                        marginTop: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span className="item-label" style={{ margin: 0 }}>Quantity</span>
                          {hasManualQuantity(item) && (
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: "#38bdf8", fontSize: "9px", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                              onClick={() => handleItemChange(i, "manual_quantity", null)}
                              title="Reset to auto count from serial numbers"
                            >
                              Reset Auto ({autoQty})
                            </button>
                          )}
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder={autoQty || 1}
                          value={hasManualQuantity(item) ? item.manual_quantity : ""}
                          onChange={(e) => handleItemChange(i, "manual_quantity", e.target.value)}
                          title="Override quantity manually or leave blank for auto count"
                        />
                      </div>

                      <div>
                        <span className="item-label">Disc. %</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.discount_percent || ""}
                          onChange={(e) =>
                            handleItemChange(i, "discount_percent", e.target.value)
                          }
                          title="Discount % per item"
                        />
                      </div>

                      {formData.is_gst_enabled && (
                        <div>
                          <span className="item-label">GST %</span>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.gst_rate}
                            onChange={(e) =>
                              handleItemChange(i, "gst_rate", e.target.value)
                            }
                            title="GST Rate %"
                          />
                        </div>
                      )}

                      <div>
                        <span className="item-label">Total Amount</span>
                        <div
                          style={{
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "0 12px",
                            height: "41px",
                            color: "#38bdf8",
                            fontSize: "13.5px",
                            display: "flex",
                            alignItems: "center",
                            fontWeight: "700",
                          }}
                        >
                          ₹ {displayedTotal.toFixed(2)}
                        </div>
                      </div>

                      <LoadingButton
                        className="btn btn-danger"
                        style={{ height: "41px", padding: "0 14px" }}
                        onClick={() => removeItem(i)}
                      >
                        ✕
                      </LoadingButton>
                    </div>
                  </div>
                );
              })}

              <LoadingButton
                className="btn btn-secondary"
                style={{
                  background: "rgba(56, 189, 248, 0.1)",
                  color: "#38bdf8",
                  border: "1px dashed rgba(56, 189, 248, 0.3)",
                  padding: "14px",
                }}
                onClick={addItem}
              >
                + Add Product Category
              </LoadingButton>
            </div>

            {/* BANK & ADDITIONAL DETAILS */}
            <div className="input-group">
              <label>Bank & Additional Details</label>
              <div
                className="field-row"
              >
                <input
                  className="input"
                  placeholder="Bank Name"
                  value={formData.bank_name}
                  onChange={(e) => handleCompanyChange("bank_name", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Account No."
                  value={formData.account_no}
                  onChange={(e) => handleCompanyChange("account_no", e.target.value)}
                />
              </div>
              <input
                className="input"
                style={{ marginBottom: "10px" }}
                placeholder="Branch & IFSC Code"
                value={formData.branch_ifsc}
                onChange={(e) => handleCompanyChange("branch_ifsc", e.target.value)}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <span className="item-label" style={{ color: "#38bdf8" }}>
                    Installation Charges (₹)
                  </span>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 0"
                    value={formData.installation_charges}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        installation_charges: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <div className="img-upload-card">
                  <div className="img-upload-head">
                    <span className="item-label" style={{ margin: 0 }}>Payment QR Code (Optional)</span>
                    <label className="img-upload-show">
                      <input type="checkbox" checked={formData.show_qr_code} onChange={(e) => handleCompanyChange("show_qr_code", e.target.checked)} style={{ accentColor: "#38bdf8" }} />
                      Show
                    </label>
                  </div>
                  <div className="img-preview-box">
                    {formData.qr_code_image ? (
                      <img src={formData.qr_code_image} alt="QR" />
                    ) : (
                      <span className="img-preview-empty">No QR code</span>
                    )}
                  </div>
                  <div className="img-upload-actions">
                    <div className="file-input-wrap">
                      <input
                        ref={qrInputRef}
                        className="input"
                        type="file"
                        accept="image/*"
                        onChange={handleQrUpload}
                        style={{ padding: "8px", background: "rgba(30, 41, 59, 0.7)", width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <button type="button" className="img-reset-btn" onClick={handleResetQr} disabled={!formData.qr_code_image} title="Remove QR code">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                padding: "20px",
                borderRadius: "14px",
                marginBottom: "24px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="summary-row">
                <span>Subtotal (After Discounts):</span> <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="summary-row">
                  <span>Total Discount Saved:</span> <span style={{ color: "#34d399" }}>- ₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {formData.is_gst_enabled && (
                <div className="summary-row">
                  <span>Tax Estimate:</span> <span>₹{tax.toFixed(2)}</span>
                </div>
              )}
              {installation > 0 && (
                <div className="summary-row">
                  <span>Installation Charges:</span>{" "}
                  <span>₹{installation.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row total" style={{ color: "white" }}>
                <span>Grand Total:</span>{" "}
                <span style={{ color: "#38bdf8" }}>
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
              {Number(formData.advance_paid) > 0 && !isPaidMarked && (
                <div className="summary-row advance" style={{ color: "#34d399", marginTop: "8px" }}>
                  <span>Advance Paid:</span> <span>- ₹{Number(formData.advance_paid).toFixed(2)}</span>
                </div>
              )}
              {isPaidMarked && (
                <div className="summary-row advance" style={{ color: "#10b981", marginTop: "8px" }}>
                  <span>Paid Status:</span> <span>Fully Paid (₹{grandTotal.toFixed(2)})</span>
                </div>
              )}
              <div className="summary-row balance" style={{ marginTop: "6px" }}>
                <span>Remaining Balance Due:</span> <span>₹{balance.toFixed(2)}</span>
              </div>
            </div>

            <hr
              style={{
                margin: "30px 0",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            />

            <h3>Recent Invoices</h3>
            <input
              className="input"
              style={{ marginBottom: "16px" }}
              placeholder="Search by name or doc #"
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="history-list">
              {filteredInvoices.map((inv) => {
                const isCurrentActiveSelected = selectedInvoice && selectedInvoice.id === inv.id;

                let badgeText = "";
                let badgeBg = "";

                if (isCurrentActiveSelected) {
                  if (isPaidMarked) {
                    badgeText = "PAID";
                    badgeBg = "#10b981";
                  } else if (formData.payment_mode && formData.payment_mode.includes("INSTALLMENT")) {
                    badgeText = "INSTALLMENT";
                    badgeBg = "#8b5cf6";
                  } else {
                    badgeText = "DUE";
                    badgeBg = "#ef4444";
                  }
                } else {
                  if (inv.payment_status === "PAID") {
                    badgeText = "PAID";
                    badgeBg = "#10b981";
                  } else if (inv.payment_status === "PARTIAL") {
                    badgeText = "PARTIAL";
                    badgeBg = "#f59e0b";
                  } else if (inv.payment_status === "INSTALLMENT" || (inv.payment_mode && inv.payment_mode.includes("INSTALLMENT"))) {
                    badgeText = "INSTALLMENT";
                    badgeBg = "#8b5cf6";
                  } else {
                    badgeText = "DUE";
                    badgeBg = "#ef4444";
                  }
                }

                return (
                  <div
                    key={inv.id}
                    className="history-item"
                    onClick={() => loadInvoiceData(inv)} 
                  >
                    <div className="history-item-content">
                        <div className="history-item-header">
                          <strong
                            style={{
                              color:
                                inv.doc_type === "QUOTATION" ? "#fbbf24" : "#38bdf8",
                            }}
                          >
                            {inv.invoice_number}
                          </strong>
                          <span
                            className="status-badge"
                            style={{ background: badgeBg }}
                          >
                            {badgeText}
                          </span> 
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            marginBottom: "6px",
                            fontWeight: "500",
                          }}
                        >
                          {inv.client_name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            color: "#94a3b8",
                          }}
                        >
                          <span>Total: ₹{inv.total_amount}</span>
                        </div>
                    </div>
                    
                    <button 
                      className="history-delete-btn"
                      title={`Delete ${inv.invoice_number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInvoice(inv.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
              {filteredInvoices.length === 0 && (
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  No documents found.
                </p>
              )}
            </div>
          </div>

          {/* ================= RIGHT PANEL (PDF PREVIEW) ================= */}
          <div className="invoice-wrapper">
            <div
              style={{
                width: "100%",
                maxWidth: "800px",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                boxSizing: "border-box",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "white", fontSize: "1.1rem" }}>
                  {formData.doc_type} #{formData.invoice_number}
                </h3>
                <p style={{ margin: 0, color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
                  ⚡ Live Preview
                </p>
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.15)", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  <input
                    type="checkbox"
                    id="markAsPaidCheckbox"
                    checked={isPaidMarked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        setPreMarkAdvance(Number(formData.advance_paid) || 0);
                      } else {
                        const newAdvance = formData.payment_mode === "FULL" ? 0 : preMarkAdvance;
                        setFormData((prev) => ({ ...prev, advance_paid: newAdvance }));
                      }
                      setIsPaidMarked(checked);
                    }}
                    style={{ width: "16px", height: "16px", accentColor: "#10b981", cursor: "pointer" }}
                  />
                  <label htmlFor="markAsPaidCheckbox" style={{ color: "#34d399", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
                    Paid
                  </label>
                </div>

                <select
                  className="input"
                  style={{
                    width: "auto",
                    background: "rgba(15, 23, 42, 0.9)",
                    color: "#38bdf8",
                    fontWeight: "700",
                    padding: "10px 14px",
                  }}
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                >
                  <option value="a4">A4 Format</option>
                  <option value="a5">A5 Format</option>
                </select>

                <LoadingButton
                  className="btn"
                  style={{
                    width: "auto",
                    padding: "10px 20px",
                    fontSize: "14px",
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#34d399",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                  onClick={async () => {
                    if (!formData.client_name || !formData.client_name.trim()) {
                      alert("Please enter a Client Name before saving.");
                      return;
                    }
                    try {
                      const updatedInvoices = await handleSaveInvoiceData();
                      
                      if (selectedInvoice && selectedInvoice.id) {
                         const newlySaved = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
                         if (newlySaved) {
                             loadInvoiceData(newlySaved);
                         }
                      } else {
                         clearDraftAndResetForm(updatedInvoices);
                      }
                      
                      alert("Invoice Saved Successfully!");
                    } catch(e) {
                      // Handled by handleSaveInvoiceData
                    }
                  }}
                >
                  💾 Save Invoice
                </LoadingButton>

                <LoadingButton
                  className="btn btn-primary"
                  style={{
                    width: "auto",
                    padding: "10px 20px",
                    fontSize: "14px",
                  }}
                  onClick={downloadPDF}
                >
                  📄 Download PDF
                </LoadingButton>
              </div>
            </div>

            <div
              ref={invoiceRef}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {invoicePages.map((pageRows, pageIndex) => {
                const isLastPage = pageIndex === invoicePages.length - 1;
                return (
                  <div
                    key={pageIndex}
                    className={`ti-paper invoice-page ${
                      paperSize === "a5" ? "ti-a5-preview" : ""
                    }`}
                  >
                    <h1 className="ti-title">
                      {formData.doc_type === "QUOTATION"
                        ? "QUOTATION"
                        : "TAX INVOICE"}
                    </h1>

                    {/* COMPANY DETAILS + LOGO & INVOICE META */}
                    <div className="ti-box ti-top">
                      <div className="ti-top-left">
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
                          {formData.company_logo && formData.show_company_logo && (
                            <img src={formData.company_logo} alt="Company Logo" style={{ maxHeight: "40px", objectFit: "contain" }} />
                          )}
                          <p className="ti-company-name" style={{ margin: 0 }}>
                            {formData.company_name}
                          </p>
                        </div>
                        <p>{formData.company_address}</p>
                        <p>{formData.company_showroom} </p>
                        <p>
                          <strong>GSTIN/UIN :</strong> {formData.company_gstin}
                        </p>
                        <p>
                          <strong>State Name :</strong> {formData.company_state}
                          ,<strong> Code :</strong>{" "}
                          {formData.company_state_code}
                        </p>
                        <p>
                          <strong>Contact :</strong> {formData.company_phones}
                        </p>
                        <p>
                          <strong>E-Mail :</strong> {formData.company_email}
                        </p>

                        <hr
                          style={{
                            margin: "8px -10px",
                            border: "0",
                            borderTop: "1px solid #000",
                          }}
                        />

                        <p
                          style={{
                            fontWeight: "bold",
                            fontSize: "12px",
                            marginBottom: "4px",
                          }}
                        >
                          Buyer (Bill to)
                        </p>
                        <p className="ti-buyer-name">
                          {formData.client_name}
                          {formData.client_mobile
                            ? `, ${formData.client_mobile}`
                            : ""}
                        </p>
                        <p style={{ whiteSpace: "pre-line" }}>
                          {formData.client_address}
                        </p>
                        {formData.client_gstin && (
                          <p>
                            <strong>GSTIN/UIN :</strong> {formData.client_gstin}
                          </p>
                        )}
                        <p>
                          <strong>State Name :</strong> {formData.client_state},
                          <strong> Code :</strong> {formData.client_state_code}
                        </p>
                        <p>
                          <strong>Place of Supply :</strong>{" "}
                          {formData.place_of_supply}
                        </p>
                      </div>
                      <table className="ti-meta-table">
                        <tbody>
                          <tr>
                            <td>
                              <strong>Invoice No.</strong>
                              <br />
                              {formData.invoice_number}
                            </td>
                            <td>
                              <strong>Dated</strong>
                              <br />
                              {formatDate(formData.invoice_date)}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong>Delivery Note</strong>
                              <br />
                              {formData.delivery_note || ""}
                            </td>
                            <td>
                              <strong>Mode/Terms of Payment</strong>
                              <br />
                              {isPaidMarked 
                                ? "PAID" 
                                : (formData.payment_mode && formData.payment_mode.includes("INSTALLMENT") ? "INSTALLMENT" : "DUE")}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong>Reference No. & Date</strong>
                              <br />
                              {formData.reference_no_date || ""}
                            </td>
                            <td>
                              <strong>Other References</strong>
                              <br />
                              {formData.other_references || ""}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong>Buyer's Order No.</strong>
                              <br />
                              {formData.buyers_order_no || ""}
                            </td>
                            <td>
                              <strong>Dated</strong>
                              <br />
                              {formData.order_dated
                                ? formatDate(formData.order_dated)
                                : ""}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong>Dispatch Doc No.</strong>
                              <br />
                              {formData.dispatch_doc_no || ""}
                            </td>
                            <td>
                              <strong>Delivery Note Date</strong>
                              <br />
                              {formData.delivery_note_date
                                ? formatDate(formData.delivery_note_date)
                                : ""}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong>Dispatched Through</strong>
                              <br />
                              {formData.dispatched_through || ""}
                            </td>
                            <td>
                              <strong>Destination</strong>
                              <br />
                              {formData.destination || ""}
                            </td>
                          </tr>
                          <tr>
                            <td
                              colSpan={2}
                              className="terms-cell"
                              style={{ borderRight: "none" }}
                            >
                              <strong>Terms of Delivery</strong>
                              <div
                                style={{ marginTop: "8px", minHeight: "50px" }}
                              >
                                {formData.terms_of_delivery || ""}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="ti-table-wrapper">
                      <table
                        className="ti-items"
                        style={{
                          borderBottom: !isLastPage ? "1px solid #000" : "none",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Sl No.</th>
                            <th>Description of Goods</th>
                            <th>HSN/SAC</th>
                            <th>Quantity</th>
                            <th>
                              Rate
                              <br />
                              (incl. of Tax)
                            </th>
                            <th>Rate</th>
                            <th>per</th>
                            <th>Disc. %</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((row, idx) => {
                            if (row.type === "empty") {
                              return (
                                <tr
                                  key={`empty-${pageIndex}-${idx}`}
                                  style={{
                                    height: paperSize === "a5" ? "24px" : "40px", 
                                  }}
                                >
                                  <td className="text-center"></td>
                                  <td></td>
                                  <td className="text-center"></td>
                                  <td className="text-center"></td>
                                  <td className="text-right"></td>
                                  <td className="text-right"></td>
                                  <td className="text-center"></td>
                                  <td className="text-center"></td>
                                  <td className="text-right"></td>
                                </tr>
                              );
                            }

                            const { item, index } = row;

                            const qty = getEffectiveQty(item);

                            const baseRate = Number(item.price) || 0;
                            const discPct = Number(item.discount_percent) || 0;
                            const baseItemTotal = baseRate * qty;
                            const discAmt = baseItemTotal * (discPct / 100);
                            const itemTotal = baseItemTotal - discAmt;

                            const discountedRate = baseRate * (1 - discPct / 100);
                            const gstRateNum = formData.is_gst_enabled
                              ? Number(item.gst_rate) || 0
                              : 0;
                            const rateInclTax = discountedRate * (1 + gstRateNum / 100);

                            const serialNumbersText = item.subItems
                              ? item.subItems
                                  .map((sub) => sub.sn_code)
                                  .filter(Boolean)
                                  .join(", ")
                              : "";

                            return (
                              <tr key={`main-${index}-${idx}`}>
                                <td className="text-center">{index + 1}</td>
                                <td>
                                  <strong>
                                    {item.description || "General Item"}
                                  </strong>
                                  {serialNumbersText && (
                                    <div
                                      style={{
                                        fontSize: "9.5px",
                                        color: "#475569",
                                        marginTop: "2px",
                                      }}
                                    >
                                      S/N: {serialNumbersText}
                                    </div>
                                  )}
                                </td>
                                <td className="text-center">
                                  {item.hsn_code || "-"}
                                </td>
                                <td className="text-center">
                                  <strong>{qty} PCS</strong>
                                </td>
                                <td className="text-right">
                                  {formData.is_gst_enabled ? rateInclTax.toFixed(2) : ""}
                                </td>
                                <td className="text-right">
                                  {baseRate.toFixed(2)}
                                </td>
                                <td className="text-center">PCS</td>
                                <td className="text-center">
                                  {discPct > 0 ? `${discPct}%` : "-"}
                                </td>
                                <td className="text-right">
                                  <strong>{itemTotal.toFixed(2)}</strong>
                                </td>
                              </tr>
                            );
                          })}

                          {isLastPage &&
                            formData.is_gst_enabled &&
                            subtotal > 0 &&
                            (() => {
                              const halfTax = tax / 2;
                              return (
                                <>
                                  <tr className="ti-tax-row">
                                    <td></td>
                                    <td
                                      style={{
                                        textAlign: "right",
                                        paddingRight: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      OUTPUT CGST
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-right">
                                      {halfTax.toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr className="ti-tax-row">
                                    <td></td>
                                    <td
                                      style={{
                                        textAlign: "right",
                                        paddingRight: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      OUTPUT SGST
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-right">
                                      {halfTax.toFixed(2)}
                                    </td>
                                  </tr>
                                </>
                              );
                            })()}

                          {isLastPage && Number(formData.installation_charges) > 0 && (
                            <tr className="ti-tax-row">
                              <td></td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingRight: "8px",
                                  fontStyle: "italic",
                                  fontWeight: "bold"
                                }}
                              >
                                INSTALLATION CHARGES
                              </td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td className="text-right">
                                {Number(formData.installation_charges).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {isLastPage && (
                          <tfoot>
                            <tr className="ti-total-row">
                              <td></td>
                              <td className="text-right">
                                <strong>Total</strong>
                              </td>
                              <td></td>
                              <td className="text-center">
                                <strong>
                                  {items.reduce((acc, it) => acc + getEffectiveQty(it), 0)} PCS
                                </strong>
                              </td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td className="text-right">
                                <strong>₹ {grandTotal.toFixed(2)}</strong>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* ANCHORED FOOTER BLOCK WITH DIGITAL SIGNATURE */}
                    <div className="ti-footer-block">
                      {isLastPage && (
                        <div
                          className="avoid-break"
                          style={{ marginTop: "-1px" }}
                        >
                          <div className="ti-box ti-words">
                            <strong>Amount Chargeable (in words):</strong> INR{" "}
                            {numberToWords(grandTotal)} Only
                          </div>
                        </div>
                      )}

                      {isLastPage && (
                        <div
                          className="avoid-break"
                          style={{ marginTop: "-1px" }}
                        >
                          <div className="ti-box ti-bottom">
                            <div className="ti-bottom-left">
                              <p style={{ marginBottom: "8px" }}>
                                <strong>Company's PAN :</strong>{" "}
                                {formData.company_pan}
                              </p>
                              <p className="ti-decl-title">Declaration:</p>
                              <p className="ti-decl-text">
                                (1) Warranty will be void physically damaged,
                                breakage, electrical overload, mishandle faulty
                                installation, burnt out warranty seal &amp;
                                serial no, tampered goods. (2) After 24 hours of
                                sale replacement of the product sold under
                                warranty will be done only after getting the
                                replacement from our principals or by their
                                Authorized service centers. (3) The product in
                                this invoice is covered by the Manufacturer
                                STANDARD warranty; we have no legal/financial
                                liability for the same. (4) Any discrepancy
                                found in the invoice relating to quantity rate
                                etc. should be informed immediately. No claim
                                shall be entertained thereafter. (5) Goods once
                                sold can't be taken back or exchange.
                              </p>
                            </div>
                            <div className="ti-bottom-right">
                              <p className="ti-bank-title">Bank Details</p>
                              <p>
                                <strong>Bank Name:</strong> {formData.bank_name}
                              </p>
                              <p>
                                <strong>A/c No.:</strong> {formData.account_no}
                              </p>
                              <p>
                                <strong>Branch &amp; IFSC Code:</strong>{" "}
                                {formData.branch_ifsc}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-end",
                                  marginTop: "auto",
                                  minHeight: "90px",
                                }}
                              >
                                {formData.qr_code_image && formData.show_qr_code ? (
                                  <img
                                    src={formData.qr_code_image}
                                    style={{
                                      width: "90px",
                                      height: "90px",
                                      objectFit: "contain",
                                    }}
                                    alt="QR Code"
                                  />
                                ) : (
                                  <div
                                    style={{ width: "90px", height: "90px" }}
                                 ></div>
                                )}
                                <div style={{ textAlign: "right" }}>
                                  {formData.digital_signature && formData.show_digital_signature ? (
                                    <img
                                      src={formData.digital_signature}
                                      alt="Digital Signature"
                                      style={{ height: "40px", maxWidth: "120px", objectFit: "contain", display: "block", marginLeft: "auto", marginBottom: "4px" }}
                                    />
                                  ) : (
                                    <div className="ti-sig-space" style={{ height: "34px" }}></div>
                                  )}
                                  <p
                                    className="ti-sig-label"
                                    style={{ margin: 0 }}
                                  >
                                    Authorized Signatory
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        className="ti-footer-page"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>This is a computer generated invoice.</span>
                        <strong>
                          Page {pageIndex + 1} of {invoicePages.length}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}