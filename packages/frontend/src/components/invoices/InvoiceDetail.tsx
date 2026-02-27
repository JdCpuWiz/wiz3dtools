import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSalesInvoice, useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import { LineItemRow } from './LineItemRow';
import { salesInvoiceApi } from '../../services/api';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import type { CreateLineItemDto, SalesInvoiceStatus } from '@wizqueue/shared';

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

  const { invoice, isLoading, addLineItem, updateLineItem, deleteLineItem } = useSalesInvoice(invoiceId);
  const { sendEmail, sendToQueue, update, isSending } = useSalesInvoices();
  const { customers } = useCustomers();
  const { products } = useProducts(true);

  const [showAddRow, setShowAddRow] = useState(false);
  const [newItem, setNewItem] = useState<CreateLineItemDto>({ productName: '', quantity: 1, unitPrice: 0 });
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }
  if (!invoice) {
    return <div className="text-center py-16 text-iron-400">Invoice not found</div>;
  }

  const subtotal = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = invoice.taxExempt ? 0 : subtotal * invoice.taxRate;
  const total = subtotal + (invoice.shippingCost || 0) + taxAmount;

  const applyProduct = (productId: number) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setNewItem({ productId: p.id, productName: p.name, sku: p.sku || undefined, unitPrice: p.unitPrice, details: p.description || '', quantity: newItem.quantity });
  };

  const handleAddItem = async () => {
    if (!newItem.productName.trim()) return;
    await addLineItem(newItem);
    setNewItem({ productName: '', quantity: 1, unitPrice: 0 });
    setShowAddRow(false);
  };

  const selectClass = 'w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const cellInputClass = 'w-full px-2 py-1.5 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-start gap-4 flex-wrap">
        <button onClick={() => navigate('/invoices')} className="text-sm text-iron-400 hover:text-iron-50 transition-colors pt-1">← Back</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-iron-50">{invoice.invoiceNumber}</h2>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-xs text-iron-400 mt-0.5">
            Created {new Date(invoice.createdAt).toLocaleDateString('en-NZ')}
            {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString('en-NZ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={salesInvoiceApi.downloadPdf(invoiceId)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-sm text-sm"
          >
            Download PDF
          </a>
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
              ? <button onClick={() => setEditingCustomer(true)} className="text-xs text-primary-500 hover:text-primary-400">Change</button>
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
              {invoice.customer.businessName && <p className="font-medium text-iron-50">{invoice.customer.businessName}</p>}
              <p className="text-iron-100">{invoice.customer.contactName}</p>
              {invoice.customer.email && <p className="text-iron-400">{invoice.customer.email}</p>}
              {invoice.customer.phone && <p className="text-iron-400">{invoice.customer.phone}</p>}
            </div>
          ) : <p className="text-sm text-iron-500">No customer assigned</p>}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ff9900' }}>Status</span>
            {!editingStatus
              ? <button onClick={() => setEditingStatus(true)} className="text-xs text-primary-500 hover:text-primary-400">Change</button>
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
              <StatusBadge status={invoice.status} />
              {invoice.sentAt && <p className="text-xs text-iron-400 mt-1">Sent {new Date(invoice.sentAt).toLocaleDateString('en-NZ')}</p>}
            </div>
          )}
          <div className="mt-3 pt-3 text-xs text-iron-400 space-y-0.5" style={{ borderTop: '1px solid #2d2d2d' }}>
            <div className="flex justify-between"><span>Tax:</span><span>{invoice.taxExempt ? 'Exempt' : `${(invoice.taxRate * 100).toFixed(0)}%`}</span></div>
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
          <h3 className="font-semibold text-iron-50">Line Items</h3>
          <button onClick={() => setShowAddRow(true)} className="btn-secondary btn-sm text-xs">+ Add Item</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
                <th className="text-left px-3 py-2 font-semibold text-iron-100">Product</th>
                <th className="text-left px-3 py-2 font-semibold text-iron-100">Details</th>
                <th className="text-left px-3 py-2 font-semibold text-iron-100 w-16">Qty</th>
                <th className="text-left px-3 py-2 font-semibold text-iron-100 w-24">Unit Price</th>
                <th className="text-right px-3 py-2 font-semibold text-iron-100 w-24">Subtotal</th>
                <th className="px-3 py-2 w-36" />
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(itemId, data) => updateLineItem(itemId, data)}
                  onDelete={deleteLineItem}
                  onSendToQueue={(itemId) => sendToQueue(invoiceId, [itemId])}
                />
              ))}

              {showAddRow && (
                <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
                  {products.length > 0 && (
                    <td className="px-3 py-2" colSpan={1}>
                      <select
                        className={selectClass}
                        style={inputSt}
                        value={newItem.productId || ''}
                        onChange={(e) => e.target.value && applyProduct(parseInt(e.target.value))}
                      >
                        <option value="">— pick product —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.unitPrice.toFixed(2)})</option>)}
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-2" colSpan={products.length > 0 ? 1 : 2}>
                    <input value={newItem.productName} onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))} className={cellInputClass} style={inputSt} placeholder="Product name" autoFocus />
                  </td>
                  <td className="px-3 py-2">
                    <input value={newItem.details || ''} onChange={(e) => setNewItem((p) => ({ ...p, details: e.target.value }))} className={cellInputClass} style={inputSt} placeholder="Details" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className={`${cellInputClass} w-14`} style={inputSt} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={0.01} value={newItem.unitPrice} onChange={(e) => setNewItem((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} className={`${cellInputClass} w-20`} style={inputSt} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium" style={{ color: '#ff9900' }}>
                    ${(newItem.quantity * newItem.unitPrice).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={handleAddItem} className="btn-primary btn-sm text-xs">Add</button>
                      <button onClick={() => setShowAddRow(false)} className="btn-secondary btn-sm text-xs">Cancel</button>
                    </div>
                  </td>
                </tr>
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
              <span className="text-iron-400">Subtotal</span>
              <span className="font-medium text-iron-50">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center w-64">
              <span className="text-iron-400">Shipping</span>
              <ShippingEdit
                value={invoice.shippingCost || 0}
                onSave={(v) => update(invoiceId, { shippingCost: v })}
                inputSt={inputSt}
              />
            </div>
            <div className="flex justify-between w-64">
              <span className="text-iron-400">{invoice.taxExempt ? 'Tax (exempt)' : `IA Sales Tax (${(invoice.taxRate * 100).toFixed(0)}%)`}</span>
              <span className="font-medium text-iron-50">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2" style={{ borderTop: '1px solid #3a3a3a' }}>
              <span className="font-bold text-iron-50">Total</span>
              <span className="font-bold text-lg" style={{ color: '#ff9900' }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
