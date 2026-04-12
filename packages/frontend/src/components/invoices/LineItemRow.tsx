import React, { useState } from 'react';
import type { InvoiceLineItem, ItemColorDto } from '@wizqueue/shared';
import { useColors } from '../../hooks/useColors';
import { useProducts } from '../../hooks/useProducts';
import { ColorPicker, ColorSwatch } from '../common/ColorPicker';

interface LineItemRowProps {
  item: InvoiceLineItem;
  onUpdate: (itemId: number, data: Partial<{ productId: number; productName: string; sku: string; details: string; quantity: number; unitPrice: number }>) => void;
  onUpdateColors?: (itemId: number, colors: ItemColorDto[]) => void;
  onDelete: (itemId: number) => void;
  onSendToQueue?: (itemId: number) => void;
  readOnly?: boolean;
}

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

export const LineItemRow: React.FC<LineItemRowProps> = ({ item, onUpdate, onUpdateColors, onDelete, onSendToQueue, readOnly }) => {
  const { colors: availableColors } = useColors();
  const { products } = useProducts(true);
  const [editing, setEditing] = useState(false);
  const [productId, setProductId] = useState<number | null>(item.productId);
  const [productName, setProductName] = useState(item.productName);
  const [sku, setSku] = useState(item.sku || '');
  const [details, setDetails] = useState(item.details || '');
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);
  const [draftColors, setDraftColors] = useState<ItemColorDto[]>([]);

  const cellInputClass = 'w-full px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500';

  const openEdit = () => {
    setProductId(item.productId);
    setProductName(item.productName);
    setSku(item.sku || '');
    setDetails(item.details || '');
    setQuantity(item.quantity);
    setUnitPrice(item.unitPrice);
    setDraftColors(
      (item.colors || []).map((c) => ({
        colorId: c.colorId,
        isPrimary: c.isPrimary,
        note: c.note,
        sortOrder: c.sortOrder,
      })),
    );
    setEditing(true);
  };

  const applyProduct = (id: number) => {
    const p = products.find((pr) => pr.id === id);
    if (!p) return;
    setProductId(p.id);
    setProductName(p.name);
    setSku(p.sku || '');
    setUnitPrice(p.unitPrice);
    if (p.description) setDetails(p.description);
    const autoColors = [...(p.colors || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pc, idx) => ({ colorId: pc.colorId, isPrimary: idx === 0, note: null, sortOrder: idx }));
    if (autoColors.length > 0) setDraftColors(autoColors);
  };

  const save = () => {
    onUpdate(item.id, { productId: productId ?? undefined, productName, ...(sku ? { sku } : {}), details: details || undefined, quantity, unitPrice });
    if (onUpdateColors) onUpdateColors(item.id, draftColors);
    setEditing(false);
  };

  const colors = item.colors || [];
  const primaryColor = colors.find((c) => c.isPrimary);
  const otherColors = colors.filter((c) => !c.isPrimary);

  if (editing && !readOnly) {
    return (
      <>
        <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
          <td className="px-3 py-2 space-y-1.5">
            {products.length > 0 && (
              <select
                className={cellInputClass}
                style={inputSt}
                value={productId || ''}
                onChange={(e) => e.target.value ? applyProduct(parseInt(e.target.value)) : undefined}
              >
                <option value="">— change product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.unitPrice.toFixed(2)})</option>)}
              </select>
            )}
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className={cellInputClass} style={inputSt} placeholder="Product name" />
            {sku && <span className="block font-mono text-xs text-white">{sku}</span>}
          </td>
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
        {/* Color picker row */}
        <tr style={{ background: 'rgba(230,138,0,0.03)', borderBottom: '1px solid #2d2d2d' }}>
          <td colSpan={6} className="px-3 pb-3 pt-1">
            <div style={{ borderTop: '1px solid #2d2d2d', paddingTop: 8 }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#ff9900' }}>
                Print Colors (1 primary + up to 3 more)
              </span>
              <div className="mt-2">
                <ColorPicker
                  availableColors={availableColors}
                  selected={draftColors}
                  onChange={setDraftColors}
                  maxColors={4}
                />
              </div>
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d' }} className="transition-colors hover:bg-iron-800/20">
      <td className="px-3 py-2.5 text-sm font-medium text-white">
        {item.productName}
        {item.sku && <span className="block font-mono text-xs text-white mt-0.5">{item.sku}</span>}
        {/* Color swatches */}
        {colors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {primaryColor && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: '#3a1f00', border: '1px solid #b45309', color: '#ff9900' }}
                title={`Primary: ${primaryColor.color?.name}${primaryColor.note ? ` — ${primaryColor.note}` : ''}`}
              >
                <ColorSwatch hex={primaryColor.color?.hex || '#888'} name={primaryColor.color?.name || ''} size={10} />
                <span>{primaryColor.color?.name}{primaryColor.note && <span className="opacity-60"> · {primaryColor.note}</span>}</span>
              </span>
            )}
            {otherColors.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: '#2d2d2d', color: '#ffffff', border: '1px solid #3a3a3a' }}
                title={`${c.color?.name}${c.note ? ` — ${c.note}` : ''}`}
              >
                <ColorSwatch hex={c.color?.hex || '#888'} name={c.color?.name || ''} size={10} />
                <span>{c.color?.name}{c.note && <span className="opacity-60"> · {c.note}</span>}</span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-sm text-white">{item.details || '—'}</td>
      <td className="px-3 py-2.5 text-sm text-white">{item.quantity}</td>
      <td className="px-3 py-2.5 text-sm text-white">${item.unitPrice.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-sm font-medium text-right" style={{ color: '#ff9900' }}>
        ${(item.quantity * item.unitPrice).toFixed(2)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 justify-end flex-wrap">
          {item.queueItemId ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#15803d', color: '#ffffff' }}>In queue</span>
          ) : onSendToQueue ? (
            <button onClick={() => onSendToQueue(item.id)} className="btn-sm text-xs px-2 py-1 rounded font-medium transition-all" style={{ background: '#15803d', color: '#ffffff' }}>
              → Queue
            </button>
          ) : null}
          {!readOnly && (
            <>
              <button onClick={openEdit} className="btn-secondary btn-sm text-xs">Edit</button>
              <button onClick={() => onDelete(item.id)} className="btn-danger btn-sm text-xs">×</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
