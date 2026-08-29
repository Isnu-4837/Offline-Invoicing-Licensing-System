import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from db import Base

class DocTypeEnum(str, enum.Enum):
    INVOICE = "INVOICE"
    QUOTATION = "QUOTATION"

class PaymentStatusEnum(str, enum.Enum):
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    DUE = "DUE"
    INSTALLMENT = "INSTALLMENT"

class PaymentModeEnum(str, enum.Enum):
    FULL = "FULL"
    INSTALLMENT = "INSTALLMENT"
    INSTALLMENT_3 = "INSTALLMENT_3" 
    INSTALLMENT_4 = "INSTALLMENT_4" 

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, nullable=False)
    hsn_code = Column(String)
    unit = Column(String, default="Pcs")
    selling_price = Column(Float, default=0.0)
    stock_quantity = Column(Float, default=0.0)
    gst_rate = Column(Float, default=18.0) 
    purchase_price = Column(Float, default=0.0)

# --- NEW ERP MODULE MODELS ---

class PurchaseInvoiceModel(Base):
    __tablename__ = "purchase_invoices"
    id = Column(Integer, primary_key=True, index=True)
    vendor_name = Column(String, index=True)
    bill_number = Column(String)
    bill_date = Column(String)
    total_amount = Column(Float)
    status = Column(String)

class VendorLedgerModel(Base):
    __tablename__ = "vendor_ledger"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    total_billed = Column(Float, default=0.0)
    paid = Column(Float, default=0.0)
    pending = Column(Float, default=0.0)
    last_payment = Column(String, nullable=True)

class AmcContractModel(Base):
    __tablename__ = "amc_contracts"
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True)
    contact_number = Column(String, nullable=True)
    product_details = Column(String)
    install_date = Column(String)
    expiry_date = Column(String)
    status = Column(String)

class FollowUpModel(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String)
    contact = Column(String)
    reason = Column(String)
    scheduled_date = Column(String)
    priority = Column(String)
    is_done = Column(Integer, default=0)

class StockAuditModel(Base):
    __tablename__ = "stock_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String)
    product_name = Column(String)
    action_type = Column(String)
    quantity_change = Column(Integer)
    closing_balance = Column(Integer)
    reference = Column(String)

class MessageLogModel(Base):
    __tablename__ = "message_logs"
    id = Column(Integer, primary_key=True, index=True)
    sent_at = Column(String)
    client_name = Column(String)
    phone_number = Column(String)
    status = Column(String)

class Activation(Base):
    __tablename__ = "activations"
    id = Column(Integer, primary_key=True, index=True)
    key_string = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    activated_at = Column(DateTime(timezone=True), server_default=func.now())

# --- EXISTING INVOICE MODEL ---

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, nullable=True)
    
    doc_type = Column(String, default="INVOICE")
    
    qr_code_image = Column(String, nullable=True)
    company_logo = Column(String, nullable=True)        
    digital_signature = Column(String, nullable=True)
    
    company_name = Column(String, nullable=True)
    company_address = Column(String, nullable=True)
    company_showroom = Column(String, nullable=True)
    company_gstin = Column(String, nullable=True)
    company_state = Column(String, nullable=True)
    company_state_code = Column(String, nullable=True)
    company_phones = Column(String, nullable=True)
    company_email = Column(String, nullable=True)
    company_pan = Column(String, nullable=True)

    client_name = Column(String, nullable=False, default="Walk-in Customer")
    client_mobile = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    client_address = Column(String, nullable=True)
    client_gstin = Column(String, nullable=True)
    client_state = Column(String, nullable=True)
    client_state_code = Column(String, nullable=True)
    place_of_supply = Column(String, nullable=True)
    firm_state_code = Column(String, nullable=True)

    delivery_note = Column(String, nullable=True)
    reference_no_date = Column(String, nullable=True)
    other_references = Column(String, nullable=True)
    buyers_order_no = Column(String, nullable=True)
    dispatch_doc_no = Column(String, nullable=True)
    dispatched_through = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    terms_of_delivery = Column(String, nullable=True)

    bank_name = Column(String, nullable=True)
    account_no = Column(String, nullable=True)
    branch_ifsc = Column(String, nullable=True)

    items = Column(JSON, nullable=False) 
    total_amount = Column(Float, nullable=True)
    advance_paid = Column(Float, default=0, nullable=True)
    installation_charges = Column(Float, default=0, nullable=True)
    remaining_amount = Column(Float, nullable=True)
    
    is_gst_enabled = Column(Boolean, default=True)
    cgst_total = Column(Float, default=0, nullable=True)
    sgst_total = Column(Float, default=0, nullable=True)
    igst_total = Column(Float, default=0, nullable=True)

    payment_mode = Column(String, nullable=True)
    installment_schedule = Column(JSON, nullable=True)
    payment_status = Column(String, default="DUE", nullable=True)
    
    # FIXED: Replaced Date with String to completely bypass SQLAlchemy date-parsing crashes
    order_dated = Column(String, nullable=True)
    delivery_note_date = Column(String, nullable=True)
    due_date = Column(String, nullable=True) 
    emi_start_date = Column(String, nullable=True)
    next_due_date = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    is_activated = Column(Boolean, default=False)
    license_key = Column(String, nullable=True)
    machine_id = Column(String, nullable=True)