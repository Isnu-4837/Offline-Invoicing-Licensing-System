import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://127.0.0.1:8000';
const PAGE_SIZE_OPTIONS = [10, 25, 50];

/* ------------------------------------------------------------------ */
/*  data shaping                                                       */
/* ------------------------------------------------------------------ */

function normalizeInvoice(raw) {
  const id = raw.id;
  const isQuotation = raw.doc_type === 'QUOTATION';

  const displayId =
    raw.invoice_number || `${isQuotation ? 'QUO' : 'INV'}-${String(id).padStart(4, '0')}`;

  const client = raw.client_name || 'Walk-in Customer';
  const totalAmount = Number(raw.total_amount ?? 0);
  const remainingAmount = Number(raw.remaining_amount ?? 0);

  const relevantDueDate =
    raw.payment_status === 'INSTALLMENT' ? raw.next_due_date || raw.due_date : raw.due_date;
  const isOverdue =
    raw.payment_status !== 'PAID' && relevantDueDate && new Date(relevantDueDate) < new Date();

  let status;
  if (raw.payment_status === 'PAID') status = 'Paid';
  else if (isOverdue) status = 'Overdue';
  else if (raw.payment_status === 'PARTIAL') status = 'Partial';
  else if (raw.payment_status === 'INSTALLMENT') status = 'Installment';
  else status = 'Pending';

  return {
    id,
    displayId,
    docType: isQuotation ? 'Quotation' : 'Invoice',
    client,
    mobile: raw.client_mobile || '',
    amount: totalAmount,
    remainingAmount,
    paymentMode: raw.payment_mode || 'FULL',
    status,
    date: raw.created_at || null,
    raw,
  };
}

const statusMeta = {
  Paid: { color: '#34e8a8', glow: 'rgba(52, 232, 168, 0.45)', bg: 'rgba(52, 232, 168, 0.1)' },
  Pending: { color: '#60a5fa', glow: 'rgba(96, 165, 250, 0.45)', bg: 'rgba(96, 165, 250, 0.1)' },
  Partial: { color: '#ffc857', glow: 'rgba(255, 200, 87, 0.45)', bg: 'rgba(255, 200, 87, 0.1)' },
  Installment: { color: '#9d7dff', glow: 'rgba(157, 125, 255, 0.45)', bg: 'rgba(157, 125, 255, 0.1)' },
  Overdue: { color: '#ff5d8f', glow: 'rgba(255, 93, 143, 0.45)', bg: 'rgba(255, 93, 143, 0.1)' },
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function highlightMatch(text, term) {
  const str = String(text ?? '');
  if (!term) return str;
  const idx = str.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return str;
  return (
    <>
      {str.slice(0, idx)}
      <mark>{str.slice(idx, idx + term.length)}</mark>
      {str.slice(idx + term.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  small reusable hooks                                               */
/* ------------------------------------------------------------------ */

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function usePersistentState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [key, state]);
  return [state, setState];
}

function useCountUp(target, duration = 550) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

let toastSeq = 0;

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++toastSeq;
      const duration = toast.duration ?? 4500;
      setToasts((prev) => [...prev, { id, ...toast }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

/* ------------------------------------------------------------------ */
/*  presentational subcomponents                                       */
/* ------------------------------------------------------------------ */

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="si-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`si-toast si-toast--${t.tone || 'default'}`}>
          <span>{t.message}</span>
          <div className="si-toast-actions">
            {t.action && (
              <button
                className="si-toast-action"
                onClick={() => {
                  t.action.onClick();
                  onDismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="si-toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="si-modal-overlay" onClick={onCancel}>
      <div className="si-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="si-modal-actions">
          <button className="si-btn-action si-btn-export" onClick={onCancel}>Cancel</button>
          <button className="si-btn-action si-btn-danger-solid" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, currency, accent }) {
  const animated = useCountUp(value);
  const display = currency ? formatCurrency(Math.round(animated)) : Math.round(animated);
  return (
    <div className={`si-stat${accent ? ' si-stat--accent' : ''}`} style={color ? { '--stat-color': color } : undefined}>
      <p className="si-stat-label">{label}</p>
      <p className="si-stat-value" style={color ? { color } : undefined}>{display}</p>
    </div>
  );
}

function InvoiceRow({
  invoice,
  meta,
  selected,
  expanded,
  searchTerm,
  animationDelay,
  onToggleSelect,
  onToggleExpand,
  onOpen,
  onMarkPaid,
  onDuplicate,
  onDelete,
  onCopyId,
}) {
  const handleRowClick = (e) => {
    if (e.target.closest('button') || e.target.closest('label')) return;
    onOpen(invoice);
  };
  const handleRowKeyDown = (e) => {
    if (e.target.closest('button') || e.target.closest('label')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(invoice);
    }
  };

  return (
    <div className="si-row-anim" style={{ animationDelay: `${animationDelay}ms` }}>
      <div className={`si-row-wrap${expanded ? ' si-row-wrap--expanded' : ''}`}>
        <div
          className="si-row"
          style={{ '--row-color': meta.color }}
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={handleRowKeyDown}
          title="Click to open in Invoice Generator"
        >
          <label className="si-check" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(invoice.id)}
              aria-label={`Select ${invoice.displayId}`}
            />
          </label>
          <span className="si-id">{highlightMatch(invoice.displayId, searchTerm)}</span>
          <span className="si-client">{highlightMatch(invoice.client, searchTerm)}</span>
          <span className="si-amount">{formatCurrency(invoice.amount)}</span>
          <span
            className="si-status"
            style={{ color: meta.color, background: meta.bg, boxShadow: `0 0 14px ${meta.glow}` }}
          >
            <span className="dot" style={{ background: meta.color }} />
            {invoice.status}
          </span>
          <span className="si-date">{formatDate(invoice.date)}</span>
          <div className="si-actions">
            <button
              onClick={() => onToggleExpand(invoice.id)}
              className="si-btn si-btn-ghost"
              aria-expanded={expanded}
            >
              {expanded ? '▲ Less' : '▼ More'}
            </button>
            <button onClick={() => onOpen(invoice)} className="si-btn si-btn-edit">✎ Edit</button>
            {invoice.status !== 'Paid' && (
              <button onClick={() => onMarkPaid(invoice)} className="si-btn si-btn-primary">Mark Paid</button>
            )}
            <button onClick={() => onDuplicate(invoice)} className="si-btn si-btn-ghost">Duplicate</button>
            <button onClick={() => onDelete(invoice)} className="si-btn si-btn-danger">Delete</button>
          </div>
        </div>

        {expanded && (
          <div className="si-row-detail fade-in-fast">
            <div><span>Document type</span><strong>{invoice.docType}</strong></div>
            <div><span>Payment mode</span><strong>{invoice.paymentMode}</strong></div>
            <div><span>Remaining</span><strong>{formatCurrency(invoice.remainingAmount)}</strong></div>
            <div>
              <span>Mobile</span>
              <strong>{invoice.mobile ? <a href={`tel:${invoice.mobile}`}>{invoice.mobile}</a> : '—'}</strong>
            </div>
            <button className="si-btn si-btn-ghost si-copy-btn" onClick={() => onCopyId(invoice)}>⧉ Copy ID</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  main component                                                     */
/* ------------------------------------------------------------------ */

export default function SavedInvoices() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // ---- data ----
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- search / filter / sort ----
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 200);

  const [filterStatus, setFilterStatus] = usePersistentState('si_filterStatus', 'All');
  const [filterDocType, setFilterDocType] = usePersistentState('si_filterDocType', 'All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sortBy, setSortBy] = usePersistentState('si_sortBy', 'date');
  const [sortDir, setSortDir] = usePersistentState('si_sortDir', 'desc');

  // ---- display prefs ----
  const [density, setDensity] = usePersistentState('si_density', 'comfortable');
  const [pageSize, setPageSize] = usePersistentState('si_pageSize', 10);
  const [page, setPage] = useState(1);

  // ---- selection / expansion / dialogs ----
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // ---- fetching ----
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/invoices`);
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      const data = await response.json();
      setInvoices((Array.isArray(data) ? data : []).map(normalizeInvoice));
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError(`Could not reach the database at ${API_BASE}. Make sure backend is running.`);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterDocType, dateFrom, dateTo, amountMin, amountMax, sortBy, sortDir, pageSize]);

  // ---- derived: filter ----
  const filteredInvoices = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const min = amountMin !== '' ? Number(amountMin) : null;
    const max = amountMax !== '' ? Number(amountMax) : null;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return invoices.filter((inv) => {
      const matchesSearch =
        !term ||
        inv.client.toLowerCase().includes(term) ||
        String(inv.displayId).toLowerCase().includes(term);
      const matchesStatus = filterStatus === 'All' || inv.status === filterStatus;
      const matchesDocType = filterDocType === 'All' || inv.docType === filterDocType;
      const matchesMin = min === null || inv.amount >= min;
      const matchesMax = max === null || inv.amount <= max;
      const invDate = inv.date ? new Date(inv.date) : null;
      const matchesFrom = !from || (invDate && invDate >= from);
      const matchesTo = !to || (invDate && invDate <= to);
      return (
        matchesSearch && matchesStatus && matchesDocType && matchesMin && matchesMax && matchesFrom && matchesTo
      );
    });
  }, [invoices, debouncedSearch, filterStatus, filterDocType, amountMin, amountMax, dateFrom, dateTo]);

  // ---- derived: sort ----
  const sortedInvoices = useMemo(() => {
    if (!sortBy) return filteredInvoices;
    const sorted = [...filteredInvoices].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (sortBy === 'date') return new Date(valA || 0) - new Date(valB || 0);
      if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
      return String(valA || '').localeCompare(String(valB || ''));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [filteredInvoices, sortBy, sortDir]);

  // ---- derived: paginate ----
  const pageCount = Math.max(1, Math.ceil(sortedInvoices.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPage, pageSize]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };
  const sortIndicator = (key) => (sortBy !== key ? '' : sortDir === 'asc' ? '↑' : '↓');

  const totalOutstanding = useMemo(
    () =>
      filteredInvoices.filter((inv) => inv.status !== 'Paid').reduce((sum, inv) => sum + inv.remainingAmount, 0),
    [filteredInvoices]
  );

  const statusCounts = useMemo(
    () =>
      invoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      }, {}),
    [invoices]
  );

  const activeFilterCount = [
    filterStatus !== 'All',
    filterDocType !== 'All',
    Boolean(dateFrom),
    Boolean(dateTo),
    amountMin !== '',
    amountMax !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus('All');
    setFilterDocType('All');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
  };

  // ---- selection ----
  const allOnPageSelected = pagedInvoices.length > 0 && pagedInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pagedInvoices.forEach((inv) => next.delete(inv.id));
      else pagedInvoices.forEach((inv) => next.add(inv.id));
      return next;
    });
  };
  const selectAllFiltered = () => setSelectedIds(new Set(filteredInvoices.map((inv) => inv.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  // ---- actions ----
  const markPaid = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE}/invoice/pay/${invoice.id}/0`, { method: 'POST' });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      await fetchInvoices();
      pushToast({ message: `${invoice.displayId} marked as paid.`, tone: 'success' });
    } catch (err) {
      console.error('Failed to mark invoice as paid:', err);
      pushToast({ message: 'Could not update payment status. Please try again.', tone: 'error' });
    }
  };

  const markSelectedPaid = async () => {
    const targets = invoices.filter((inv) => selectedIds.has(inv.id) && inv.status !== 'Paid');
    if (!targets.length) return;
    try {
      await Promise.all(targets.map((inv) => fetch(`${API_BASE}/invoice/pay/${inv.id}/0`, { method: 'POST' })));
      await fetchInvoices();
      pushToast({ message: `${targets.length} invoice${targets.length === 1 ? '' : 's'} marked as paid.`, tone: 'success' });
      clearSelection();
    } catch (err) {
      console.error('Bulk mark paid failed:', err);
      pushToast({ message: 'Some invoices could not be updated.', tone: 'error' });
    }
  };

  const performDelete = async (ids) => {
    const previous = invoices;
    setInvoices((prev) => prev.filter((inv) => !ids.includes(inv.id)));
    try {
      await Promise.all(ids.map((id) => fetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE' })));
    } catch (err) {
      console.error('Failed to delete invoice(s):', err);
      setInvoices(previous);
      pushToast({ message: 'Failed to delete from the database.', tone: 'error' });
    }
  };

  const requestDelete = (invoice) => setConfirmState({ type: 'single', invoice });
  const requestBulkDelete = () => setConfirmState({ type: 'bulk', ids: Array.from(selectedIds) });

  const confirmDelete = () => {
    if (!confirmState) return;
    if (confirmState.type === 'single') {
      const invoice = confirmState.invoice;
      performDelete([invoice.id]);
      pushToast({
        message: `${invoice.displayId} deleted.`,
        action: { label: 'Undo', onClick: () => setInvoices((prev) => [invoice, ...prev]) },
      });
    } else {
      const ids = confirmState.ids;
      const snapshot = invoices.filter((inv) => ids.includes(inv.id));
      performDelete(ids);
      clearSelection();
      pushToast({
        message: `${ids.length} invoice${ids.length === 1 ? '' : 's'} deleted.`,
        action: { label: 'Undo', onClick: () => setInvoices((prev) => [...snapshot, ...prev]) },
      });
    }
    setConfirmState(null);
  };

  const openForEdit = useCallback(
    (invoice) => {
      navigate(`/invoice-generator/${invoice.id}`, { state: { invoice: invoice.raw, mode: 'edit' } });
    },
    [navigate]
  );

  const duplicateInvoice = useCallback(
    (invoice) => {
      navigate(`/invoice-generator/${invoice.id}/duplicate`, { state: { invoice: invoice.raw, mode: 'duplicate' } });
    },
    [navigate]
  );

  const handleNewInvoice = useCallback(() => {
    navigate('/invoice-generator', { state: { mode: 'create' } });
  }, [navigate]);

  const copyInvoiceId = async (invoice) => {
    try {
      await navigator.clipboard.writeText(invoice.displayId);
      pushToast({ message: `Copied ${invoice.displayId} to clipboard.`, tone: 'success', duration: 2200 });
    } catch {
      pushToast({ message: 'Could not copy to clipboard.', tone: 'error' });
    }
  };

  const exportCsv = (list = filteredInvoices, filenameHint = 'invoices') => {
    const header = ['Invoice No', 'Type', 'Client', 'Mobile', 'Amount', 'Remaining', 'Status', 'Date'];
    const rows = list.map((inv) => [
      inv.displayId,
      inv.docType,
      inv.client,
      inv.mobile,
      inv.amount,
      inv.remainingAmount,
      inv.status,
      formatDate(inv.date),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenameHint}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSelected = () => exportCsv(invoices.filter((inv) => selectedIds.has(inv.id)), 'invoices-selected');

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n' && !typing) {
        handleNewInvoice();
      } else if (e.key === 'Escape') {
        setFiltersOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewInvoice]);

  return (
    <div className="si-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        /* ---- global reset: kills the default browser/body margin & white
           gutter that shows around the themed background ---- */
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          background: #0a0b10;
        }
        *, *::before, *::after { box-sizing: border-box; }

        .si-root {
          --bg: #0a0b10;
          --cyan: #22e2ee;
          --violet: #9d7dff;
          --pink: #ff5d8f;
          --text: #eef2ff;
          --text-dim: #a5b4fc;
          --text-faint: #6366f1;
          --border: rgba(99, 102, 241, 0.2);
          --glass: rgba(15, 17, 30, 0.7);
          --radius: 14px;

          position: relative;
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 40px 20px 80px;
          font-family: 'Inter', sans-serif;
          color: var(--text);
          background:
            radial-gradient(ellipse 900px 500px at 15% -10%, rgba(34, 226, 238, 0.09), transparent),
            radial-gradient(ellipse 800px 550px at 100% 10%, rgba(157, 125, 255, 0.09), transparent),
            radial-gradient(ellipse 700px 500px at 50% 100%, rgba(255, 93, 143, 0.05), transparent),
            var(--bg);
          overflow-x: hidden;
        }

        /* faint drifting grid for depth, sits behind everything */
        .si-root::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.35;
          background-image:
            linear-gradient(rgba(99, 102, 241, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.06) 1px, transparent 1px);
          background-size: 42px 42px;
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 90%);
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 90%);
        }

        /* themed scrollbar so no stray light-grey OS chrome shows through */
        .si-root { scrollbar-color: rgba(99, 102, 241, 0.45) transparent; scrollbar-width: thin; }
        .si-root ::-webkit-scrollbar { width: 10px; height: 10px; }
        .si-root ::-webkit-scrollbar-track { background: transparent; }
        .si-root ::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.35);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .si-root ::-webkit-scrollbar-thumb:hover { background: rgba(34, 226, 238, 0.5); background-clip: padding-box; }

        .si-inner { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        .fade-in { animation: fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-fast { animation: slideDown 0.25s cubic-bezier(0.16,1,0.3,1) both; }
        .si-row-anim { animation: fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .fade-in-fast, .si-row-anim, .si-stat-value { animation: none !important; }
        }

        .si-back {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-dim);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 7px 14px;
          cursor: pointer;
          margin-bottom: 22px;
          transition: 0.2s ease;
        }
        .si-back:hover { color: var(--text); border-color: var(--cyan); }

        .si-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }
        .si-header h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
          background: linear-gradient(135deg, var(--text) 30%, var(--cyan) 75%, var(--violet) 110%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .si-header p {
          margin: 0;
          font-size: 13.5px;
          color: var(--text-faint);
          font-family: 'JetBrains Mono', monospace;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .si-header p::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cyan);
          box-shadow: 0 0 8px rgba(34, 226, 238, 0.8);
          animation: pulseDot 1.8s ease-in-out infinite;
        }
        .si-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .si-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius);
          border: 1px solid rgba(255, 93, 143, 0.35);
          background: rgba(255, 93, 143, 0.08);
          color: #ff9fb8;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .si-error button {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: #ff5d8f;
          background: rgba(255, 93, 143, 0.12);
          border: 1px solid rgba(255, 93, 143, 0.4);
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .si-error button:hover { background: #ff5d8f; color: #2b0512; }

        .si-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }
        .si-stat {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--glass);
          backdrop-filter: blur(10px);
          padding: 16px 18px;
          transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.22s ease, box-shadow 0.22s ease;
        }
        .si-stat::after {
          content: '';
          position: absolute;
          top: -40%;
          right: -30%;
          width: 90px;
          height: 90px;
          background: radial-gradient(circle, var(--stat-color, var(--cyan)) 0%, transparent 70%);
          opacity: 0.16;
          pointer-events: none;
          transition: opacity 0.22s ease;
        }
        .si-stat:hover {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,0.22);
          box-shadow: 0 10px 26px rgba(0,0,0,0.35);
        }
        .si-stat:hover::after { opacity: 0.28; }
        .si-stat-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-faint);
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .si-stat-value {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 23px;
          font-weight: 700;
          margin: 0;
          font-variant-numeric: tabular-nums;
          position: relative;
        }
        .si-stat--accent { border-color: rgba(34, 226, 238, 0.35); }
        .si-stat--accent .si-stat-value { color: var(--cyan); }

        .si-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .si-search-wrap { flex: 1 1 220px; }
        .si-input, .si-select {
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          color: var(--text);
          background: var(--glass);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          outline: none;
          transition: 0.2s ease;
        }
        .si-input { width: 100%; }
        .si-input:focus, .si-select:focus { border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(34,226,238,0.12); }
        .si-select { cursor: pointer; }
        mark { background: rgba(34, 226, 238, 0.28); color: inherit; border-radius: 3px; padding: 0 1px; }

        .si-btn-action {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.2s ease;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-dim);
        }
        .si-btn-export:hover { border-color: var(--violet); color: var(--violet); }
        .si-btn-filter--active { border-color: var(--cyan); color: var(--cyan); background: rgba(34,226,238,0.08); }
        .si-btn-filter:hover { border-color: var(--cyan); color: var(--cyan); }
        .si-btn-new {
          border: 1px solid transparent;
          background: linear-gradient(135deg, var(--cyan), var(--violet));
          color: #05070f;
          box-shadow: 0 4px 18px rgba(34, 226, 238, 0.25);
        }
        .si-btn-new:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 22px rgba(34, 226, 238, 0.4); }
        .si-btn-new kbd {
          margin-left: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          background: rgba(5,7,15,0.25);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .si-btn-danger-solid {
          border: 1px solid transparent;
          background: #ff5d8f;
          color: #2b0512;
        }
        .si-btn-danger-solid:hover { filter: brightness(1.08); }

        .si-density-toggle {
          display: flex;
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }
        .si-density-toggle button {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 600;
          padding: 9px 12px;
          border: none;
          background: transparent;
          color: var(--text-faint);
          cursor: pointer;
          transition: 0.15s ease;
        }
        .si-density-toggle button.active { background: rgba(34,226,238,0.12); color: var(--cyan); }

        .si-filter-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          align-items: flex-end;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--glass);
          padding: 16px;
          margin-bottom: 16px;
        }
        .si-filter-field { display: flex; flex-direction: column; gap: 5px; }
        .si-filter-field label { font-size: 11px; font-weight: 600; color: var(--text-faint); }
        .si-filter-field input, .si-filter-field select {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--text);
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          outline: none;
          width: 140px;
        }
        .si-filter-field input:focus, .si-filter-field select:focus { border-color: var(--cyan); }
        .si-filter-clear {
          margin-left: auto;
        }
        .si-filter-clear:disabled { opacity: 0.4; cursor: not-allowed; }

        .si-bulk-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          border-radius: var(--radius);
          border: 1px solid rgba(34, 226, 238, 0.35);
          background: rgba(34, 226, 238, 0.06);
          padding: 12px 16px;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 600;
          color: var(--cyan);
        }
        .si-bulk-bar > button { font: inherit; color: var(--text-dim); background: none; border: none; cursor: pointer; text-decoration: underline; }
        .si-bulk-actions { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }

        .si-col-headers { display: none; }
        @media (min-width: 820px) {
          .si-col-headers {
            display: grid;
            grid-template-columns: 26px 100px 1.6fr 110px 100px 110px 240px;
            gap: 12px;
            align-items: center;
            padding: 0 18px 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.04em;
            color: var(--text-faint);
          }
          .si-col-headers button {
            background: none;
            border: none;
            color: inherit;
            font: inherit;
            cursor: pointer;
            text-align: left;
            padding: 0;
          }
          .si-col-headers button:hover { color: var(--text); }
        }

        .si-check input {
          width: 15px;
          height: 15px;
          accent-color: var(--cyan);
          cursor: pointer;
        }

        .si-list { display: flex; flex-direction: column; gap: 8px; }

        .si-row-wrap { border-radius: var(--radius); }
        .si-row-wrap--expanded .si-row { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }

        .si-row {
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 6px 12px;
          align-items: center;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          border-left: 3px solid var(--row-color, var(--border));
          background: var(--glass);
          padding: 14px 16px;
          cursor: pointer;
          transition: 0.18s ease;
        }
        .si-row:hover {
          border-color: rgba(255,255,255,0.28);
          background: rgba(20,22,38,0.85);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3), inset 3px 0 0 var(--row-color, var(--border));
        }
        .si-row:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

        @media (min-width: 820px) {
          .si-row { grid-template-columns: 20px 100px 1.6fr 110px 100px 110px 240px; gap: 12px; }
        }

        .si-list--compact .si-row { padding: 9px 16px; }

        .si-id { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--text-dim); }
        .si-client { font-weight: 600; font-size: 14.5px; }
        .si-amount { font-family: 'JetBrains Mono', monospace; font-size: 13.5px; }
        .si-date { font-size: 12.5px; color: var(--text-dim); }

        .si-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 700;
          width: fit-content;
        }
        .si-status .dot { width: 6px; height: 6px; border-radius: 50%; animation: pulseDot 1.8s ease-in-out infinite; }

        .si-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-start; margin-top: 2px; }
        @media (min-width: 820px) { .si-actions { justify-content: flex-end; margin-top: 0; } }

        .si-btn {
          font-family: 'Inter', sans-serif;
          font-size: 11.5px;
          font-weight: 700;
          padding: 7px 11px;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s ease;
          white-space: nowrap;
        }
        .si-btn-primary { border: 1px solid rgba(52, 232, 168, 0.4); background: rgba(52, 232, 168, 0.12); color: #34e8a8; }
        .si-btn-primary:hover { background: #34e8a8; color: #04150e; }
        .si-btn-edit { border: 1px solid rgba(34, 226, 238, 0.35); background: rgba(34, 226, 238, 0.08); color: var(--cyan); }
        .si-btn-edit:hover { background: var(--cyan); color: #032025; }
        .si-btn-ghost { border: 1px solid var(--border); background: transparent; color: var(--violet); }
        .si-btn-ghost:hover { background: rgba(157, 125, 255, 0.12); border-color: var(--violet); }
        .si-btn-danger { border: 1px solid rgba(255, 93, 143, 0.35); background: rgba(255, 93, 143, 0.08); color: #ff5d8f; }
        .si-btn-danger:hover { background: #ff5d8f; color: #2b0512; }

        .si-row-detail {
          display: flex;
          flex-wrap: wrap;
          gap: 18px 28px;
          align-items: center;
          border: 1px solid var(--border);
          border-top: none;
          border-bottom-left-radius: var(--radius);
          border-bottom-right-radius: var(--radius);
          background: rgba(10, 11, 18, 0.5);
          padding: 12px 20px 14px;
          font-size: 12.5px;
        }
        .si-row-detail div { display: flex; flex-direction: column; gap: 2px; }
        .si-row-detail span { color: var(--text-faint); font-size: 11px; }
        .si-row-detail strong { font-weight: 600; }
        .si-row-detail a { color: var(--cyan); }
        .si-copy-btn { margin-left: auto; }

        .si-empty, .si-loading {
          text-align: center;
          padding: 56px 20px;
          border-radius: var(--radius);
          background: var(--glass);
          border: 1px dashed var(--border);
        }
        .si-loading .spinner {
          display: inline-block; width: 28px; height: 28px;
          border: 3px solid rgba(34, 226, 238, 0.2);
          border-top-color: var(--cyan);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
          margin-bottom: 12px;
        }
        .si-empty .icon { font-size: 24px; margin-bottom: 10px; opacity: 0.7; }
        .si-empty p, .si-loading p { margin: 0; color: var(--text-dim); font-size: 13.5px; }
        .si-empty span { display: block; color: var(--text-faint); font-size: 12px; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

        .si-skeleton-row {
          height: 54px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 37%, rgba(255,255,255,0.03) 63%);
          background-size: 400px 100%;
          animation: shimmer 1.4s linear infinite, fadeIn 0.3s ease both;
          margin-bottom: 8px;
        }

        .si-toast-stack {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 60;
          max-width: 320px;
        }
        .si-toast {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(15, 17, 30, 0.95);
          backdrop-filter: blur(6px);
          padding: 12px 14px;
          font-size: 13px;
          color: var(--text);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          animation: toastIn 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
        .si-toast--success { border-color: rgba(52, 232, 168, 0.4); }
        .si-toast--error { border-color: rgba(255, 93, 143, 0.4); }
        .si-toast-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .si-toast-action {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: var(--cyan);
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
        }
        .si-toast-close { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; }
        .si-toast-close:hover { color: var(--text); }

        .si-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(5, 6, 12, 0.65);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 70;
          padding: 20px;
        }
        .si-modal {
          width: 100%;
          max-width: 380px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: #0f111e;
          padding: 22px;
          animation: popIn 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        .si-modal h3 { margin: 0 0 8px; font-family: 'Space Grotesk', sans-serif; font-size: 17px; }
        .si-modal p { margin: 0 0 18px; font-size: 13px; color: var(--text-dim); line-height: 1.5; }
        .si-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

        .si-pagination {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          font-size: 12.5px;
          color: var(--text-dim);
        }
        .si-page-size { display: flex; align-items: center; gap: 8px; }
        .si-page-size select {
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          color: var(--text);
          background: var(--glass);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 6px 8px;
        }
        .si-page-controls { display: flex; align-items: center; gap: 12px; }
        .si-page-controls button {
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-dim);
          background: var(--glass);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          transition: 0.15s ease;
        }
        .si-page-controls button:hover:not(:disabled) { border-color: var(--cyan); color: var(--cyan); }
        .si-page-controls button:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDialog
        open={!!confirmState}
        title={
          confirmState?.type === 'bulk'
            ? `Delete ${confirmState.ids.length} invoices?`
            : `Delete ${confirmState?.invoice?.displayId}?`
        }
        message="This removes the record from the database. You'll get a short window to undo right after."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />

      <div className="si-inner">
        <button className="si-back" onClick={() => navigate(-1)}>← Back</button>

        <div className="si-header fade-in">
          <div>
            <h1>Saved Invoices</h1>
            <p>{invoices.length} record{invoices.length === 1 ? '' : 's'} in the billing register</p>
          </div>
          <div className="si-header-actions">
            <button className="si-btn-action si-btn-export" onClick={() => exportCsv()} disabled={!filteredInvoices.length}>
              ⬇ Export CSV
            </button>
            <button className="si-btn-action si-btn-new" onClick={handleNewInvoice}>
              + New Invoice<kbd>N</kbd>
            </button>
          </div>
        </div>

        {error && (
          <div className="si-error fade-in">
            <span>{error}</span>
            <button onClick={fetchInvoices}>Retry</button>
          </div>
        )}

        <div className="si-stats fade-in">
          <StatCard label="Outstanding" value={totalOutstanding} currency accent color="var(--cyan)" />
          {Object.keys(statusMeta).map((status) => (
            <StatCard key={status} label={status} value={statusCounts[status] || 0} color={statusMeta[status].color} />
          ))}
        </div>

        <div className="si-toolbar fade-in">
          <div className="si-search-wrap">
            <input
              ref={searchInputRef}
              type="text"
              className="si-input"
              placeholder="Search client or invoice ID... (press /)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="si-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All statuses</option>
            {Object.keys(statusMeta).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className={`si-btn-action si-btn-filter${activeFilterCount ? ' si-btn-filter--active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            ⚙ Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
          <div className="si-density-toggle" role="group" aria-label="Row density">
            <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>Comfortable</button>
            <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>Compact</button>
          </div>
        </div>

        {filtersOpen && (
          <div className="si-filter-panel fade-in-fast">
            <div className="si-filter-field">
              <label>Document type</label>
              <select value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}>
                <option value="All">All</option>
                <option value="Invoice">Invoice</option>
                <option value="Quotation">Quotation</option>
              </select>
            </div>
            <div className="si-filter-field">
              <label>Date from</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="si-filter-field">
              <label>Date to</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="si-filter-field">
              <label>Min amount</label>
              <input type="number" placeholder="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
            </div>
            <div className="si-filter-field">
              <label>Max amount</label>
              <input type="number" placeholder="Any" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
            </div>
            <button className="si-btn si-btn-ghost si-filter-clear" onClick={clearFilters} disabled={!activeFilterCount}>
              Clear filters
            </button>
          </div>
        )}

        {someSelected && (
          <div className="si-bulk-bar fade-in-fast">
            <span>{selectedIds.size} selected</span>
            {selectedIds.size < filteredInvoices.length && (
              <button onClick={selectAllFiltered}>Select all {filteredInvoices.length} matching</button>
            )}
            <div className="si-bulk-actions">
              <button className="si-btn si-btn-primary" onClick={markSelectedPaid}>Mark Paid</button>
              <button className="si-btn si-btn-ghost" onClick={exportSelected}>Export</button>
              <button className="si-btn si-btn-danger" onClick={requestBulkDelete}>Delete</button>
              <button className="si-btn si-btn-ghost" onClick={clearSelection}>Clear</button>
            </div>
          </div>
        )}

        <div className="si-col-headers">
          <label className="si-check">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectPage} aria-label="Select all on page" />
          </label>
          <button onClick={() => handleSort('displayId')}>ID {sortIndicator('displayId')}</button>
          <button onClick={() => handleSort('client')}>Client {sortIndicator('client')}</button>
          <button onClick={() => handleSort('amount')}>Amount {sortIndicator('amount')}</button>
          <span>Status</span>
          <button onClick={() => handleSort('date')}>Date {sortIndicator('date')}</button>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        <div className={`si-list si-list--${density} fade-in`}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="si-skeleton-row" style={{ animationDelay: `${i * 60}ms` }} />
            ))
          ) : (
            pagedInvoices.map((inv, i) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                meta={statusMeta[inv.status] || statusMeta.Pending}
                selected={selectedIds.has(inv.id)}
                expanded={expandedId === inv.id}
                searchTerm={debouncedSearch}
                animationDelay={Math.min(i, 8) * 35}
                onToggleSelect={toggleSelect}
                onToggleExpand={toggleExpand}
                onOpen={openForEdit}
                onMarkPaid={markPaid}
                onDuplicate={duplicateInvoice}
                onDelete={requestDelete}
                onCopyId={copyInvoiceId}
              />
            ))
          )}

          {!loading && sortedInvoices.length === 0 && (
            <div className="si-empty">
              <div className="icon">🛰️</div>
              <p>{invoices.length === 0 ? 'No invoices found in the database.' : 'No invoices match your search.'}</p>
              <span>
                {invoices.length === 0
                  ? 'Create your first invoice to see it here.'
                  : 'Try clearing the search or switching the status filter.'}
              </span>
            </div>
          )}
        </div>

        {!loading && sortedInvoices.length > 0 && (
          <div className="si-pagination fade-in-fast">
            <div className="si-page-size">
              <label>Rows per page</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="si-page-controls">
              <button disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
              <span>Page {currentPage} of {pageCount}</span>
              <button disabled={currentPage >= pageCount} onClick={() => setPage((p) => p + 1)}>Next ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}