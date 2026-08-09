from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import models
from sqlalchemy.orm.attributes import flag_modified

def generate_invoice_number(db: Session, doc_type):
    prefix = "INV" if doc_type == models.DocTypeEnum.INVOICE else "QUO"
    while True:
        candidate = f"{prefix}-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        exists = db.query(models.Invoice).filter(models.Invoice.invoice_number == candidate).first()
        if not exists:
            return candidate

def parse_date_safe(date_val):
    if not date_val:
        return None
    if isinstance(date_val, str) and date_val.strip():
        try:
            return datetime.strptime(date_val.strip(), "%Y-%m-%d").date()
        except ValueError:
            return None
    return date_val if hasattr(date_val, 'year') else None

def create_invoice(db: Session, data):
    client_name = getattr(data, 'client_name', None)
    if not client_name or not client_name.strip():
        client_name = "Walk-in Customer"

    items_list = [i.dict() if hasattr(i, 'dict') else i for i in data.items]

    total_taxable = round(sum(i.quantity * i.price for i in data.items), 2)
    cgst, sgst, igst = 0.0, 0.0, 0.0
    
    if data.is_gst_enabled:
        for item in data.items:
            item_tax = round((item.quantity * item.price) * (item.gst_rate / 100), 2)
            if data.client_state_code == data.firm_state_code:
                cgst += round(item_tax / 2, 2)
                sgst += round(item_tax / 2, 2)
            else:
                igst += item_tax

    installation_charges = float(getattr(data, 'installation_charges', 0.0) or 0.0)
    advance_paid = float(getattr(data, 'advance_paid', 0.0) or 0.0)
    
    grand_total = round(total_taxable + cgst + sgst + igst + installation_charges, 2)
    remaining_balance = round(grand_total - advance_paid, 2)

    installment_schedule = []
    next_due_date = None

    if data.payment_mode == models.PaymentModeEnum.FULL or not data.payment_mode:
        next_due_date = parse_date_safe(getattr(data, 'due_date', None))
    else:
        parts = 3 if data.payment_mode == models.PaymentModeEnum.INSTALLMENT else 4
        base_date = parse_date_safe(data.emi_start_date) or datetime.now().date()
        part_amount = round(remaining_balance / parts, 2)

        for i in range(parts):
            if i == parts - 1:
                amount = round(remaining_balance - (part_amount * (parts - 1)), 2)
            else:
                amount = part_amount

            due = base_date + timedelta(days=30 * (i + 1))
            installment_schedule.append({
                "installment_no": i + 1,
                "amount": amount,
                "due_date": str(due),
                "status": "DUE"
            })
        
        next_due_date = base_date + timedelta(days=30)

    incoming_inv_num = getattr(data, 'invoice_number', None)
    existing_inv = None
    if incoming_inv_num and incoming_inv_num.strip():
        existing_inv = db.query(models.Invoice).filter(models.Invoice.invoice_number == incoming_inv_num.strip()).first()

    order_date_val = parse_date_safe(getattr(data, 'order_dated', None))
    delivery_note_date_val = parse_date_safe(getattr(data, 'delivery_note_date', None))

    # --- UPDATE EXISTING INVOICE ---
    if existing_inv:
        existing_inv.doc_type = data.doc_type
        existing_inv.company_name = data.company_name
        existing_inv.company_address = data.company_address
        existing_inv.company_showroom = data.company_showroom
        existing_inv.company_gstin = data.company_gstin
        existing_inv.company_state = data.company_state
        existing_inv.company_state_code = data.company_state_code
        existing_inv.company_phones = data.company_phones
        existing_inv.company_email = data.company_email
        existing_inv.company_pan = data.company_pan
        existing_inv.company_logo = data.company_logo             
        existing_inv.digital_signature = data.digital_signature

        existing_inv.client_name = client_name
        existing_inv.client_mobile = data.client_mobile
        existing_inv.client_email = data.client_email
        existing_inv.client_address = data.client_address
        existing_inv.client_gstin = data.client_gstin
        existing_inv.client_state = data.client_state
        existing_inv.client_state_code = data.client_state_code
        existing_inv.firm_state_code = data.firm_state_code
        existing_inv.place_of_supply = data.place_of_supply

        existing_inv.delivery_note = data.delivery_note
        existing_inv.reference_no_date = data.reference_no_date
        existing_inv.other_references = data.other_references
        existing_inv.buyers_order_no = data.buyers_order_no
        existing_inv.order_dated = order_date_val
        existing_inv.dispatch_doc_no = data.dispatch_doc_no
        existing_inv.delivery_note_date = delivery_note_date_val
        existing_inv.dispatched_through = data.dispatched_through
        existing_inv.destination = data.destination
        existing_inv.terms_of_delivery = data.terms_of_delivery

        existing_inv.bank_name = data.bank_name
        existing_inv.account_no = data.account_no
        existing_inv.branch_ifsc = data.branch_ifsc
        existing_inv.qr_code_image = data.qr_code_image

        existing_inv.items = items_list
        flag_modified(existing_inv, "items")

        existing_inv.total_amount = grand_total
        existing_inv.advance_paid = advance_paid
        existing_inv.installation_charges = installation_charges
        existing_inv.remaining_amount = remaining_balance
        existing_inv.cgst_total = cgst
        existing_inv.sgst_total = sgst
        existing_inv.igst_total = igst
        existing_inv.payment_mode = data.payment_mode
        existing_inv.is_gst_enabled = data.is_gst_enabled
        existing_inv.installment_schedule = installment_schedule if installment_schedule else None
        existing_inv.payment_status = models.PaymentStatusEnum.PAID if remaining_balance <= 0 else models.PaymentStatusEnum.DUE
        existing_inv.next_due_date = next_due_date
        existing_inv.due_date = parse_date_safe(getattr(data, 'due_date', None))
        existing_inv.emi_start_date = parse_date_safe(getattr(data, 'emi_start_date', None))

        db.commit()
        db.refresh(existing_inv)
        return existing_inv

    # --- CREATE NEW INVOICE ---
    else:
        invoice_number = incoming_inv_num.strip() if incoming_inv_num and incoming_inv_num.strip() else generate_invoice_number(db, data.doc_type)

        invoice = models.Invoice(
            invoice_number=invoice_number,
            doc_type=data.doc_type,
            company_name=data.company_name, company_address=data.company_address, company_showroom=data.company_showroom,
            company_gstin=data.company_gstin, company_state=data.company_state, company_state_code=data.company_state_code,
            company_phones=data.company_phones, company_email=data.company_email, company_pan=data.company_pan,company_logo=data.company_logo,                      
            digital_signature=data.digital_signature, client_name=client_name, client_mobile=data.client_mobile, client_email=data.client_email,
            client_address=data.client_address, client_gstin=data.client_gstin, client_state=data.client_state,
            client_state_code=data.client_state_code, firm_state_code=data.firm_state_code, place_of_supply=data.place_of_supply,
            delivery_note=data.delivery_note, reference_no_date=data.reference_no_date, other_references=data.other_references,
            buyers_order_no=data.buyers_order_no, order_dated=order_date_val, dispatch_doc_no=data.dispatch_doc_no,
            delivery_note_date=delivery_note_date_val, dispatched_through=data.dispatched_through, destination=data.destination,
            terms_of_delivery=data.terms_of_delivery, bank_name=data.bank_name, account_no=data.account_no,
            branch_ifsc=data.branch_ifsc, qr_code_image=data.qr_code_image, items=items_list,
            total_amount=grand_total, advance_paid=advance_paid, installation_charges=installation_charges,
            remaining_amount=remaining_balance, cgst_total=cgst, sgst_total=sgst, igst_total=igst,
            payment_mode=data.payment_mode, is_gst_enabled=data.is_gst_enabled,
            installment_schedule=installment_schedule if installment_schedule else None,
            payment_status=models.PaymentStatusEnum.PAID if remaining_balance <= 0 else models.PaymentStatusEnum.DUE,
            next_due_date=next_due_date, due_date=parse_date_safe(getattr(data, 'due_date', None)), emi_start_date=parse_date_safe(getattr(data, 'emi_start_date', None))
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice


# --- NEW ERP MODULE HELPERS ---

def create_purchase_invoice(db: Session, data):
    db_item = models.PurchaseInvoiceModel(**data.dict())
    db.add(db_item)
    
    # Auto-update Vendor Ledger
    vendor = db.query(models.VendorLedgerModel).filter(models.VendorLedgerModel.name == data.vendor_name).first()
    if not vendor:
        vendor = models.VendorLedgerModel(name=data.vendor_name, total_billed=data.total_amount, pending=data.total_amount)
        db.add(vendor)
    else:
        vendor.total_billed += data.total_amount
        vendor.pending += data.total_amount
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_purchase_invoice(db: Session, purchase_id: int):
    db_item = db.query(models.PurchaseInvoiceModel).filter(models.PurchaseInvoiceModel.id == purchase_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
        return True
    return False

def get_purchase_invoices(db: Session):
    return db.query(models.PurchaseInvoiceModel).order_by(models.PurchaseInvoiceModel.id.desc()).all()

def get_vendor_ledger(db: Session):
    return db.query(models.VendorLedgerModel).order_by(models.VendorLedgerModel.name.asc()).all()

def update_vendor_payment(db: Session, vendor_id: int):
    vendor = db.query(models.VendorLedgerModel).filter(models.VendorLedgerModel.id == vendor_id).first()
    if vendor:
        vendor.paid = vendor.total_billed
        vendor.pending = 0
        vendor.last_payment = datetime.now().date().isoformat()
        db.commit()
        db.refresh(vendor)
    return vendor

def create_follow_up(db: Session, data):
    db_item = models.FollowUpModel(**data.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_active_follow_ups(db: Session):
    return db.query(models.FollowUpModel).filter(models.FollowUpModel.is_done == 0).all()

def mark_follow_up_done(db: Session, followup_id: int):
    fup = db.query(models.FollowUpModel).filter(models.FollowUpModel.id == followup_id).first()
    if fup:
        fup.is_done = 1
        db.commit()
        db.refresh(fup)
    return fup

def get_stock_history(db: Session):
    return db.query(models.StockAuditModel).order_by(models.StockAuditModel.id.desc()).all()

def log_stock_change(db: Session, product_name: str, action: str, qty_change: int, balance: int, ref: str):
    log = models.StockAuditModel(
        date=datetime.now().date().isoformat(),
        product_name=product_name,
        action_type=action,
        quantity_change=qty_change,
        closing_balance=balance,
        reference=ref
    )
    db.add(log)
    db.commit()

# --- INVENTORY HELPERS ---
def get_inventory(db: Session): return db.query(models.Inventory).all()

def add_inventory_item(db: Session, item_data):
    db_item = models.Inventory(**item_data.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_stock(db: Session, product_id: int, new_quantity: float):
    product = db.query(models.Inventory).filter(models.Inventory.id == product_id).first()
    if product:
        qty_diff = new_quantity - product.stock_quantity
        product.stock_quantity = new_quantity
        db.commit()
        # Log the change
        log_stock_change(db, product.product_name, "ADJUST", int(qty_diff), int(new_quantity), "Manual Adjustment")
    return product

# --- READ / PAYMENT HELPERS ---
def get_all_invoices(db: Session): return db.query(models.Invoice).order_by(models.Invoice.id.desc()).all()
def get_invoice_by_id(db: Session, invoice_id: int): return db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
def process_payment(db: Session, invoice_id: int, installment_no: int):
    invoice = get_invoice_by_id(db, invoice_id)
    if not invoice: return None
    if installment_no == 0:
        invoice.advance_paid += invoice.remaining_amount
        invoice.remaining_amount = 0
        invoice.payment_status = models.PaymentStatusEnum.PAID
        invoice.next_due_date = None
    else:
        if invoice.installment_schedule:
            schedule = list(invoice.installment_schedule)
            paid_amount = 0
            next_due_string = None
            all_paid = True
            for inst in schedule:
                if inst["installment_no"] == installment_no:
                    inst["status"] = "PAID"
                    paid_amount = inst["amount"]
                if inst["status"] == "DUE":
                    all_paid = False
                    if not next_due_string: next_due_string = inst["due_date"]
            invoice.installment_schedule = schedule
            flag_modified(invoice, "installment_schedule")
            invoice.advance_paid += paid_amount
            invoice.remaining_amount -= paid_amount
            if all_paid or invoice.remaining_amount <= 0:
                invoice.payment_status = models.PaymentStatusEnum.PAID
                invoice.next_due_date = None
            else:
                invoice.payment_status = models.PaymentStatusEnum.PARTIAL
                if next_due_string: invoice.next_due_date = datetime.strptime(next_due_string, "%Y-%m-%d").date()
    db.commit()
    db.refresh(invoice)
    return invoice

# --- AMC TRACKING ---
def get_amc_contracts(db: Session):
    return db.query(models.AmcContractModel).all()

def create_amc_contract(db: Session, data):
    db_item = models.AmcContractModel(**data.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- STOCK HISTORY ---
def get_stock_history(db: Session):
    return db.query(models.StockAuditModel).order_by(models.StockAuditModel.id.desc()).all()

def check_application_status(db: Session):
    """Checks if a valid activation key exists in the database."""
    active_license = db.query(models.Activation).filter(models.Activation.is_active == True).first()
    return {"is_activated": bool(active_license)}

def activate_application(db: Session, key: str):
    """Validates and stores the 14-character key."""
    cleaned_key = key.replace("-", "").strip().upper()
    if len(cleaned_key) != 14:
        return {"success": False, "message": "Invalid key length. Must be 14 alphanumeric characters."}
    
    # Check if already used
    existing = db.query(models.Activation).filter(models.Activation.key_string == cleaned_key).first()
    if existing:
        return {"success": False, "message": "This key has already been activated."}
    
    # Save new activation
    new_activation = models.Activation(key_string=cleaned_key, is_active=True)
    db.add(new_activation)
    db.commit()
    return {"success": True, "message": "Application activated successfully!"}