import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import { useColors } from '../../hooks/useColors';
import { ColorPicker, ColorSwatch } from '../common/ColorPicker';
import { colorApi } from '../../services/api';
import type { CreateLineItemDto, ItemColorDto } from '@wizqueue/shared';

interface LineItemDraft extends CreateLineItemDto {
  _key: number;
  _colors: ItemColorDto[];
  _showColors: boolean;
  _weightGrams: number;
}

export const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const { create, isCreating } = useSalesInvoices();
  const { customers } = useCustomers();
  const { products } = useProducts(true);
  const { colors: availableColors } = useColors();

  const { register, handleSubmit } = useForm<{
    customerId: string;
    taxRate: string;
    taxExempt: boolean;
    notes: string;
    dueDate: string;
  }>();

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { _key: Date.now(), productName: '', quantity: 1, unitPrice: 0, _colors: [], _showColors: false, _weightGrams: 0 },
  ]);
  const [shippingCost, setShippingCost] = useState(0);

  const addRow = () => setLineItems((prev) => [
    ...prev,
    { _key: Date.now() + Math.random(), productName: '', quantity: 1, unitPrice: 0, _colors: [], _showColors: false, _weightGrams: 0 },
  ]);

  const removeRow = (key: number) => setLineItems((prev) => prev.filter((li) => li._key !== key));

  const updateRow = (key: number, field: keyof CreateLineItemDto, value: string | number | undefined) => {
    setLineItems((prev) => prev.map((li) => li._key === key ? { ...li, [field]: value } : li));
  };

  const updateColors = (key: number, colors: ItemColorDto[]) => {
    setLineItems((prev) => prev.map((li) => li._key === key ? { ...li, _colors: colors } : li));
  };

  const toggleColors = (key: number) => {
    setLineItems((prev) => prev.map((li) => li._key === key ? { ...li, _showColors: !li._showColors } : li));
  };

  const applyProduct = (key: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const autoColors = [...(product.colors || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pc, idx) => ({ colorId: pc.colorId, isPrimary: idx === 0, note: null, sortOrder: idx }));
    setLineItems((prev) => prev.map((li) =>
      li._key === key
        ? { ...li, productId: product.id, productName: product.name, sku: product.sku || undefined, unitPrice: product.unitPrice, details: product.description || li.details, _weightGrams: product.totalWeightGrams || 0, _colors: autoColors }
        : li,
    ));
  };

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const totalWeightGrams = lineItems.reduce((s, li) => s + li._weightGrams * li.quantity, 0);
  const totalWeightOz = totalWeightGrams * 0.035274;

  const onSubmit = async (data: { customerId: string; taxRate: string; taxExempt: boolean; notes: string; dueDate: string }) => {
    const validItems = lineItems.filter((li) => li.productName.trim() && li.unitPrice >= 0);
    if (validItems.length === 0) {
      alert('Add at least one line item with a name');
      return;
    }
    const taxRate = parseFloat(data.taxRate) / 100;
    const invoice = await create({
      customerId: data.customerId ? parseInt(data.customerId) : undefined,
      taxRate,
      taxExempt: data.taxExempt,
      shippingCost,
      notes: data.notes || undefined,
      dueDate: data.dueDate || undefined,
      lineItems: validItems.map(({ _key: _, _colors: _c, _showColors: _s, _weightGrams: _w, ...rest }) => rest),
    });

    // Save colors for each line item that has colors set
    if (invoice && invoice.lineItems) {
      const colorSaves = validItems
        .map((draft, idx) => ({ draft, lineItem: invoice.lineItems[idx] }))
        .filter(({ draft, lineItem }) => lineItem && draft._colors.length > 0);

      await Promise.all(
        colorSaves.map(({ draft, lineItem }) =>
          colorApi.setLineItemColors(invoice.id, lineItem.id, draft._colors),
        ),
      );
    }

    navigate('/invoices');
  };

  const selectClass = 'w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all';
  const inputSt = { background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', border: 'none', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)' };
  const labelClass = 'block text-sm font-medium mb-1 text-primary-400';
  const cellInputClass = 'w-full px-2 py-1.5 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="text-sm text-iron-400 hover:text-iron-50 transition-colors">
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-iron-50">New Invoice</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ color: '#ff9900' }}>Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Customer</label>
              <select {...register('customerId')} className={selectClass} style={inputSt}>
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
              <input type="date" {...register('dueDate')} className="input" />
            </div>
            <div>
              <label className={labelClass}>Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                defaultValue={7}
                {...register('taxRate')}
                className="input"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="taxExempt" {...register('taxExempt')} className="h-4 w-4 rounded accent-primary-500" />
              <label htmlFor="taxExempt" className="text-sm font-medium text-primary-400">Tax Exempt</label>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Payment terms, special instructions, etc." />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card-surface">
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2d2d2d' }}>
            <h3 className="font-semibold" style={{ color: '#ff9900' }}>Line Items</h3>
            <button type="button" onClick={addRow} className="btn-secondary btn-sm text-xs">
              + Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
                  {products.length > 0 && <th className="text-left px-3 py-2 font-semibold w-36" style={{ color: '#ff9900' }}>Product</th>}
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: '#ff9900' }}>Name</th>
                  <th className="text-left px-3 py-2 font-semibold w-24 hidden sm:table-cell" style={{ color: '#ff9900' }}>SKU</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: '#ff9900' }}>Details</th>
                  <th className="text-left px-3 py-2 font-semibold w-16" style={{ color: '#ff9900' }}>Qty</th>
                  <th className="text-left px-3 py-2 font-semibold w-28" style={{ color: '#ff9900' }}>Unit Price</th>
                  <th className="text-right px-3 py-2 font-semibold w-24" style={{ color: '#ff9900' }}>Subtotal</th>
                  <th className="px-3 py-2 w-24 text-left font-semibold" style={{ color: '#ff9900' }}>Colors</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => {
                  const primaryColor = li._colors.find((c) => c.isPrimary);
                  const primaryColorData = primaryColor ? availableColors.find((c) => c.id === primaryColor.colorId) : null;

                  return (
                    <React.Fragment key={li._key}>
                      <tr style={{ borderTop: '1px solid #2d2d2d' }}>
                        {products.length > 0 && (
                          <td className="px-3 py-2">
                            <select
                              className={selectClass}
                              style={inputSt}
                              value={li.productId || ''}
                              onChange={(e) => e.target.value && applyProduct(li._key, parseInt(e.target.value))}
                            >
                              <option value="">— pick —</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <input
                            value={li.productName}
                            onChange={(e) => updateRow(li._key, 'productName', e.target.value)}
                            className={cellInputClass}
                            style={inputSt}
                            placeholder="Name"
                          />
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="font-mono text-xs text-white">{li.sku || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={li.details || ''}
                            onChange={(e) => updateRow(li._key, 'details', e.target.value)}
                            className={cellInputClass}
                            style={inputSt}
                            placeholder="Details"
                            rows={3}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min={1} value={li.quantity}
                            onChange={(e) => updateRow(li._key, 'quantity', parseInt(e.target.value) || 1)}
                            className={cellInputClass}
                            style={inputSt}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min={0} step={0.01} value={li.unitPrice}
                            onChange={(e) => updateRow(li._key, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={cellInputClass}
                            style={inputSt}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium" style={{ color: '#ff9900' }}>
                          ${(li.quantity * li.unitPrice).toFixed(2)}
                        </td>
                        {/* Colors cell */}
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleColors(li._key)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
                            style={
                              li._colors.length > 0
                                ? { background: '#3a1f00', border: '1px solid #b45309', color: '#ff9900' }
                                : { background: '#2d2d2d', border: '1px solid #3a3a3a', color: '#ffffff' }
                            }
                          >
                            {primaryColorData && (
                              <ColorSwatch hex={primaryColorData.hex} name={primaryColorData.name} size={12} />
                            )}
                            {li._colors.length > 0 ? `${li._colors.length} color${li._colors.length > 1 ? 's' : ''}` : '+ Colors'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {lineItems.length > 1 && (
                            <button type="button" onClick={() => removeRow(li._key)} className="text-red-400 hover:text-red-300 font-bold text-lg leading-none">×</button>
                          )}
                        </td>
                      </tr>

                      {/* Color picker expansion row */}
                      {li._showColors && (
                        <tr style={{ background: 'rgba(255,153,0,0.03)', borderBottom: '1px solid #2d2d2d' }}>
                          <td colSpan={products.length > 0 ? 9 : 8} className="px-4 pb-3 pt-2">
                            <div style={{ borderTop: '1px solid #2d2d2d', paddingTop: 8 }}>
                              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#ff9900' }}>
                                Print Colors — 1 primary + up to 3 more
                              </span>
                              <div className="mt-2">
                                <ColorPicker
                                  availableColors={availableColors}
                                  selected={li._colors}
                                  onChange={(colors) => updateColors(li._key, colors)}
                                  maxColors={4}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals panel */}
          <div className="px-6 py-4 text-sm" style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(10,10,10,0.4)' }}>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex justify-between w-64">
                <span style={{ color: '#ff9900' }}>Subtotal</span>
                <span className="font-medium text-white">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center w-64">
                <span style={{ color: '#ff9900' }}>Shipping</span>
                <div className="flex items-center gap-1">
                  <span className="text-white">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-0.5 rounded text-iron-50 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                    style={inputSt}
                  />
                </div>
              </div>
              <div className="flex justify-between w-64">
                <span style={{ color: '#ff9900' }}>IA Sales Tax (7%)</span>
                <span className="font-medium text-white">calculated at save</span>
              </div>
              {totalWeightOz > 0 && (
                <div className="flex justify-between w-64">
                  <span style={{ color: '#ff9900' }}>Est. Weight</span>
                  <span className="font-medium text-white">{totalWeightOz.toFixed(2)} oz ({totalWeightGrams.toFixed(0)}g)</span>
                </div>
              )}
              <div className="flex justify-between w-64 pt-2" style={{ borderTop: '1px solid #3a3a3a' }}>
                <span className="font-bold" style={{ color: '#ff9900' }}>Total</span>
                <span className="font-bold text-lg" style={{ color: '#ff9900' }}>
                  ${(subtotal + shippingCost).toFixed(2)} + tax
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isCreating} className="btn-primary">
            {isCreating ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};
