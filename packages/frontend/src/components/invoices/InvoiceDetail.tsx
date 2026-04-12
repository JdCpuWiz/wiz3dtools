import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSalesInvoice, useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import { LineItemRow } from './LineItemRow';
import { salesInvoiceApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import { useColors } from '../../hooks/useColors';
import { ColorPicker, ColorSwatch } from '../common/ColorPicker';
import type { CreateLineItemDto, SalesInvoiceStatus, ItemColorDto } from '@wizqueue/shared';

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

const ShippingEdit: React.FC<{ value: number; onSave: (v: number) => void; inputSt: React.CSSProperties }> = ({ value, onSave, inputSt }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-iron-400">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={draft}
          onChange={(e) => setDraft(parseFloat(e.target.value) || 0)}
          className="w-20 px-2 py-0.5 rounded text-iron-50 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
          style={inputSt}
          autoFocus
        />
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="text-xs text-primary-400 hover:text-primary-300"
        >✓</button>
        <button
          onClick={() => { setDraft(value); setEditing(false); }}
          className="text-xs text-iron-500 hover:text-iron-300"
        >✕</button>
      </div>
    );
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="font-medium text-iron-50 hover:text-primary-400 transition-colors"
    >
      ${value.toFixed(2)}
    </button>
  );
};

export const InvoiceDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || '0');

  const { csrfToken } = useAuth();
  const { invoice, isLoading, addLineItem, updateLineItem, deleteLineItem, updateLineItemColors } = useSalesInvoice(invoiceId);
  const { sendEmail, sendToQueue, update, ship, isSending, isShipping } = useSalesInvoices();
  const { customers } = useCustomers();
  const { products } = useProducts(true);
  const { colors: availableColors } = useColors();

  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [carrierDraft, setCarrierDraft] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newItem, setNewItem] = useState<CreateLineItemDto>({ productName: '', quantity: 1, unitPrice: 0 });
  const [newItemColors, setNewItemColors] = useState<ItemColorDto[]>([]);
  const [showAddColors, setShowAddColors] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }
  if (!invoice) {
    return <div className="text-center py-16 text-iron-400">Invoice not found</div>;
  }

  const isShipped = !!invoice.shippedAt;
  const subtotal = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = invoice.taxExempt ? 0 : subtotal * invoice.taxRate;
  const total = subtotal + (invoice.shippingCost || 0) + taxAmount;

  // Shipment weight: sum of (color weightGrams × quantity) per line item
  const totalWeightGrams = invoice.lineItems.reduce((sum, li) => {
    const itemGrams = (li.colors || []).reduce((s, c) => s + (c.weightGrams || 0), 0);
    return sum + itemGrams * li.quantity;
  }, 0);
  const totalWeightOz = totalWeightGrams * 0.035274;

  const confirmIfPaid = () => {
    if (isShipped) { window.alert('This invoice has been shipped and cannot be modified.'); return false; }
    if (invoice.status !== 'paid') return true;
    return window.confirm('This invoice is marked as Paid. Are you sure you want to make changes?');
  };

  const applyProduct = (productId: number) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setNewItem({ productId: p.id, productName: p.name, sku: p.sku || undefined, unitPrice: p.unitPrice, details: p.description || '', quantity: newItem.quantity });
    const autoColors = [...(p.colors || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pc, idx) => ({ colorId: pc.colorId, isPrimary: idx === 0, note: null, sortOrder: idx }));
    setNewItemColors(autoColors);
  };

  const handleAddItem = async () => {
    if (!newItem.productName.trim()) return;
    if (!confirmIfPaid()) return;
    const created = await addLineItem(newItem);
    if (newItemColors.length > 0) {
      await updateLineItemColors(created.id, newItemColors);
    }
    setNewItem({ productName: '', quantity: 1, unitPrice: 0 });
    setNewItemColors([]);
    setShowAddColors(false);
    setShowAddRow(false);
  };

  const selectClass = 'w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const cellInputClass = 'w-full px-2 py-1.5 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-start gap-4 flex-wrap">
        <button onClick={() => navigate('/invoices')} className="text-sm text-iron-400 hover:text-iron-50 transition-colors pt-1">← Back</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-iron-50">{invoice.invoiceNumber}</h2>
            <StatusBadge status={isShipped ? 'shipped' : invoice.status} />
          </div>
          <p className="text-xs text-iron-400 mt-0.5">
            Created {new Date(invoice.createdAt).toLocaleDateString('en-US')}
            {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString('en-US')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => {
              const res = await fetch(salesInvoiceApi.downloadPdf(invoiceId), {
                credentials: 'include',
                headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
              });
              if (!res.ok) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `invoice-${invoiceId}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary btn-sm text-sm"
          >
            Download PDF
          </button>
          {isShipped ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: '#6d28d9', color: '#ffffff' }}>
              ✓ Shipped {new Date(invoice.shippedAt!).toLocaleDateString('en-US')}
            </span>
          ) : (
            <button
              onClick={() => {
                const isPickup = invoice.carrier === 'Customer Pickup';
                if (!isPickup && !invoice.trackingNumber?.trim()) { window.alert('Please add a tracking number before marking as shipped.'); return; }
                if (!isPickup && !invoice.customer?.email) { window.alert('Customer has no email address — shipping notification cannot be sent.'); return; }
                if (!invoice.carrier) { window.alert('Please select a carrier before marking as shipped.'); return; }
                const confirmMsg = isPickup
                  ? `Mark ${invoice.invoiceNumber} as ready for customer pickup?`
                  : `Mark ${invoice.invoiceNumber} as shipped and notify ${invoice.customer?.email}?`;
                if (window.confirm(confirmMsg)) ship(invoiceId);
              }}
              disabled={isShipping || !invoice.carrier || (!invoice.trackingNumber?.trim() && invoice.carrier !== 'Customer Pickup') || (!invoice.customer?.email && invoice.carrier !== 'Customer Pickup')}
              title={!invoice.carrier ? 'Select a carrier first' : !invoice.trackingNumber?.trim() && invoice.carrier !== 'Customer Pickup' ? 'Add a tracking number first' : !invoice.customer?.email && invoice.carrier !== 'Customer Pickup' ? 'Customer has no email' : undefined}
              className="btn-sm text-sm font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(to bottom,#3b82f6,#2563eb)', color: '#fff', boxShadow: '0 4px 8px rgb(0 0 0 / 0.4)' }}
            >
              {isShipping ? 'Saving…' : invoice.carrier === 'Customer Pickup' ? '🏪 Ready for Pickup' : '🚚 Mark as Shipped'}
            </button>
          )}
          <button
            onClick={() => sendToQueue(invoiceId)}
            className="btn-sm text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'linear-gradient(to bottom,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 4px 8px rgb(0 0 0 / 0.4)' }}
          >
            Send All → Queue
          </button>
          {invoice.status !== 'cancelled' && (
            <button
              onClick={() => sendEmail(invoiceId)}
              disabled={isSending || !invoice.customer?.email}
              title={!invoice.customer?.email ? 'Customer has no email' : undefined}
              className="btn-primary btn-sm text-sm"
            >
              {isSending ? 'Sending…' : 'Send Email'}
            </button>
          )}
        </div>
      </div>

      {/* Customer + Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ff9900' }}>Bill To</span>
            {!editingCustomer
              ? <button onClick={() => { if (confirmIfPaid()) setEditingCustomer(true); }} className="text-xs text-primary-500 hover:text-primary-400">Change</button>
              : <button onClick={() => setEditingCustomer(false)} className="text-xs text-iron-400">Cancel</button>
            }
          </div>
          {editingCustomer ? (
            <select className={selectClass} style={inputSt} defaultValue={invoice.customerId || ''} onChange={(e) => { update(invoiceId, { customerId: e.target.value ? parseInt(e.target.value) : null }); setEditingCustomer(false); }}>
              <option value="">— No customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName ? `${c.contactName} (${c.businessName})` : c.contactName}</option>)}
            </select>
          ) : invoice.customer ? (
            <div className="text-sm space-y-0.5">
              {invoice.customer.businessName && <p className="font-medium text-white">{invoice.customer.businessName}</p>}
              <p className="text-white">{invoice.customer.contactName}</p>
              {invoice.customer.email && <p className="text-white">{invoice.customer.email}</p>}
              {invoice.customer.phone && <p className="text-white">{invoice.customer.phone}</p>}
            </div>
          ) : <p className="text-sm text-white">No customer assigned</p>}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ff9900' }}>Status</span>
            {!editingStatus
              ? <button onClick={() => { if (confirmIfPaid()) setEditingStatus(true); }} className="text-xs text-primary-500 hover:text-primary-400">Change</button>
              : <button onClick={() => setEditingStatus(false)} className="text-xs text-iron-400">Cancel</button>
            }
          </div>
          {editingStatus ? (
            <select className={selectClass} style={inputSt} defaultValue={invoice.status} onChange={(e) => { update(invoiceId, { status: e.target.value as SalesInvoiceStatus }); setEditingStatus(false); }}>
              {(['draft','sent','paid','cancelled'] as SalesInvoiceStatus[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          ) : (
            <div>
              <StatusBadge status={isShipped ? 'shipped' : invoice.status} />
              {invoice.sentAt && <p className="text-xs text-white mt-1">Sent {new Date(invoice.sentAt).toLocaleDateString('en-US')}</p>}
              {invoice.shippedAt && <p className="text-xs mt-1" style={{ color: '#2dd4bf' }}>Shipped {new Date(invoice.shippedAt).toLocaleDateString('en-US')}</p>}
            </div>
          )}

          {/* Carrier + Tracking number */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2d2d2d' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ff9900' }}>Shipping Info</span>
              {!isShipped && !editingTracking && (
                <button
                  onClick={() => { setCarrierDraft(invoice.carrier || ''); setTrackingDraft(invoice.trackingNumber || ''); setEditingTracking(true); }}
                  className="text-xs text-primary-500 hover:text-primary-400"
                >
                  {invoice.carrier || invoice.trackingNumber ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editingTracking ? (
              <div className="space-y-1.5">
                <select
                  value={carrierDraft}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCarrierDraft(val);
                    if (val === 'Customer Pickup') {
                      update(invoiceId, { carrier: val, trackingNumber: null });
                      setEditingTracking(false);
                    }
                  }}
                  className="w-full px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  style={inputSt}
                >
                  <option value="">— Select carrier —</option>
                  <option value="UPS">UPS</option>
                  <option value="USPS">USPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="Customer Pickup">Customer Pickup</option>
                  <option value="Other">Other</option>
                </select>
                {carrierDraft !== 'Customer Pickup' && (
                  <div className="flex items-center gap-1">
                    <input
                      value={trackingDraft}
                      onChange={(e) => setTrackingDraft(e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      style={inputSt}
                      placeholder="Tracking number"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { update(invoiceId, { carrier: carrierDraft.trim() || null, trackingNumber: trackingDraft.trim() || null }); setEditingTracking(false); }
                        if (e.key === 'Escape') setEditingTracking(false);
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => { update(invoiceId, { carrier: carrierDraft.trim() || null, trackingNumber: carrierDraft === 'Customer Pickup' ? null : trackingDraft.trim() || null }); setEditingTracking(false); }} className="text-xs text-primary-400 hover:text-primary-300">✓</button>
                  <button onClick={() => setEditingTracking(false)} className="text-xs text-iron-500 hover:text-iron-300">✕</button>
                </div>
              </div>
            ) : invoice.carrier === 'Customer Pickup' ? (
              <p className="text-sm text-white">Customer Pickup</p>
            ) : invoice.trackingNumber ? (
              <div className="space-y-0.5">
                {invoice.carrier && <p className="text-xs font-semibold" style={{ color: '#ff9900' }}>{invoice.carrier}</p>}
                {(() => {
                  const trackingUrl = (() => {
                    const t = encodeURIComponent(invoice.trackingNumber!);
                    switch (invoice.carrier) {
                      case 'UPS':   return `https://www.ups.com/track?tracknum=${t}`;
                      case 'USPS':  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
                      case 'FedEx': return `https://www.fedex.com/fedex/track/?tracknumbers=${t}`;
                      case 'DHL':   return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
                      default:      return null;
                    }
                  })();
                  return trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono hover:underline" style={{ color: '#2dd4bf' }}>
                      {invoice.trackingNumber}
                    </a>
                  ) : (
                    <p className="text-sm font-mono text-iron-100">{invoice.trackingNumber}</p>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-white">{isShipped ? '—' : 'No tracking info'}</p>
            )}
          </div>
          <div className="mt-3 pt-3 text-xs space-y-0.5" style={{ borderTop: '1px solid #2d2d2d' }}>
            <div className="flex justify-between items-center">
              <span style={{ color: '#ff9900' }}>Tax:</span>
              <div className="flex items-center gap-2">
                <span>{invoice.taxExempt ? 'Exempt' : `${(invoice.taxRate * 100).toFixed(0)}%`}</span>
                <button
                  onClick={() => { if (confirmIfPaid()) update(invoiceId, { taxExempt: !invoice.taxExempt }); }}
                  className="px-1.5 py-0.5 rounded text-xs transition-colors"
                  style={{ background: '#d97706', color: '#ffffff' }}
                >
                  {invoice.taxExempt ? 'Remove exempt' : 'Set exempt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(230,138,0,0.1)', border: '1px solid rgba(230,138,0,0.3)', color: '#ffbc60' }}>
          <span className="font-semibold">Notes: </span>{invoice.notes}
        </div>
      )}

      {/* Line Items Table */}
      <div className="card-surface">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2d2d2d' }}>
          <h3 className="font-semibold" style={{ color: '#ff9900' }}>Line Items</h3>
          <button onClick={() => { if (confirmIfPaid()) setShowAddRow(true); }} className="btn-secondary btn-sm text-xs">+ Add Item</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: '#ff9900' }}>Product</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: '#ff9900' }}>Details</th>
                <th className="text-left px-3 py-2 font-semibold w-16" style={{ color: '#ff9900' }}>Qty</th>
                <th className="text-left px-3 py-2 font-semibold w-24" style={{ color: '#ff9900' }}>Unit Price</th>
                <th className="text-right px-3 py-2 font-semibold w-24" style={{ color: '#ff9900' }}>Subtotal</th>
                <th className="px-3 py-2 w-36" />
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(itemId, data) => { if (confirmIfPaid()) updateLineItem(itemId, data); }}
                  onUpdateColors={(itemId, colors) => { if (confirmIfPaid()) updateLineItemColors(itemId, colors); }}
                  onDelete={(itemId) => { if (confirmIfPaid()) deleteLineItem(itemId); }}
                  onSendToQueue={(itemId) => sendToQueue(invoiceId, [itemId])}
                />
              ))}

              {showAddRow && (
                <>
                  <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
                    {/* Product column: picker + name + SKU — all in one cell */}
                    <td className="px-3 py-3 space-y-1.5">
                      {products.length > 0 && (
                        <select
                          className={selectClass}
                          style={inputSt}
                          value={newItem.productId || ''}
                          onChange={(e) => e.target.value && applyProduct(parseInt(e.target.value))}
                        >
                          <option value="">— pick product —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.unitPrice.toFixed(2)})</option>)}
                        </select>
                      )}
                      <input
                        value={newItem.productName}
                        onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))}
                        className={cellInputClass}
                        style={inputSt}
                        placeholder="Product name"
                        autoFocus={products.length === 0}
                      />
                      {newItem.sku && <span className="block font-mono text-xs text-iron-500">{newItem.sku}</span>}
                      <button
                        type="button"
                        onClick={() => setShowAddColors((v) => !v)}
                        className="btn-primary btn-sm text-xs inline-flex items-center gap-1 mt-1"
                      >
                        {newItemColors.length > 0 && (() => {
                          const primary = newItemColors.find((c) => c.isPrimary);
                          const col = primary ? availableColors.find((c) => c.id === primary.colorId) : null;
                          return col ? <ColorSwatch hex={col.hex} name={col.name} size={10} /> : null;
                        })()}
                        {newItemColors.length > 0 ? `${newItemColors.length} color${newItemColors.length > 1 ? 's' : ''}` : '+ Colors'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <textarea
                        value={newItem.details || ''}
                        onChange={(e) => setNewItem((p) => ({ ...p, details: e.target.value }))}
                        className={cellInputClass}
                        style={inputSt}
                        placeholder="Details"
                        rows={3}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className={`${cellInputClass} w-16`} style={inputSt} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" min={0} step={0.01} value={newItem.unitPrice} onChange={(e) => setNewItem((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} className={`${cellInputClass} w-24`} style={inputSt} />
                    </td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: '#ff9900' }}>
                      ${(newItem.quantity * newItem.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={handleAddItem} className="btn-primary btn-sm text-xs">Add</button>
                        <button onClick={() => { setShowAddRow(false); setNewItemColors([]); setShowAddColors(false); }} className="btn-secondary btn-sm text-xs">Cancel</button>
                      </div>
                    </td>
                  </tr>
                  {showAddColors && (
                    <tr style={{ background: 'rgba(255,153,0,0.03)', borderBottom: '1px solid #2d2d2d' }}>
                      <td colSpan={6} className="px-3 pb-3 pt-1">
                        <div style={{ borderTop: '1px solid #2d2d2d', paddingTop: 8 }}>
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#ff9900' }}>
                            Print Colors — 1 primary + up to 3 more
                          </span>
                          <div className="mt-2">
                            <ColorPicker
                              availableColors={availableColors}
                              selected={newItemColors}
                              onChange={setNewItemColors}
                              maxColors={4}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )}

              {invoice.lineItems.length === 0 && !showAddRow && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-iron-500 text-sm">No line items — click "+ Add Item"</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 text-sm" style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(10,10,10,0.4)' }}>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex justify-between w-64">
              <span style={{ color: '#ff9900' }}>Subtotal</span>
              <span className="font-medium text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center w-64">
              <span style={{ color: '#ff9900' }}>Shipping</span>
              <ShippingEdit
                value={invoice.shippingCost || 0}
                onSave={(v) => { if (confirmIfPaid()) update(invoiceId, { shippingCost: v }); }}
                inputSt={inputSt}
              />
            </div>
            {totalWeightOz > 0 && (
              <div className="flex justify-between w-64">
                <span style={{ color: '#ff9900' }}>Est. Weight</span>
                <span className="text-sm font-medium text-white">
                  {totalWeightOz.toFixed(2)} oz ({totalWeightGrams.toFixed(0)}g)
                </span>
              </div>
            )}
            <div className="flex justify-between w-64">
              <span style={{ color: '#ff9900' }}>{invoice.taxExempt ? 'Tax (exempt)' : `IA Sales Tax (${(invoice.taxRate * 100).toFixed(0)}%)`}</span>
              <span className="font-medium text-white">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2" style={{ borderTop: '1px solid #3a3a3a' }}>
              <span className="font-bold" style={{ color: '#ff9900' }}>Total</span>
              <span className="font-bold text-lg" style={{ color: '#ff9900' }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
