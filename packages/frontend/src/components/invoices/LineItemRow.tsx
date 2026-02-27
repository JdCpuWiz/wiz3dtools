import React, { useState } from 'react';
import type { InvoiceLineItem } from '@wizqueue/shared';

interface LineItemRowProps {
  item: InvoiceLineItem;
  onUpdate: (itemId: number, data: Partial<{ productName: string; details: string; quantity: number; unitPrice: number }>) => void;
  onDelete: (itemId: number) => void;
  onSendToQueue?: (itemId: number) => void;
  readOnly?: boolean;
}

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

export const LineItemRow: React.FC<LineItemRowProps> = ({ item, onUpdate, onDelete, onSendToQueue, readOnly }) => {
  const [editing, setEditing] = useState(false);
  const [productName, setProductName] = useState(item.productName);
  const [details, setDetails] = useState(item.details || '');
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);

  const cellInputClass = 'w-full px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500';

  const save = () => {
    onUpdate(item.id, { productName, details: details || undefined, quantity, unitPrice });
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
        <td className="px-3 py-2"><input value={productName} onChange={(e) => setProductName(e.target.value)} className={cellInputClass} style={inputSt} /></td>
        <td className="px-3 py-2"><textarea value={details} onChange={(e) => setDetails(e.target.value)} className={cellInputClass} style={inputSt} rows={3} /></td>
        <td className="px-3 py-2"><input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={`${cellInputClass} w-14`} style={inputSt} /></td>
        <td className="px-3 py-2"><input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} className={`${cellInputClass} w-20`} style={inputSt} /></td>
        <td className="px-3 py-2 text-right font-medium" style={{ color: '#ff9900' }}>${(quantity * unitPrice).toFixed(2)}</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="btn-primary btn-sm text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="btn-secondary btn-sm text-xs">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d' }} className="transition-colors hover:bg-iron-800/20">
      <td className="px-3 py-2.5 text-sm font-medium text-iron-50">
        {item.productName}
        {item.sku && <span className="block font-mono text-xs text-iron-500 mt-0.5">{item.sku}</span>}
      </td>
      <td className="px-3 py-2.5 text-sm text-iron-400">{item.details || '—'}</td>
      <td className="px-3 py-2.5 text-sm text-iron-200">{item.quantity}</td>
      <td className="px-3 py-2.5 text-sm text-iron-200">${item.unitPrice.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-sm font-medium text-right" style={{ color: '#ff9900' }}>
        ${(item.quantity * item.unitPrice).toFixed(2)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 justify-end flex-wrap">
          {item.queueItemId ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>In queue</span>
          ) : onSendToQueue ? (
            <button onClick={() => onSendToQueue(item.id)} className="btn-sm text-xs px-2 py-1 rounded font-medium transition-all" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
              → Queue
            </button>
          ) : null}
          {!readOnly && (
            <>
              <button onClick={() => setEditing(true)} className="btn-secondary btn-sm text-xs">Edit</button>
              <button onClick={() => onDelete(item.id)} className="btn-danger btn-sm text-xs">×</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
