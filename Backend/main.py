from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import extract, func
from typing import List
from alembic.config import Config
from alembic import command
import os
import string
import random

import models, schemas, crud
from db import engine, get_db, ensure_tables_created

def run_database_migrations():
    """Silently applies any pending database updates on startup."""
    print("Checking for database migrations...")
    try:
        # Get the absolute path to alembic.ini
        current_dir = os.path.dirname(os.path.abspath(__file__))
        alembic_ini_path = os.path.join(current_dir, "alembic.ini")
        
        alembic_cfg = Config(alembic_ini_path)
        command.upgrade(alembic_cfg, "head")
        print("Database schema is up to date!")
    except Exception as e:
        print(f"Migration error (ignoring if DB is already locked): {e}")

# Run migrations before initializing the app
run_database_migrations()

# Ensure ALL model tables exist (safety net for tables not covered by migrations)
ensure_tables_created()

app = FastAPI(title="NextGen TechStack ERP - Offline Billing")

# Enable CORS for Electron/React communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/reports/sales")
def get_sales_report(timeframe: str, year: int, month: int = None, db: Session = Depends(get_db)):
    """
    Fetches aggregated or raw invoice data for reports based on timeframe ('yearly' or 'monthly').
    """
    invoices = crud.get_sales_report_data(db, timeframe, year, month)
    
    total_sales = sum(inv.total_amount or 0 for inv in invoices)
    total_due = sum(inv.remaining_amount or 0 for inv in invoices)
    total_collected = total_sales - total_due
    
    return {
        "timeframe": timeframe,
        "year": year,
        "month": month,
        "total_sales": round(total_sales, 2),
        "total_collected": round(total_collected, 2),
        "total_due": round(total_due, 2),
        "total_invoices": len(invoices),
        "invoices": invoices
    }

# --- INVOICE ROUTES ---

@app.post("/invoices", response_model=None)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Creates an invoice or quotation and updates stock if necessary."""
    return crud.create_invoice(db, invoice)

@app.put("/invoices/{invoice_id}")
def update_invoice(invoice_id: int, invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Updates an existing invoice."""
    return crud.create_invoice(db, invoice)

@app.get("/invoices")
def get_all(db: Session = Depends(get_db)):
    """Fetches all documents ordered by newest first."""
    return crud.get_all_invoices(db)

@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@app.post("/invoice/pay/{invoice_id}/{installment_no}")
def pay_invoice(invoice_id: int, installment_no: int, db: Session = Depends(get_db)):
    """Updates payment status for EMI or Full payments."""
    updated_invoice = crud.process_payment(db, invoice_id, installment_no)
    if not updated_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return updated_invoice

# --- NEW ERP MODULE ROUTES ---

@app.get("/purchases")
def get_purchase_invoices(db: Session = Depends(get_db)):
    return crud.get_purchase_invoices(db)

@app.post("/purchases")
def log_purchase_invoice(data: schemas.PurchaseInvoiceCreate, db: Session = Depends(get_db)):
    return crud.create_purchase_invoice(db, data)

@app.delete("/purchases/{purchase_id}")
def delete_purchase_invoice(purchase_id: int, db: Session = Depends(get_db)):
    res = crud.delete_purchase_invoice(db, purchase_id)
    if not res:
        raise HTTPException(404, "Purchase invoice not found")
    return {"message": "Deleted successfully"}

@app.get("/vendors")
def get_vendors(db: Session = Depends(get_db)):
    return crud.get_vendor_ledger(db)

@app.put("/vendors/{vendor_id}/pay")
def pay_vendor(vendor_id: int, db: Session = Depends(get_db)):
    res = crud.update_vendor_payment(db, vendor_id)
    if not res:
        raise HTTPException(404, "Vendor not found")
    return res

@app.get("/follow-ups")
def get_followups(db: Session = Depends(get_db)):
    return crud.get_active_follow_ups(db)

@app.post("/follow-ups")
def create_followup(data: schemas.FollowUpCreate, db: Session = Depends(get_db)):
    return crud.create_follow_up(db, data)

@app.put("/follow-ups/{f_id}/done")
def complete_followup(f_id: int, db: Session = Depends(get_db)):
    res = crud.mark_follow_up_done(db, f_id)
    if not res:
        raise HTTPException(404, "Follow up not found")
    return res

@app.get("/stock-history")
def get_stock_audit(db: Session = Depends(get_db)):
    return crud.get_stock_history(db)


# --- INVENTORY ROUTES ---

@app.get("/inventory")
def list_inventory(db: Session = Depends(get_db)):
    """Returns the list of all products and their current stock levels."""
    return crud.get_inventory(db)

@app.post("/inventory")
def add_to_inventory(item: schemas.InventoryItem, db: Session = Depends(get_db)):
    """Adds a new product to the master inventory list."""
    return crud.add_inventory_item(db, item)

@app.put("/inventory/{product_id}")
def update_stock_level(product_id: int, quantity: float, db: Session = Depends(get_db)):
    """Manually update stock levels (for returns or refills)."""
    product = crud.update_stock(db, product_id, quantity)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

from sqlalchemy.exc import IntegrityError

@app.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    try:
        db.delete(db_item)
        db.commit()
        return {"message": "Item deleted successfully"}
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete this product because it is linked to an existing invoice."
        )    


# --- GST REPORTING ROUTES ---

@app.get("/export/gstr1/{month}/{year}")
def export_gstr1_report(month: int, year: int, db: Session = Depends(get_db)):
    """
    Generates GSTR-1 compliant data for the selected period.
    Filters directly in the database for optimal performance.
    """
    report_data = db.query(models.Invoice).filter(
        models.Invoice.doc_type == models.DocTypeEnum.INVOICE,
        extract('month', models.Invoice.created_at) == month,
        extract('year', models.Invoice.created_at) == year
    ).all()
    
    return {
        "month": month,
        "year": year,
        "total_invoices": len(report_data),
        "data": report_data
    }


# --- DASHBOARD ROUTES ---

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Calculates overall business metrics directly using SQL aggregation."""
    
    stats = db.query(
        func.count(models.Invoice.id).label("total_invoices"),
        func.sum(models.Invoice.total_amount).label("total_sales"),
        func.sum(models.Invoice.remaining_amount).label("total_due")
    ).filter(
        models.Invoice.doc_type == models.DocTypeEnum.INVOICE
    ).first()

    total_sales = stats.total_sales or 0.0
    total_due = stats.total_due or 0.0
    total_invoices = stats.total_invoices or 0
    total_collected = total_sales - total_due
    
    return {
        "total_sales": round(total_sales, 2),
        "total_collected": round(total_collected, 2),
        "total_due": round(total_due, 2),
        "total_invoices": total_invoices
    }

@app.get("/amc")
def get_amc(db: Session = Depends(get_db)):
    return crud.get_amc_contracts(db)

@app.post("/amc")
def add_amc(data: schemas.AmcContractCreate, db: Session = Depends(get_db)):
    return crud.create_amc_contract(db, data)

@app.get("/system/status")
def get_system_status(db: Session = Depends(get_db)):
    """Frontend calls this to see if the app is locked or unlocked."""
    return crud.check_application_status(db)

@app.post("/system/activate")
def activate_system(req: schemas.ActivationRequest, db: Session = Depends(get_db)):
    """Endpoint to submit and verify the activation key."""
    result = crud.activate_application(db, req.key)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Activation failed."))
    return result