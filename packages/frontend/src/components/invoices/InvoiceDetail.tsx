import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSalesInvoice, useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import { LineItemRow } from './LineItemRow';
import { salesInvoiceApi } from '../../services/api';
import type { CreateLineItemDto, SalesInvoiceStatus } from '@wizqueue/shared';
import { useCustomers } from '../../hooks/useCustomers';

export const InvoiceDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || '0');

  const { invoice, isLoading, addLineItem, updateLineItem, deleteLineItem } = useSalesInvoice(invoiceId);
  const { sendEmail, sendToQueue, update, isSending } = useSalesInvoices();
  const { customers } = useCustomers();

  const [showAddRow, setShowAddRow] = useState(false);
  const [newItem, setNewItem] = useState<CreateLineItemDto>({ productName: '', quantity: 1, unitPrice: 0 });
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-16 text-gray-500">Invoice not found</div>;
  }

  const subtotal = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = invoice.taxExempt ? 0 : subtotal * invoice.taxRate;
  const total = subtotal + taxAmount;

  const handleAddItem = async () => {
    if (!newItem.productName.trim() || newItem.unitPrice <= 0) return;
    await addLineItem(newItem);
    setNewItem({ productName: '', quantity: 1, unitPrice: 0 });
    setShowAddRow(false);
  };

  const handleSendToQueue = async (lineItemId?: number) => {
    await sendToQueue(invoiceId, lineItemId ? [lineItemId] : undefined);
  };

  const inputClass = 'px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-full';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm">
          ← Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{invoice.invoiceNumber}</h2>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Created {new Date(invoice.createdAt).toLocaleDateString('en-NZ')}
            {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString('en-NZ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <a
            href={salesInvoiceApi.downloadPdf(invoiceId)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Download PDF
          </a>
          <button
            onClick={() => handleSendToQueue()}
            className="px-3 py-1.5 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
          >
            Send All to Queue
          </button>
          {invoice.status === 'draft' && (
            <button
              onClick={() => sendEmail(invoiceId)}
              disabled={isSending || !invoice.customer?.email}
              title={!invoice.customer?.email ? 'Customer has no email' : undefined}
              className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSending ? 'Sending...' : 'Send Email'}
            </button>
          )}
        </div>
      </div>

      {/* Customer + status info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bill To</span>
            {!editingCustomer ? (
              <button onClick={() => setEditingCustomer(true)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Change</button>
            ) : (
              <button onClick={() => setEditingCustomer(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
            )}
          </div>
          {editingCustomer ? (
            <select
              className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              defaultValue={invoice.customerId || ''}
              onChange={(e) => {
                const val = e.target.value;
                update(invoiceId, { customerId: val ? parseInt(val) : null });
                setEditingCustomer(false);
              }}
            >
              <option value="">— No customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName ? `${c.contactName} (${c.businessName})` : c.contactName}
                </option>
              ))}
            </select>
          ) : invoice.customer ? (
            <div className="text-sm text-gray-800 dark:text-gray-200 space-y-0.5">
              {invoice.customer.businessName && <p className="font-medium">{invoice.customer.businessName}</p>}
              <p>{invoice.customer.contactName}</p>
              {invoice.customer.email && <p className="text-gray-500 dark:text-gray-400">{invoice.customer.email}</p>}
              {invoice.customer.phone && <p className="text-gray-500 dark:text-gray-400">{invoice.customer.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No customer assigned</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</span>
            {!editingStatus ? (
              <button onClick={() => setEditingStatus(true)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Change</button>
            ) : (
              <button onClick={() => setEditingStatus(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
            )}
          </div>
          {editingStatus ? (
            <select
              className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              defaultValue={invoice.status}
              onChange={(e) => {
                update(invoiceId, { status: e.target.value as SalesInvoiceStatus });
                setEditingStatus(false);
              }}
            >
              {(['draft', 'sent', 'paid', 'cancelled'] as SalesInvoiceStatus[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          ) : (
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
              {invoice.sentAt && (
                <p className="text-xs text-gray-500 mt-1">Sent {new Date(invoice.sentAt).toLocaleDateString('en-NZ')}</p>
              )}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Tax Rate:</span>
              <span>{invoice.taxExempt ? 'Exempt' : `${(invoice.taxRate * 100).toFixed(0)}%`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Notes: </span>{invoice.notes}
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Line Items</h3>
          <button
            onClick={() => setShowAddRow(true)}
            className="px-3 py-1.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
          >
            + Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Product</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Details</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-16">Qty</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-24">Unit Price</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-24">Subtotal</th>
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoice.lineItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(itemId, data) => updateLineItem(itemId, data)}
                  onDelete={deleteLineItem}
                  onSendToQueue={(itemId) => handleSendToQueue(itemId)}
                />
              ))}

              {showAddRow && (
                <tr className="bg-primary-50 dark:bg-primary-900/10">
                  <td className="px-3 py-2">
                    <input
                      value={newItem.productName}
                      onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))}
                      className={inputClass}
                      placeholder="Product name"
                      autoFocus
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={newItem.details || ''}
                      onChange={(e) => setNewItem((p) => ({ ...p, details: e.target.value }))}
                      className={inputClass}
                      placeholder="Details"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                      className={`${inputClass} w-16`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                    ${(newItem.quantity * newItem.unitPrice).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={handleAddItem} className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">Add</button>
                      <button onClick={() => setShowAddRow(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">Cancel</button>
                    </div>
                  </td>
                </tr>
              )}

              {invoice.lineItems.length === 0 && !showAddRow && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-sm">
                    No line items yet — click "+ Add Item"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between w-48">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-48">
              <span className="text-gray-600 dark:text-gray-400">
                {invoice.taxExempt ? 'Tax (exempt)' : `GST (${(invoice.taxRate * 100).toFixed(0)}%)`}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-48 pt-2 border-t border-gray-300 dark:border-gray-600 mt-1">
              <span className="font-bold text-gray-900 dark:text-white">Total</span>
              <span className="font-bold text-primary-600 dark:text-primary-400 text-base">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
