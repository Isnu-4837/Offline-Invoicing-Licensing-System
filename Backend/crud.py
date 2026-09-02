import json
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime, timedelta
import uuid
import models
import re
from sqlalchemy.orm.attributes import flag_modified

def get_sales_report_data(db: Session, timeframe: str, year: int, month: int = None):
    query = db.query(models.Invoice).filter(
        models.Invoice.doc_type == "INVOICE",
        extract('year', models.Invoice.created_at) == year
    )
    if timeframe == "monthly" and month:
        query = query.filter(extract('month', models.Invoice.created_at) == month)
    return query.order_by(models.Invoice.created_at.desc()).all()

def get_machine_id() -> str:
    return str(uuid.getnode())

def verify_key_signature(key_str: str) -> bool:
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    clean_key = key_str.replace("-", "").strip().upper()
    if len(clean_key) != 14:
        return False
    base_str = clean_key[:12]
    provided_signature = clean_key[12:]
    total = sum(ord(c) for c in base_str)
    expected_char1 = chars[total % len(chars)]
    expected_char2 = chars[(total * 7) % len(chars)]
    expected_signature = expected_char1 + expected_char2
    return provided_signature == expected_signature

def check_application_status(db: Session):
    config = db.query(models.SystemConfig).first()
    current_machine_id = get_machine_id()
    if not config:
        config = models.SystemConfig(is_activated=False)
        db.add(config)
        db.commit()
        db.refresh(config)
        return {"is_activated": False}
    if config.is_activated:
        if getattr(config, 'machine_id', None) != current_machine_id:
            return {"is_activated": False} 
    return {"is_activated": config.is_activated}

def activate_application(db: Session, key: str):
    clean_key = key.replace("-", "").strip().upper()
    key_pattern = r"^[A-Z0-9]{14}$"
    if not re.match(key_pattern, clean_key):
        return {"success": False, "message": "Invalid key format."}
        
    if not verify_key_signature(clean_key):
        return {"success": False, "message": "Unauthorized key. Activation failed."}
        
    config = db.query(models.SystemConfig).first()
    if not config:
        config = models.SystemConfig(is_activated=False)
        db.add(config)
        
    config.is_activated = True
    config.license_key = clean_key
    config.machine_id = get_machine_id()
    db.commit()
    return {"success": True, "message": "Application activated and bound to this machine!"}

def generate_invoice_number(db: Session, doc_type):
    doc_str = str(doc_type).split('.')[-1].upper()
    prefix = "QUO" if doc_str == "QUOTATION" else "INV"
    
    while True:
        candidate = f"{prefix}-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        exists = db.query(models.Invoice).filter(models.Invoice.invoice_number == candidate).first()
        if not exists:
            return candidate

# FIXED: Now strictly returns a String to prevent SQLAlchemy Date crashes
def parse_date_safe(date_val):
    if not date_val:
        return None
    if isinstance(date_val, str):
        val = date_val.strip()
        return val if val else None
    if hasattr(date_val, 'strftime'):
        return date_val.strftime("%Y-%m-%d")
    return str(date_val)

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

    frontend_status = getattr(data, 'payment_status', None)

    if frontend_status == "PAID":
        payment_status = "PAID"
        remaining_balance = 0.0
    elif frontend_status == "INSTALLMENT":
        payment_status = "INSTALLMENT"
    elif frontend_status == "PARTIAL":
        payment_status = "PARTIAL"
    elif frontend_status == "DUE":
        payment_status = "DUE"
    else:
        if grand_total > 0 and (remaining_balance <= 0.0 or advance_paid >= grand_total):
            payment_status = "PAID"
            remaining_balance = 0.0
        else:
            mode_str = str(data.payment_mode or "").upper()
            if "INSTALLMENT" in mode_str:
                payment_status = "PARTIAL" if advance_paid > 0 else "INSTALLMENT"
            else:
                payment_status = "PARTIAL" if advance_paid > 0 else "DUE"

    installment_schedule = []
    next_due_date = None
    
    mode_str_check = str(data.payment_mode or "").upper()

    if mode_str_check == "FULL" or not data.payment_mode or payment_status == "PAID":
        next_due_date = parse_date_safe(getattr(data, 'due_date', None))
    else:
        parts = 3 if "INSTALLMENT_3" in mode_str_check else (4 if "INSTALLMENT_4" in mode_str_check else 3)
        
        base_date_str = getattr(data, 'emi_start_date', None)
        if not base_date_str or not str(base_date_str).strip():
            base_date = datetime.now().date()
        else:
            try:
                base_date = datetime.strptime(str(base_date_str).strip(), "%Y-%m-%d").date()
            except ValueError:
                base_date = datetime.now().date()
                
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
                "due_date": due.strftime("%Y-%m-%d"),
                "status": "DUE"
            })
        
        next_due_date = (base_date + timedelta(days=30)).strftime("%Y-%m-%d")

    incoming_inv_num = getattr(data, 'invoice_number', None)
    existing_inv = None
    if incoming_inv_num and incoming_inv_num.strip():
        existing_inv = db.query(models.Invoice).filter(models.Invoice.invoice_number == incoming_inv_num.strip()).first()

    order_date_val = parse_date_safe(getattr(data, 'order_dated', None))
    delivery_note_date_val = parse_date_safe(getattr(data, 'delivery_note_date', None))

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
        existing_inv.payment_status = payment_status
        existing_inv.next_due_date = next_due_date
        existing_inv.due_date = parse_date_safe(getattr(data, 'due_date', None))
        existing_inv.emi_start_date = parse_date_safe(getattr(data, 'emi_start_date', None))

        db.commit()
        db.refresh(existing_inv)
        return existing_inv

    else:
        invoice_number = incoming_inv_num.strip() if incoming_inv_num and incoming_inv_num.strip() else generate_invoice_number(db, data.doc_type)

        invoice = models.Invoice(
            invoice_number=invoice_number,
            doc_type=data.doc_type,
            company_name=data.company_name, company_address=data.company_address, company_showroom=data.company_showroom,
            company_gstin=data.company_gstin, company_state=data.company_state, company_state_code=data.company_state_code,
            company_phones=data.company_phones, company_email=data.company_email, company_pan=data.company_pan, company_logo=data.company_logo,                      
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
            payment_status=payment_status,
            next_due_date=next_due_date, due_date=parse_date_safe(getattr(data, 'due_date', None)), emi_start_date=parse_date_safe(getattr(data, 'emi_start_date', None))
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice


def create_purchase_invoice(db: Session, data):
    db_item = models.PurchaseInvoiceModel(**data.dict())
    db.add(db_item)
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
        log_stock_change(db, product.product_name, "ADJUST", int(qty_diff), int(new_quantity), "Manual Adjustment")
    return product

def get_all_invoices(db: Session): 
    invoices = db.query(models.Invoice).order_by(models.Invoice.id.desc()).all()
    for inv in invoices:
        amount = float(inv.total_amount or 0)
        advance = float(inv.advance_paid or 0)
        status_str = str(getattr(inv, 'payment_status', '')).split('.')[-1].upper()
        if status_str == "PAID":
            inv.remaining_amount = 0.0
        else:
            inv.remaining_amount = max(0.0, amount - advance)
    return invoices

def get_invoice_by_id(db: Session, invoice_id: int): 
    return db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()

def update_invoice(db: Session, invoice_id: int, data):
    """Updates an existing invoice by ID."""
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        return None
    
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

    frontend_status = getattr(data, 'payment_status', None)

    if frontend_status == "PAID":
        payment_status = "PAID"
        remaining_balance = 0.0
    elif frontend_status == "INSTALLMENT":
        payment_status = "INSTALLMENT"
    elif frontend_status == "PARTIAL":
        payment_status = "PARTIAL"
    elif frontend_status == "DUE":
        payment_status = "DUE"
    else:
        if grand_total > 0 and (remaining_balance <= 0.0 or advance_paid >= grand_total):
            payment_status = "PAID"
            remaining_balance = 0.0
        else:
            mode_str = str(data.payment_mode or "").upper()
            if "INSTALLMENT" in mode_str:
                payment_status = "PARTIAL" if advance_paid > 0 else "INSTALLMENT"
            else:
                payment_status = "PARTIAL" if advance_paid > 0 else "DUE"

    installment_schedule = []
    next_due_date = None
    
    mode_str_check = str(data.payment_mode or "").upper()

    if mode_str_check == "FULL" or not data.payment_mode or payment_status == "PAID":
        next_due_date = parse_date_safe(getattr(data, 'due_date', None))
    else:
        parts = 3 if "INSTALLMENT_3" in mode_str_check else (4 if "INSTALLMENT_4" in mode_str_check else 3)
        
        base_date_str = getattr(data, 'emi_start_date', None)
        if not base_date_str or not str(base_date_str).strip():
            base_date = datetime.now().date()
        else:
            try:
                base_date = datetime.strptime(str(base_date_str).strip(), "%Y-%m-%d").date()
            except ValueError:
                base_date = datetime.now().date()
                
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
                "due_date": due.strftime("%Y-%m-%d"),
                "status": "DUE"
            })
        
        next_due_date = (base_date + timedelta(days=30)).strftime("%Y-%m-%d")

    order_date_val = parse_date_safe(getattr(data, 'order_dated', None))
    delivery_note_date_val = parse_date_safe(getattr(data, 'delivery_note_date', None))

    # Update invoice fields
    invoice.doc_type = data.doc_type
    invoice.company_name = data.company_name
    invoice.company_address = data.company_address
    invoice.company_showroom = data.company_showroom
    invoice.company_gstin = data.company_gstin
    invoice.company_state = data.company_state
    invoice.company_state_code = data.company_state_code
    invoice.company_phones = data.company_phones
    invoice.company_email = data.company_email
    invoice.company_pan = data.company_pan
    invoice.company_logo = data.company_logo             
    invoice.digital_signature = data.digital_signature

    invoice.client_name = client_name
    invoice.client_mobile = data.client_mobile
    invoice.client_email = data.client_email
    invoice.client_address = data.client_address
    invoice.client_gstin = data.client_gstin
    invoice.client_state = data.client_state
    invoice.client_state_code = data.client_state_code
    invoice.firm_state_code = data.firm_state_code
    invoice.place_of_supply = data.place_of_supply

    invoice.delivery_note = data.delivery_note
    invoice.reference_no_date = data.reference_no_date
    invoice.other_references = data.other_references
    invoice.buyers_order_no = data.buyers_order_no
    invoice.order_dated = order_date_val
    invoice.dispatch_doc_no = data.dispatch_doc_no
    invoice.delivery_note_date = delivery_note_date_val
    invoice.dispatched_through = data.dispatched_through
    invoice.destination = data.destination
    invoice.terms_of_delivery = data.terms_of_delivery

    invoice.bank_name = data.bank_name
    invoice.account_no = data.account_no
    invoice.branch_ifsc = data.branch_ifsc
    invoice.qr_code_image = data.qr_code_image

    invoice.items = items_list
    flag_modified(invoice, "items")

    invoice.total_amount = grand_total
    invoice.advance_paid = advance_paid
    invoice.installation_charges = installation_charges
    invoice.remaining_amount = remaining_balance
    invoice.cgst_total = cgst
    invoice.sgst_total = sgst
    invoice.igst_total = igst
    invoice.payment_mode = data.payment_mode
    invoice.is_gst_enabled = data.is_gst_enabled
    invoice.installment_schedule = installment_schedule if installment_schedule else None
    invoice.payment_status = payment_status
    invoice.next_due_date = next_due_date
    invoice.due_date = parse_date_safe(getattr(data, 'due_date', None))
    invoice.emi_start_date = parse_date_safe(getattr(data, 'emi_start_date', None))
    invoice.invoice_number = getattr(data, 'invoice_number', invoice.invoice_number)
    invoice.invoice_date = parse_date_safe(getattr(data, 'invoice_date', None))

    db.commit()
    db.refresh(invoice)
    return invoice

def process_payment(db: Session, invoice_id: int, installment_no: int):
    invoice = get_invoice_by_id(db, invoice_id)
    if not invoice: return None
    if installment_no == 0:
        invoice.advance_paid += invoice.remaining_amount
        invoice.remaining_amount = 0
        invoice.payment_status = "PAID"
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
                invoice.payment_status = "PAID"
                invoice.next_due_date = None
            else:
                invoice.payment_status = "PARTIAL"
                if next_due_string: invoice.next_due_date = next_due_string
    db.commit()
    db.refresh(invoice)
    return invoice

def get_amc_contracts(db: Session):
    return db.query(models.AmcContractModel).all()

def create_amc_contract(db: Session, data):
    db_item = models.AmcContractModel(**data.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_invoice(db: Session, invoice_id: int):
    db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    
    if not db_invoice:
        return False
        
    doc_type_str = str(getattr(db_invoice, 'doc_type', '')).split('.')[-1].upper()
    if doc_type_str == "INVOICE" and db_invoice.items:
        try:
            items = json.loads(db_invoice.items) if isinstance(db_invoice.items, str) else db_invoice.items
            
            for item in items:
                product_id = item.get("product_id") or item.get("id")
                quantity = item.get("quantity", 1)
                
                if product_id:
                    db_inventory = db.query(models.Inventory).filter(models.Inventory.id == product_id).first()
                    if db_inventory:
                        db_inventory.stock_quantity += quantity
                        
        except Exception as e:
            print(f"Error restoring inventory during invoice deletion: {e}")

    db.delete(db_invoice)
    db.commit()
    
    return True

def get_dashboard_statistics(db: Session):
    invoices = db.query(models.Invoice).all()
    
    total_sales = 0
    total_collected = 0
    total_due = 0
    invoice_count = 0
    
    for inv in invoices:
        doc_type_str = str(getattr(inv, 'doc_type', '')).split('.')[-1].upper()
        if doc_type_str == "QUOTATION":
            continue
            
        invoice_count += 1
        
        amount = float(inv.total_amount or 0)
        advance = float(inv.advance_paid or 0)
        
        status_str = str(getattr(inv, 'payment_status', '')).split('.')[-1].upper()
        if status_str == "PAID":
            collected = amount
            due = 0
        else:
            collected = advance
            due = max(0, amount - advance)
            
        total_sales += amount
        total_collected += collected
        total_due += due

    return {
        "total_sales": round(total_sales, 2),
        "total_collected": round(total_collected, 2),
        "total_due": round(total_due, 2),
        "total_invoices": invoice_count
    }

def get_invoices(db: Session, skip: int = 0, limit: int = 100):
    invoices = db.query(models.Invoice).offset(skip).limit(limit).all()
    
    for inv in invoices:
        amount = float(inv.total_amount or 0)
        advance = float(inv.advance_paid or 0)
        
        status_str = str(getattr(inv, 'payment_status', '')).split('.')[-1].upper()
        if status_str == "PAID":
            inv.remaining_amount = 0.0
        else:
            inv.remaining_amount = max(0.0, amount - advance)
            
    return invoices