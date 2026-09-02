from fastapi import FastAPI, Depends, HTTPException
from fastapi import File, UploadFile
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import extract, func
from typing import List, Optional
from alembic.config import Config
from alembic import command
from pydantic import BaseModel
import asyncio
import os
import platform
import string
import random
import uuid
import hashlib
import base64
import json
import re
import urllib.request
import urllib.error
import urllib.parse
import datetime
from dotenv import load_dotenv

# Load variables from a .env file (in the same folder as this script) into the
# environment. Safe to call even if no .env file exists — it just no-ops.
load_dotenv()

import models, schemas, crud
from db import engine, get_db, ensure_tables_created

# Cryptographic secret for signing keys (Must match the generator)
APP_SECRET = "ERP_SECURE_2026"

def get_machine_id():
    """Generates a unique hardware ID based on the physical MAC address."""
    # Zero-pad to 12 hex chars (6 octets) so slicing is always correct,
    # even when the leading octet is < 0x10 (would otherwise be 11 chars).
    mac_num = hex(uuid.getnode()).replace('0x', '').upper().zfill(12)
    mac_address = '-'.join(mac_num[i: i + 2] for i in range(0, 12, 2))
    return f"MACHINE-{mac_address}"

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

# ---------------------------------------------------------------------------
# SYSTEM & ACTIVATION ROUTES
# ---------------------------------------------------------------------------
# --- SYSTEM & ACTIVATION ROUTES (INSTALL-BOUND LICENSING) ---

USER_HOME = os.path.expanduser("~")
TRIAL_DAYS = 7

def get_app_data_dir() -> str:
    """
    Returns the OS-conventional local application-data directory for this app
    (e.g. %LOCALAPPDATA%\\NextGenERP on Windows, ~/Library/Application Support/
    NextGenERP on macOS, ~/.local/share/NextGenERP on Linux). Installers/
    uninstallers know about and clean these locations, unlike an arbitrary
    dotfile dropped directly in the user's home directory — so license and
    trial state here actually gets removed on uninstall, re-locking the app
    on reinstall as intended.
    """
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or USER_HOME
    elif system == "Darwin":
        base = os.path.join(USER_HOME, "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.join(USER_HOME, ".local", "share")
    return os.path.join(base, "NextGenERP")

APP_DATA_DIR = get_app_data_dir()

# Ensure the directory exists before trying to write to it
os.makedirs(APP_DATA_DIR, exist_ok=True)

# Paths for the license and trial markers, stored in the OS app-data folder
LICENSE_FILE = os.path.join(APP_DATA_DIR, ".app_license")
TRIAL_FILE = os.path.join(APP_DATA_DIR, ".app_trial")

def _expected_key_for_machine(machine_id: str) -> str:
    """Derives the expected license key for a given machine ID. Shared by
    /system/status and /system/activate so the two can't drift apart."""
    expected_hash = hashlib.sha256((machine_id + APP_SECRET).encode()).hexdigest().upper()
    expected_base = expected_hash[:12]
    total = sum(ord(c) for c in expected_base)
    CHARS = string.ascii_uppercase + string.digits
    char1 = CHARS[total % len(CHARS)]
    char2 = CHARS[(total * 7) % len(CHARS)]
    return expected_base + char1 + char2

def _trial_signature(machine_id: str, start_iso: str) -> str:
    """Ties a trial marker to one machine and one start date so it can't be
    hand-edited (to extend the trial) or copied onto another machine."""
    return hashlib.sha256(f"{machine_id}|{start_iso}|{APP_SECRET}|TRIAL".encode()).hexdigest()

def _read_trial_state(machine_id: str) -> dict:
    """Returns is_trial / trial_expired / trial_days_remaining / can_start_trial
    for this machine, based on the signed trial marker (if any)."""
    if not os.path.exists(TRIAL_FILE):
        return {"is_trial": False, "trial_expired": False, "trial_days_remaining": 0, "can_start_trial": True}

    try:
        with open(TRIAL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        saved_machine = data.get("machine_id", "")
        start_iso = data.get("start_date", "")
        saved_sig = data.get("sig", "")

        if saved_machine != machine_id or _trial_signature(machine_id, start_iso) != saved_sig:
            # Tampered, or copied from another machine's trial file. A trial
            # marker exists but isn't valid for this machine — don't honor it
            # and don't allow starting a new one on top of it either.
            return {"is_trial": False, "trial_expired": True, "trial_days_remaining": 0, "can_start_trial": False}

        start_date = datetime.datetime.fromisoformat(start_iso)
        elapsed_days = (datetime.datetime.utcnow() - start_date).days
        days_remaining = TRIAL_DAYS - elapsed_days

        if days_remaining <= 0:
            return {"is_trial": False, "trial_expired": True, "trial_days_remaining": 0, "can_start_trial": False}

        return {"is_trial": True, "trial_expired": False, "trial_days_remaining": days_remaining, "can_start_trial": False}

    except Exception as e:
        print(f"[Trial Read Error]: {e}")
        # Unreadable/corrupt marker — treat as no trial on record yet.
        return {"is_trial": False, "trial_expired": False, "trial_days_remaining": 0, "can_start_trial": True}

class TrialRequest(BaseModel):
    machine_id: Optional[str] = None

@app.get("/system/machine-id")
def get_machine_id_endpoint():
    """Provides the unique hardware ID to the React frontend."""
    return {"machine_id": get_machine_id()}

@app.get("/system/status")
def get_system_status(db: Session = Depends(get_db)):
    """
    Checks activation + trial status for this installation. Both markers live
    in the OS app-data folder, so uninstalling the app clears them and
    re-locks it on reinstall.
    """
    machine_id = get_machine_id()

    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, "r", encoding="utf-8") as f:
                saved_key = f.read().strip()

            if saved_key.replace("-", "").upper() == _expected_key_for_machine(machine_id):
                return {
                    "is_activated": True,
                    "is_trial": False,
                    "trial_days_remaining": 0,
                    "trial_expired": False,
                    "can_start_trial": False,
                }
            else:
                return {
                    "is_activated": False,
                    "is_trial": False,
                    "trial_days_remaining": 0,
                    "trial_expired": False,
                    "can_start_trial": False,
                    "message": "License invalid for this machine.",
                }
        except Exception as e:
            print(f"[License Read Error]: {e}")

    trial_state = _read_trial_state(machine_id)
    return {"is_activated": False, **trial_state}

@app.post("/system/start-trial")
def start_trial(req: TrialRequest = None, db: Session = Depends(get_db)):
    """
    Starts the 7-day free trial for this machine and persists a signed,
    machine-bound marker in the OS app-data folder. Returns the current
    trial state if a trial is already running, and rejects the request if
    the trial for this machine has already been used or the app is
    already fully activated.
    """
    machine_id = get_machine_id()

    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, "r", encoding="utf-8") as f:
                saved_key = f.read().strip()
            if saved_key.replace("-", "").upper() == _expected_key_for_machine(machine_id):
                raise HTTPException(status_code=400, detail="This machine already has a full license.")
        except HTTPException:
            raise
        except Exception:
            pass

    trial_state = _read_trial_state(machine_id)

    if trial_state["is_trial"]:
        return {
            "success": True,
            "is_trial": True,
            "trial_days_remaining": trial_state["trial_days_remaining"],
        }

    if not trial_state["can_start_trial"]:
        raise HTTPException(status_code=400, detail="The free trial has already been used on this machine.")

    start_iso = datetime.datetime.utcnow().isoformat()
    payload = {
        "machine_id": machine_id,
        "start_date": start_iso,
        "sig": _trial_signature(machine_id, start_iso),
    }

    try:
        with open(TRIAL_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception as e:
        print(f"[Trial Write Error]: {e}")
        raise HTTPException(status_code=500, detail="Failed to start trial.")

    return {"success": True, "is_trial": True, "trial_days_remaining": TRIAL_DAYS}

@app.post("/system/activate")
def activate_system(req: schemas.ActivationRequest, db: Session = Depends(get_db)):
    """
    Verifies the key against the machine hardware and creates the local installation license.
    """
    machine_id = get_machine_id()
    expected_key = _expected_key_for_machine(machine_id)

    clean_key = req.key.replace("-", "").upper()
    if clean_key != expected_key:
        raise HTTPException(status_code=400, detail="Invalid Key. This key is not licensed for this machine.")
    
    # Save the license in the OS app-data folder
    try:
        with open(LICENSE_FILE, "w", encoding="utf-8") as f:
            f.write(clean_key)
    except Exception as e:
        print(f"[License Write Error]: {e}")
        raise HTTPException(status_code=500, detail="Failed to save local license file.")
        
    try:
        crud.activate_application(db, req.key)
    except Exception:
        pass

    return {"success": True, "message": "Application successfully activated!"}

# ---------------------------------------------------------------------------
# REPORTS ROUTES
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# INVOICE ROUTES
# ---------------------------------------------------------------------------

@app.get("/invoices/by-number/{invoice_number:path}")
def get_invoice_by_number(invoice_number: str, db: Session = Depends(get_db)):
    """
    Fetches an invoice or quotation by its string invoice_number 
    (e.g., /invoices/by-number/INV-08/26-6 or URL-encoded).
    """
    decoded_number = urllib.parse.unquote(invoice_number)
    
    invoice = db.query(models.Invoice).filter(
        (models.Invoice.invoice_number == decoded_number) | 
        (models.Invoice.invoice_number == invoice_number)
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=404, 
            detail=f"Invoice with number '{decoded_number}' not found"
        )
    return invoice  

@app.post("/invoices", response_model=None)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Creates an invoice or quotation and updates stock if necessary."""
    return crud.create_invoice(db, invoice)

@app.put("/invoices/{invoice_id}")
def update_invoice(invoice_id: int, invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Updates an existing invoice."""
    return crud.update_invoice(db, invoice_id, invoice)

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

@app.delete("/invoices/{invoice_id}")
def delete_invoice_endpoint(invoice_id: int, db: Session = Depends(get_db)):
    """Deletes an invoice permanently."""
    result = crud.delete_invoice(db, invoice_id)
    if not result:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}

# ---------------------------------------------------------------------------
# ERP MODULE ROUTES (Purchases, Vendors, Follow-ups, Stock)
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# INVENTORY ROUTES
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# GST REPORTING ROUTES
# ---------------------------------------------------------------------------

@app.get("/export/gstr1/{month}/{year}")
def export_gstr1_report(month: int, year: int, db: Session = Depends(get_db)):
    """
    Generates GSTR-1 compliant data for the selected period.
    Filters directly in the database for optimal performance.
    """
    report_data = db.query(models.Invoice).filter(
        models.Invoice.doc_type == "INVOICE",
        extract('month', models.Invoice.created_at) == month,
        extract('year', models.Invoice.created_at) == year
    ).all()
    
    return {
        "month": month,
        "year": year,
        "total_invoices": len(report_data),
        "data": report_data
    }

# ---------------------------------------------------------------------------
# DASHBOARD ROUTES
# ---------------------------------------------------------------------------

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Calculates overall business metrics directly using SQL aggregation."""
    return crud.get_dashboard_statistics(db)

# ---------------------------------------------------------------------------
# AMC ROUTES
# ---------------------------------------------------------------------------

@app.get("/amc")
def get_amc(db: Session = Depends(get_db)):
    return crud.get_amc_contracts(db)

@app.post("/amc")
def add_amc(data: schemas.AmcContractCreate, db: Session = Depends(get_db)):
    return crud.create_amc_contract(db, data)

# ---------------------------------------------------------------------------
# AI EXTRACTION ROUTES  (local vision model via Ollama — free, offline,
# no API key, no per-call cost. Replaces the old Gemini-based extraction.)
#
# Setup (one-time, all free):
#   1. Install Ollama:              https://ollama.com/download
#   2. Pull a vision model:         ollama pull minicpm-v
#   3. Make sure it's running:      ollama serve   (usually auto-starts)
#   4. pip install pymupdf          (only needed to turn PDF uploads into
#                                     an image before OCR — pure Python
#                                     wheel, no poppler/system install)
#
# "minicpm-v" is a good default: small (~5.5GB), fast even on CPU, and
# solid at reading invoices/receipts. "llava" or "qwen2.5vl" also work —
# just change OLLAMA_VISION_MODEL below or set the env var of the same name.
# ---------------------------------------------------------------------------

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "minicpm-v")

class AIPayload(BaseModel):
    file_name: Optional[str] = "document.pdf"
    mime_type: Optional[str] = "application/pdf"
    file_base64: str

# Keep old name as alias so any existing call-sites still work
AIPurchasePayload = AIPayload


def _parse_ai_json(response_text: str) -> dict:
    """
    Robustly parses JSON out of a local model's text response.
    Handles both clean JSON and markdown-fenced ```json ... ``` blocks.
    """
    text = response_text.strip()

    # Strip markdown code fences if present
    fenced = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if fenced:
        text = fenced.group(1).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Last resort: find the first JSON object/array in the string
    obj_match = re.search(r"\{[\s\S]+\}", text)
    if obj_match:
        try:
            return json.loads(obj_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from model response: {text[:200]}")


def _pdf_first_page_to_png_base64(base64_pdf: str) -> str:
    """
    Renders the first page of a base64-encoded PDF to a PNG (base64-encoded).
    Vision models take images, not PDFs, so multi-page PDF uploads are
    reduced to their first page — that's where invoice/AMC headers live.

    Uses PyMuPDF (`pip install pymupdf`), which ships its own rendering
    engine as a pure wheel — no poppler/pdftoppm system install needed,
    unlike pdf2image.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF support needs PyMuPDF. Run: pip install pymupdf"
        )

    pdf_bytes = base64.b64decode(base64_pdf)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count == 0:
        raise HTTPException(status_code=400, detail="Uploaded PDF has no pages.")
    pix = doc[0].get_pixmap(dpi=200)  # 200dpi is plenty for OCR-quality text
    return base64.b64encode(pix.tobytes("png")).decode("utf-8")


def _sync_extract_with_gemini(base64_data: str, mime_type: str, prompt: str) -> dict:
    """
    Extracts structured JSON from an image/PDF using a local vision model
    served by Ollama (https://ollama.com) — completely free, runs on your
    own machine, no API key, no internet required after the model is
    pulled once. Runs synchronously — call via asyncio.to_thread().

    Requires:
      - Ollama installed and running (`ollama serve`, usually automatic)
      - A vision model pulled once: `ollama pull minicpm-v`
        (override with the OLLAMA_VISION_MODEL env var)

    Kept under the old function name so every existing call site below
    (and anything importing it) keeps working unchanged.
    """
    # Frontends that read files via FileReader.readAsDataURL() (common in
    # React/Electron) send strings like "data:image/jpeg;base64,/9j/4AAQ..."
    # instead of raw base64. Strip the prefix here, in the one place shared
    # by all extraction routes, so this can't reoccur per-endpoint.
    if "," in base64_data and base64_data.strip().lower().startswith("data:"):
        base64_data = base64_data.split(",", 1)[1]
    base64_data = base64_data.strip()

    # Validate it's actually decodable base64 before burning time on it —
    # fail loudly here instead of getting back an all-null JSON object.
    try:
        base64.b64decode(base64_data, validate=True)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file data isn't valid base64 (check the frontend isn't sending a data: URL prefix)."
        )

    # Ollama's vision models take images only — turn a PDF's first page
    # into a PNG before sending it.
    if mime_type == "application/pdf":
        base64_data = _pdf_first_page_to_png_base64(base64_data)

    payload = {
        "model": OLLAMA_VISION_MODEL,
        "prompt": prompt,
        "images": [base64_data],
        "format": "json",   # ask Ollama to constrain output to valid JSON
        "stream": False,
    }

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        # Local vision models are slower than a cloud API, especially on
        # CPU-only machines — give it real room before timing out.
        with urllib.request.urlopen(req, timeout=180) as response:
            res_data = json.loads(response.read().decode("utf-8"))

        raw_text = res_data.get("response", "")
        if not raw_text:
            raise KeyError("response")
        return _parse_ai_json(raw_text)

    except urllib.error.URLError as e:
        print(f"\n[Ollama Connection Error] {e}\n")
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not reach the local AI engine. Make sure Ollama is installed and "
                "running (`ollama serve`), and that the model is pulled "
                f"(`ollama pull {OLLAMA_VISION_MODEL}`)."
            )
        )
    except KeyError as e:
        print(f"\n[Ollama Parse Error] Unexpected response structure: {e}\n")
        raise HTTPException(
            status_code=502,
            detail="The local AI model returned an unexpected response format. Please try again."
        )
    except ValueError as e:
        print(f"\n[JSON Parse Error] {e}\n")
        raise HTTPException(
            status_code=502,
            detail="Could not parse structured data from the AI response. Try a clearer image, or a stronger model (e.g. `ollama pull qwen2.5vl`)."
        )
    except Exception as e:
        print(f"\n[Local AI Error] {type(e).__name__}: {e}\n")
        raise HTTPException(
            status_code=500,
            detail="Could not complete local AI extraction. Check the backend terminal for details."
        )


# ---------------------------------------------------------------------------
# POST /purchases/extract-ai  — Purchase Invoice AI autofill
# ---------------------------------------------------------------------------

@app.post("/purchases/extract-ai")
async def extract_purchase_invoice_ai(payload: AIPayload):
    """
    Extracts header-level fields (vendor, bill number, date, total) from a
    purchase invoice image or PDF using a local vision model via Ollama.
    """
    if not payload.file_base64:
        raise HTTPException(status_code=400, detail={"message": "No file data received."})

    prompt = """
    Analyze this purchase invoice or bill image and extract these exact fields:
    - vendor_name: The name of the supplier or company that issued the invoice.
    - bill_number: The invoice or bill number (string).
    - bill_date: The date of the invoice in YYYY-MM-DD format.
    - total_amount: The final grand total as a plain number (no currency symbols).
    - status: Always set this to "UNPAID".

    Return ONLY a valid JSON object with exactly these keys. If a field is not visible, use null.
    """
    return await asyncio.to_thread(
        _sync_extract_with_gemini,
        payload.file_base64,
        payload.mime_type or "image/jpeg",
        prompt,
    )


# ---------------------------------------------------------------------------
# POST /amc/extract-ai  — AMC Contract AI autofill
# ---------------------------------------------------------------------------

@app.post("/amc/extract-ai")
async def extract_amc_ai(payload: AIPayload):
    """
    Extracts AMC contract fields (client name, contact, product, dates) from
    a warranty card, service report, or contract image/PDF using a local vision model via Ollama.
    """
    if not payload.file_base64:
        raise HTTPException(status_code=400, detail={"message": "No file data received."})

    prompt = """
    Analyze this warranty card or AMC (Annual Maintenance Contract) document and extract:
    - client_name: Full name of the customer or client.
    - contact_number: Phone or mobile number as a string (digits only, no spaces or dashes).
    - product_details: Brief description of the product, device, or service covered.
    - install_date: The installation or contract start date in YYYY-MM-DD format.
    - expiry_date: The warranty or contract expiry date in YYYY-MM-DD format.

    Return ONLY a valid JSON object with exactly these keys. Use null for any field not found.
    """
    return await asyncio.to_thread(
        _sync_extract_with_gemini,
        payload.file_base64,
        payload.mime_type or "image/jpeg",
        prompt,
    )


# ---------------------------------------------------------------------------
# POST /ocr/receipt  — Inventory receipt line-item extraction
# ---------------------------------------------------------------------------

RECEIPT_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "application/pdf"}

@app.post("/ocr/receipt")
async def ocr_receipt(file: UploadFile = File(...)):
    """
    Extracts individual line items from a receipt or inventory invoice using
    a local vision model via Ollama. Returns a structured list of items ready to be
    added to the inventory.
    """
    if not file.content_type or file.content_type not in RECEIPT_ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail={"message": "Please upload a JPG, PNG, WEBP, BMP, or PDF file."}
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=400,
            detail={"message": "Uploaded file is empty."}
        )

    base64_data = base64.b64encode(contents).decode("utf-8")

    prompt = """
    Extract ALL individual line items from this receipt or purchase invoice.
    Return ONLY valid JSON with an "items" array. Each element MUST have:
    {
        "items": [
            {
                "description": "Product name or description",
                "hsn_code": "4-8 digit HSN/SAC code if visible, otherwise empty string",
                "quantity": 1.0,
                "price": 0.00,
                "unit": "Pcs",
                "gst_rate": 18.0
            }
        ]
    }
    Rules:
    - Skip header/footer rows (totals, taxes, discounts) — only include actual product lines.
    - quantity and price must be plain numbers (no currency symbols).
    - gst_rate is a percentage number (e.g. 18.0 for 18%).
    - If GST rate is not visible, default to 18.0.
    - If unit is not visible, default to "Pcs".
    """

    extracted_data = await asyncio.to_thread(
        _sync_extract_with_gemini,
        base64_data,
        file.content_type or "image/jpeg",
        prompt,
    )

    return {
        "success": True,
        "items": extracted_data.get("items", [])
    }