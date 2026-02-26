import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { useCustomers } from '../../hooks/useCustomers';
import type { CreateLineItemDto } from '@wizqueue/shared';

interface LineItemDraft extends CreateLineItemDto {
  _key: number;
}

export const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const { create, isCreating } = useSalesInvoices();
  const { customers } = useCustomers();

  const { register, handleSubmit } = useForm<{
    customerId: string;
    taxRate: string;
    taxExempt: boolean;
    notes: string;
    dueDate: string;
  }>();

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { _key: Date.now(), productName: '', quantity: 1, unitPrice: 0 },
  ]);

  const addRow = () => setLineItems((prev) => [
    ...prev,
    { _key: Date.now(), productName: '', quantity: 1, unitPrice: 0 },
  ]);

  const removeRow = (key: number) => setLineItems((prev) => prev.filter((li) => li._key !== key));

  const updateRow = (key: number, field: keyof CreateLineItemDto, value: string | number) => {
    setLineItems((prev) => prev.map((li) => li._key === key ? { ...li, [field]: value } : li));
  };

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);

  const onSubmit = async (data: { customerId: string; taxRate: string; taxExempt: boolean; notes: string; dueDate: string }) => {
    const validItems = lineItems.filter((li) => li.productName.trim() && li.unitPrice > 0);
    if (validItems.length === 0) {
      alert('Add at least one line item with a name and price');
      return;
    }

    const taxRate = parseFloat(data.taxRate) / 100;

    await create({
      customerId: data.customerId ? parseInt(data.customerId) : undefined,
      taxRate,
      taxExempt: data.taxExempt,
      notes: data.notes || undefined,
      dueDate: data.dueDate || undefined,
      lineItems: validItems.map(({ _key: _, ...rest }) => rest),
    });

    navigate('/invoices');
  };

  const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const inputClass = 'px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-full';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm">
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">New Invoice</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Customer</label>
              <select {...register('customerId')} className={fieldClass}>
                <option value="">— No customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName ? `${c.contactName} (${c.businessName})` : c.contactName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="date" {...register('dueDate')} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                defaultValue={15}
                {...register('taxRate')}
                className={fieldClass}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="taxExempt" {...register('taxExempt')} className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              <label htmlFor="taxExempt" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tax Exempt</label>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea {...register('notes')} rows={2} className={`${fieldClass} resize-none`} placeholder="Payment terms, special instructions, etc." />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Line Items</h3>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
            >
              + Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-1/3">Product</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Details</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-16">Qty</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-28">Unit Price</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 w-24">Subtotal</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lineItems.map((li) => (
                  <tr key={li._key} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                    <td className="px-3 py-2">
                      <input
                        value={li.productName}
                        onChange={(e) => updateRow(li._key, 'productName', e.target.value)}
                        className={inputClass}
                        placeholder="Product name"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={li.details || ''}
                        onChange={(e) => updateRow(li._key, 'details', e.target.value)}
                        className={inputClass}
                        placeholder="Optional details"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={li.quantity}
                        onChange={(e) => updateRow(li._key, 'quantity', parseInt(e.target.value) || 1)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={li.unitPrice}
                        onChange={(e) => updateRow(li._key, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                      ${(li.quantity * li.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(li._key)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-right text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal: </span>
            <span className="font-bold text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};
