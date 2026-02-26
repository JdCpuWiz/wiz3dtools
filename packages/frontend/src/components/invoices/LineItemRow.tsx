import React, { useState } from 'react';
import type { InvoiceLineItem } from '@wizqueue/shared';

interface LineItemRowProps {
  item: InvoiceLineItem;
  onUpdate: (itemId: number, data: Partial<{ productName: string; details: string; quantity: number; unitPrice: number }>) => void;
  onDelete: (itemId: number) => void;
  onSendToQueue?: (itemId: number) => void;
  readOnly?: boolean;
}

export const LineItemRow: React.FC<LineItemRowProps> = ({ item, onUpdate, onDelete, onSendToQueue, readOnly }) => {
  const [editing, setEditing] = useState(false);
  const [productName, setProductName] = useState(item.productName);
  const [details, setDetails] = useState(item.details || '');
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);

  const subtotal = quantity * unitPrice;

  const save = () => {
    onUpdate(item.id, { productName, details: details || undefined, quantity, unitPrice });
    setEditing(false);
  };

  const inputClass = 'px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-full';

  if (editing && !readOnly) {
    return (
      <tr className="bg-primary-50 dark:bg-primary-900/10">
        <td className="px-3 py-2">
          <input value={productName} onChange={(e) => setProductName(e.target.value)} className={inputClass} placeholder="Product name" />
        </td>
        <td className="px-3 py-2">
          <input value={details} onChange={(e) => setDetails(e.target.value)} className={inputClass} placeholder="Details" />
        </td>
        <td className="px-3 py-2">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={`${inputClass} w-16`} />
        </td>
        <td className="px-3 py-2">
          <input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} className={`${inputClass} w-24`} />
        </td>
        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
          ${subtotal.toFixed(2)}
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">Save</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
      <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white font-medium">{item.productName}</td>
      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400">{item.details || '—'}</td>
      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">{item.quantity}</td>
      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">${item.unitPrice.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white text-right">${(item.quantity * item.unitPrice).toFixed(2)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 justify-end">
          {item.queueItemId ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">In queue</span>
          ) : onSendToQueue ? (
            <button
              onClick={() => onSendToQueue(item.id)}
              className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
            >
              → Queue
            </button>
          ) : null}
          {!readOnly && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                ×
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
