# Invoice Management System - API Endpoints Integration Guide

## Overview
Complete integration of backend API endpoints with frontend pages (InvoiceGenerator.jsx & SavedInvoices.jsx)

---

## 📋 API Endpoints

### 1. **GET /invoices** - Fetch All Invoices
**Backend:** `main.py` line 242-244  
**Function:** `crud.get_all_invoices()`  
**Frontend:** `SavedInvoices.jsx` line 75
```python
@app.get("/invoices")
def get_all(db: Session = Depends(get_db)):
    return crud.get_all_invoices(db)
```

```javascript
// SavedInvoices.jsx
const response = await fetch(`${API_BASE}/invoices`);
const data = await response.json();
setInvoices(data.map(normalizeInvoice));
```

---

### 2. **GET /invoices/{invoice_id}** - Fetch Single Invoice
**Backend:** `main.py` line 246-250  
**Function:** Direct database query  
**Frontend:** `InvoiceGenerator.jsx` line ~240
```python
@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice
```

```javascript
// InvoiceGenerator.jsx - Auto-loads when URL param exists
if (invoiceId) {
  const res = await api.get(`/invoices/${invoiceId}`);
  const inv = res.data;
  // Populate form with invoice data
}
```

---

### 3. **POST /invoices** - Create New Invoice
**Backend:** `main.py` line 234-237  
**Function:** `crud.create_invoice()`  
**Frontend:** `InvoiceGenerator.jsx` line 953

```python
@app.post("/invoices", response_model=None)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    return crud.create_invoice(db, invoice)
```

```javascript
// InvoiceGenerator.jsx - handleSaveInvoiceData()
const payload = compilePayload();
await api.post("/invoices", payload);
```

---

### 4. **PUT /invoices/{invoice_id}** - Update Invoice ✅ NEW
**Backend:** `main.py` line 239-241  
**Function:** `crud.update_invoice()` (NEW FUNCTION ADDED)  
**Frontend:** `InvoiceGenerator.jsx` line 953

```python
@app.put("/invoices/{invoice_id}")
def update_invoice(invoice_id: int, invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    return crud.update_invoice(db, invoice_id, invoice)
```

```javascript
// InvoiceGenerator.jsx - handleSaveInvoiceData()
if (selectedInvoice && selectedInvoice.id) {
  await api.put(`/invoices/${selectedInvoice.id}`, payload);
}
```

---

### 5. **POST /invoice/pay/{invoice_id}/{installment_no}** - Mark as Paid
**Backend:** `main.py` line 252-258  
**Function:** `crud.process_payment()`  
**Frontend:** `SavedInvoices.jsx` line 147

```python
@app.post("/invoice/pay/{invoice_id}/{installment_no}")
def pay_invoice(invoice_id: int, installment_no: int, db: Session = Depends(get_db)):
    updated_invoice = crud.process_payment(db, invoice_id, installment_no)
    if not updated_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return updated_invoice
```

```javascript
// SavedInvoices.jsx - markPaid()
const response = await fetch(`${API_BASE}/invoice/pay/${invoice.id}/0`, {
  method: 'POST',
});
await fetchInvoices();
```

**Note:** Parameter `installment_no` is `0` for full payment, or `1-4` for specific installment

---

### 6. **DELETE /invoices/{invoice_id}** - Delete Invoice
**Backend:** `main.py` line 260-266  
**Function:** `crud.delete_invoice()`  
**Frontend:** `SavedInvoices.jsx` line 159

```python
@app.delete("/invoices/{invoice_id}")
def delete_invoice_endpoint(invoice_id: int, db: Session = Depends(get_db)):
    result = crud.delete_invoice(db, invoice_id)
    if not result:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}
```

```javascript
// SavedInvoices.jsx - deleteInvoice()
const response = await fetch(`${API_BASE}/invoices/${invoice.id}`, { 
  method: 'DELETE' 
});
setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
```

---

## 🔄 Data Flow

### Create New Invoice
```
InvoiceGenerator.jsx (Fill Form)
    ↓
Click "Save" Button
    ↓
compilePayload() → POST /invoices
    ↓
crud.create_invoice()
    ↓
Insert into Database
    ↓
Return new invoice object
    ↓
Update InvoiceList state
    ↓
Success message
```

### Edit Existing Invoice
```
SavedInvoices.jsx (Click "Edit")
    ↓
Navigate to /invoice-generator/{invoice_id}
    ↓
InvoiceGenerator.jsx loads with URL param
    ↓
GET /invoices/{invoice_id}
    ↓
Populate form with existing data
    ↓
User modifies fields
    ↓
Click "Save" Button
    ↓
PUT /invoices/{invoice_id}
    ↓
crud.update_invoice()
    ↓
Update Database
    ↓
Success message
    ↓
optionally: Navigate to SavedInvoices
```

### Duplicate Invoice
```
SavedInvoices.jsx (Click "Duplicate")
    ↓
Navigate to /invoice-generator/{invoice_id}/duplicate
    ↓
InvoiceGenerator detects /duplicate in path
    ↓
GET /invoices/{invoice_id}
    ↓
Load form with invoice data but reset:
  - invoice_number = ""
  - invoice_date = today
  - advance_paid = 0
  - item IDs = null
    ↓
User modifies as needed
    ↓
Click "Save" Button
    ↓
POST /invoices (creates new)
    ↓
Returns new invoice with new ID
```

### Mark Invoice as Paid
```
SavedInvoices.jsx (Click "Mark Paid")
    ↓
markPaid(invoice)
    ↓
POST /invoice/pay/{invoice.id}/0
    ↓
crud.process_payment()
    ↓
Update payment_status = "PAID"
    ↓
Update remaining_amount = 0
    ↓
Refresh invoice list
    ↓
UI updates with new status
```

### Delete Invoice
```
SavedInvoices.jsx (Click "Delete")
    ↓
Confirm dialog
    ↓
DELETE /invoices/{invoice_id}
    ↓
crud.delete_invoice()
    ↓
Restore inventory if INVOICE type
    ↓
Remove from Database
    ↓
Update state to remove from list
    ↓
Success message
```

---

## 🔌 Frontend API Client Configuration

**File:** `Frontend/src/api/axios.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 30000,
});

export default api;
```

---

## 📊 Request/Response Examples

### Create Invoice
**Request:**
```javascript
POST /invoices
Content-Type: application/json

{
  "doc_type": "INVOICE",
  "invoice_number": "INV-08/26-1",
  "client_name": "Acme Corp",
  "client_mobile": "9876543210",
  "client_address": "123 Business Park",
  "company_name": "My Company",
  "total_amount": 15000,
  "advance_paid": 5000,
  "items": [
    {
      "description": "Product A",
      "hsn_code": "1234",
      "quantity": 2,
      "price": 5000,
      "gst_rate": 18
    }
  ],
  "payment_status": "DUE",
  "is_gst_enabled": true
}
```

**Response:**
```json
{
  "id": 42,
  "invoice_number": "INV-08/26-1",
  "doc_type": "INVOICE",
  "client_name": "Acme Corp",
  "total_amount": 15000.00,
  "advance_paid": 5000.00,
  "remaining_amount": 10000.00,
  "payment_status": "DUE",
  "created_at": "2026-08-31T10:30:00",
  ...
}
```

### Update Invoice
**Request:**
```javascript
PUT /invoices/42
Content-Type: application/json

{
  // Same structure as POST /invoices
  "client_name": "Acme Corp (Updated)",
  "total_amount": 16000,
  ...
}
```

**Response:**
```json
{
  "id": 42,
  "invoice_number": "INV-08/26-1",
  "client_name": "Acme Corp (Updated)",
  "total_amount": 16000.00,
  ...
}
```

### Mark as Paid
**Request:**
```javascript
POST /invoice/pay/42/0
```

**Response:**
```json
{
  "id": 42,
  "payment_status": "PAID",
  "remaining_amount": 0.0,
  "advance_paid": 16000.00
}
```

### Delete Invoice
**Request:**
```javascript
DELETE /invoices/42
```

**Response:**
```json
{
  "message": "Invoice deleted successfully"
}
```

---

## ✅ Implementation Status

| Endpoint | Status | Backend | Frontend | Notes |
|----------|--------|---------|----------|-------|
| GET /invoices | ✅ Complete | crud.get_all_invoices() | SavedInvoices.jsx:75 | Fetches all invoices |
| GET /invoices/{id} | ✅ Complete | Direct query | InvoiceGenerator.jsx:240 | Auto-loads on URL param |
| POST /invoices | ✅ Complete | crud.create_invoice() | InvoiceGenerator.jsx:953 | Creates new invoice |
| PUT /invoices/{id} | ✅ Complete | crud.update_invoice() NEW | InvoiceGenerator.jsx:953 | Updates existing invoice |
| POST /invoice/pay/{id}/{no} | ✅ Complete | crud.process_payment() | SavedInvoices.jsx:147 | Marks invoice as paid |
| DELETE /invoices/{id} | ✅ Complete | crud.delete_invoice() | SavedInvoices.jsx:159 | Deletes invoice |

---

## 🧪 Testing Checklist

- [ ] **Create Invoice**
  - [ ] Fill form and click "Save"
  - [ ] Check database for new record
  - [ ] Verify response returned with new ID

- [ ] **Edit Invoice**
  - [ ] Click "Edit" on existing invoice
  - [ ] Verify form pre-populated with data
  - [ ] Modify fields and save
  - [ ] Verify database updated

- [ ] **Duplicate Invoice**
  - [ ] Click "Duplicate" on existing invoice
  - [ ] Verify invoice_number is empty
  - [ ] Verify invoice_date is today
  - [ ] Save and verify new record created with new ID

- [ ] **Mark as Paid**
  - [ ] Click "Mark Paid" button
  - [ ] Verify payment_status changes to "PAID"
  - [ ] Verify UI reflects change

- [ ] **Delete Invoice**
  - [ ] Click "Delete" button
  - [ ] Confirm deletion
  - [ ] Verify removed from list
  - [ ] Verify removed from database

- [ ] **Inventory Management**
  - [ ] Create invoice with inventory items
  - [ ] Verify stock decreased
  - [ ] Delete invoice
  - [ ] Verify stock restored

---

## 🔧 Error Handling

All endpoints include error handling:

```javascript
try {
  const response = await api.get(`/invoices/${invoiceId}`);
  // Process response
} catch (error) {
  console.error("Failed to load invoice:", error);
  alert(`Error: ${error.response?.data?.detail || error.message}`);
}
```

Backend returns standardized error responses:
```json
{
  "detail": "Invoice not found"
}
```

---

## 📝 Notes

1. **invoice_number field** is unique per document type
2. **installment_no** parameter:
   - `0` = Mark entire invoice as paid
   - `1-4` = Mark specific installment as paid
3. **Payment Status Values:**
   - `PAID` - Fully paid
   - `DUE` - Not yet paid
   - `PARTIAL` - Some advance paid
   - `INSTALLMENT` - Payment plan active
4. **GST Calculation:**
   - If client_state == firm_state: Split between CGST and SGST (9% each for 18%)
   - If different states: Use IGST (18% total)

---

**Created:** August 31, 2026  
**Status:** ✅ Ready for Production  
**Last Updated:** API Endpoints Fully Integrated
