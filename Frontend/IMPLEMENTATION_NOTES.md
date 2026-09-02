# Invoice Management System - URL-Based Individual Invoice Implementation

## Overview
Updated the Invoice Management System to support individual URLs for every saved invoice using their `invoice_id` as URL parameter.

## Changes Made

### 1. **App.jsx** - Routing Configuration
Added new routes to support URL-based invoice access:
```javascript
<Route path="/invoice-generator" element={<InvoiceGenerator />} />
<Route path="/invoice-generator/:invoiceId" element={<InvoiceGenerator />} />
<Route path="/invoice-generator/:invoiceId/duplicate" element={<InvoiceGenerator />} />
```

**Benefits:**
- Direct URL access: `/invoice-generator/123` loads invoice with ID 123
- Duplicate mode: `/invoice-generator/123/duplicate` duplicates invoice 123
- Backward compatible with existing `/invoice` route

### 2. **InvoiceGenerator.jsx** - Enhanced Invoice Loading
Added comprehensive URL and API parameter handling:

#### New Imports:
```javascript
import { useNavigate, useParams, useLocation } from "react-router-dom";
```

#### New State Variables:
- `isLoading` - Loading state for API calls
- `loadError` - Error handling for failed API calls
- `editMode` - Tracks current mode ('edit', 'duplicate', or null for new)

#### New Hook:
- `useParams()` - Extracts `invoiceId` from URL
- `useLocation()` - Accesses location.pathname to detect duplicate mode

#### Key Features:
1. **URL-Based Invoice Loading** (Lines ~220-370)
   - Fetches invoice data via API: `GET /invoices/{invoiceId}`
   - Auto-detects duplicate mode from URL path
   - Populates form with invoice data
   - Handles date formatting and data normalization

2. **Dual Mode Support**
   - **Edit Mode**: Loads invoice as-is with original invoice number and dates
   - **Duplicate Mode**: Resets invoice number, dates, and advance payment for creating new invoice from template
   - **New Invoice**: Default mode when no invoiceId provided

3. **Error Handling**
   - Graceful error handling for API failures
   - User-friendly error messages displayed
   - Fallback to state-based loading if URL params unavailable

### 3. **SavedInvoices.jsx** - Updated Navigation
Modified navigation functions to use new URL structure:

#### Updated Functions:
```javascript
// Edit existing invoice
const openForEdit = (invoice) => {
  navigate(`/invoice-generator/${invoice.id}`, {
    state: { invoice: invoice.raw, mode: 'edit' },
  });
};

// Duplicate an invoice
const duplicateInvoice = (invoice) => {
  navigate(`/invoice-generator/${invoice.id}/duplicate`, {
    state: { invoice: invoice.raw, mode: 'duplicate' },
  });
};

// Create new invoice
const handleNewInvoice = () => {
  navigate('/invoice-generator', {
    state: { mode: 'create' },
  });
};
```

**Benefits:**
- Clean, RESTful URL structure
- Bookmarkable invoice URLs
- Shareable links to specific invoices
- Browser history support
- Maintains backward compatibility with state-based fallback

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/invoices` | GET | Fetch all invoices |
| `/invoices/{id}` | GET | Fetch specific invoice by ID |
| `/invoices` | POST | Create new invoice |
| `/invoices/{id}` | PUT | Update existing invoice |
| `/invoices/{id}` | DELETE | Delete invoice |
| `/inventory` | GET | Fetch inventory items |

## URL Structure

### Navigation Examples:
1. **New Invoice**: `/invoice-generator`
   - Creates blank invoice form

2. **Edit Invoice**: `/invoice-generator/42`
   - Loads invoice #42 for editing
   - Preserves original invoice number and dates

3. **Duplicate Invoice**: `/invoice-generator/42/duplicate`
   - Creates new invoice based on #42
   - Resets invoice number and dates for new billing

## Data Flow

### Loading an Invoice:
```
URL Parameter Detected
    ↓
Check if /duplicate in path
    ↓
Fetch from API: GET /invoices/{id}
    ↓
Format Data (dates, numbers, etc.)
    ↓
Populate Form State
    ↓
Display to User
```

### Handling Duplicates:
```
Invoice Loaded
    ↓
Reset: invoice_number = ""
Reset: invoice_date = today
Reset: advance_paid = 0
Reset: items[].id = null
    ↓
User sees form with pre-filled customer/item details
    ↓
Save as new invoice with new ID
```

## Backward Compatibility

The implementation maintains backward compatibility:
1. State-based navigation still works (fallback mechanism)
2. Old `/invoice` route still supported
3. Location state is used as fallback if URL params unavailable
4. Existing navigation flows unaffected

## Error Handling

- Network errors display user-friendly messages
- Failed invoice loads show error state
- API validation errors are formatted for display
- Graceful fallback to empty form if data unavailable

## Testing Checklist

- [ ] Create new invoice: `/invoice-generator`
- [ ] Edit existing invoice: `/invoice-generator/123`
- [ ] Duplicate invoice: `/invoice-generator/123/duplicate`
- [ ] Reload page with invoice URL - should auto-load data
- [ ] Share invoice URL - should work in new browser/tab
- [ ] Delete invoice - URL should redirect to invoice list
- [ ] Test with network offline - should show error
- [ ] Test browser back/forward navigation

## Future Enhancements

1. Add invoice PDF URL endpoint (e.g., `/invoices/123/pdf`)
2. Implement shareable read-only invoice URLs with tokens
3. Add invoice versioning and history tracking
4. Create invoice comparison view (`/invoice-generator/123/compare/456`)
5. Add batch operations on multiple invoices
6. Implement invoice templates system

## File Updates Summary

| File | Changes | Lines |
|------|---------|-------|
| `App.jsx` | Added 3 new routes | 1023-1040 |
| `InvoiceGenerator.jsx` | Added useParams, useLocation, invoice loading effect | 1-400+ |
| `SavedInvoices.jsx` | Updated navigation to use new URL structure | 177-192 |

---
**Updated**: August 31, 2026
**Status**: Ready for deployment
**Testing**: Recommended before production use
