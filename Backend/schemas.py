from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from models import PaymentModeEnum, DocTypeEnum

class ActivationRequest(BaseModel):
    key: str

class InventoryItem(BaseModel):
    product_name: str
    hsn_code: Optional[str] = None
    unit: str = "Pcs"
    selling_price: float
    stock_quantity: float
    gst_rate: float
    purchase_price: Optional[float] = 0.0

# --- NEW ERP MODULE SCHEMAS ---

class PurchaseInvoiceCreate(BaseModel):
    vendor_name: str
    bill_number: Optional[str] = None
    bill_date: Optional[str] = None
    total_amount: float
    status: str = "UNPAID"

class FollowUpCreate(BaseModel):
    client_name: str
    contact: str
    reason: str
    scheduled_date: str
    priority: str = "Medium"

class AmcContractCreate(BaseModel):
    client_name: str
    product_details: str
    install_date: str
    expiry_date: str
    status: str

class MessageLogCreate(BaseModel):
    sent_at: str
    client_name: str
    phone_number: str
    status: str

# --- EXISTING SCHEMAS ---

class Item(BaseModel):
    product_id: Optional[int] = None 
    description: str
    hsn_code: Optional[str] = ""
    quantity: float
    price: float
    sn_code: Optional[str] = ""
    gst_rate: float = 18.0

class InvoiceCreate(BaseModel):
    doc_type: DocTypeEnum = DocTypeEnum.INVOICE
    
    # --- COMPANY HEADER DETAILS ---
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_showroom: Optional[str] = None
    company_gstin: Optional[str] = None
    company_state: Optional[str] = None
    company_state_code: Optional[str] = None
    company_phones: Optional[str] = None
    company_email: Optional[str] = None
    company_pan: Optional[str] = None
    company_logo: Optional[str] = None       
    digital_signature: Optional[str] = None

    # --- BUYER (BILL TO) DETAILS ---
    client_name: Optional[str] = "Walk-in Customer"
    client_mobile: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    client_state: Optional[str] = None
    client_state_code: Optional[str] = "19"  
    firm_state_code: Optional[str] = "19" 
    place_of_supply: Optional[str] = None

    # --- REFERENCE & METADATA ---
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None 
    delivery_note: Optional[str] = None
    reference_no_date: Optional[str] = None
    other_references: Optional[str] = None
    buyers_order_no: Optional[str] = None
    order_dated: Optional[str] = None
    dispatch_doc_no: Optional[str] = None
    delivery_note_date: Optional[str] = None
    dispatched_through: Optional[str] = None
    destination: Optional[str] = None
    terms_of_delivery: Optional[str] = None

    # --- BANK DETAILS ---
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    branch_ifsc: Optional[str] = None
    qr_code_image: Optional[str] = None
    
    # --- ITEMS & FINANCIALS ---
    items: List[Item]
    payment_mode: Optional[PaymentModeEnum] = PaymentModeEnum.FULL
    installation_charges: Optional[float] = 0.0
    advance_paid: Optional[float] = 0.0
    
    due_date: Optional[date] = None
    emi_start_date: Optional[date] = None
    
    is_gst_enabled: bool = True
    
    
    payment_status: Optional[str] = None