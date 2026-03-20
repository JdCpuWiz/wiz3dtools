import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QueueItem as QueueItemType } from '@wizqueue/shared';
import { useQueue } from '../../hooks/useQueue';
import { useColors } from '../../hooks/useColors';
import { QueueItemEdit } from './QueueItemEdit';
import { ColorSwatch } from '../common/ColorPicker';

interface QueueItemProps {
  item: QueueItemType;
  isSelected?: boolean;
  onSelect?: (id: number, checked: boolean) => void;
}

interface FilamentImpactModalProps {
  item: QueueItemType;
  qty: number;
  colorInventory: Record<number, { inventoryGrams: number; lowThreshold: number; criticalThreshold: number }>;
  onConfirm: () => void;
  onCancel: () => void;
}

function FilamentImpactModal({ item, qty, colorInventory, onConfirm, onCancel }: FilamentImpactModalProps) {
  const colorsWithWeight = (item.colors || []).filter((c) => (c.weightGrams ?? 0) > 0);

  const rows = colorsWithWeight.map((c) => {
    const inv = colorInventory[c.colorId];
    const current = inv?.inventoryGrams ?? 0;
    const usage = (c.weightGrams ?? 0) * qty;
    const after = current - usage;
    const low = inv?.lowThreshold ?? 500;
    const critical = inv?.criticalThreshold ?? 200;
    const afterStatus: 'negative' | 'critical' | 'low' | 'ok' =
      after < 0 ? 'negative' : after <= critical ? 'critical' : after <= low ? 'low' : 'ok';
    return { c, current, usage, after, afterStatus };
  });

  const afterColor = (s: string) => {
    if (s === 'negative') return '#fca5a5';
    if (s === 'critical') return '#fca5a5';
    if (s === 'low') return '#fdba74';
    return '#86efac';
  };

  const afterBg = (s: string) => {
    if (s === 'negative' || s === 'critical') return '#450a0a';
    if (s === 'low') return '#422006';
    return '#14532d';
  };

  const hasWarnings = rows.some((r) => r.afterStatus !== 'ok');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 520, margin: '0 16px', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-iron-50">Complete: {item.productName}</h3>
          <p className="text-sm text-iron-400 mt-0.5">
            Qty: <span className="text-iron-200 font-medium">{qty}</span>
            {qty < item.quantity && <span className="ml-2 text-iron-500">(of {item.quantity} — remainder stays in queue)</span>}
          </p>
        </div>

        {colorsWithWeight.length === 0 ? (
          <p className="text-sm text-iron-400 mb-4">No filament weights recorded for this item — no inventory will be deducted.</p>
        ) : (
          <div className="space-y-0 mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid #2d2d2d' }}>
            {/* Header */}
            <div className="grid text-xs font-semibold text-iron-400 px-3 py-2" style={{ gridTemplateColumns: '1fr 80px 80px 90px', background: '#1a1a1a' }}>
              <span>Color</span>
              <span className="text-right">Current</span>
              <span className="text-right">Usage</span>
              <span className="text-right">After</span>
            </div>
            {rows.map(({ c, current, usage, after, afterStatus }) => (
              <div
                key={c.colorId}
                className="grid items-center px-3 py-2.5 text-sm"
                style={{ gridTemplateColumns: '1fr 80px 80px 90px', borderTop: '1px solid #2d2d2d' }}
              >
                <div className="flex items-center gap-2">
                  <ColorSwatch hex={c.color?.hex || '#888'} name={c.color?.name || ''} size={14} />
                  <span className="text-iron-100 truncate">{c.color?.name ?? `Color #${c.colorId}`}</span>
                </div>
                <span className="text-right text-iron-300">{current.toFixed(0)}g</span>
                <span className="text-right" style={{ color: '#fb923c' }}>−{usage.toFixed(1)}g</span>
                <div className="flex justify-end">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ color: afterColor(afterStatus), background: afterBg(afterStatus) }}
                  >
                    {after.toFixed(0)}g{afterStatus === 'negative' ? ' ⚠' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasWarnings && (
          <p className="text-xs mb-4" style={{ color: '#fca5a5' }}>
            ⚠ One or more filaments will be critically low or depleted after this completion.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-primary">Confirm & Complete</button>
        </div>
      </div>
    </div>
  );
}

export const QueueItem: React.FC<QueueItemProps> = ({ item, isSelected, onSelect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [partialQty, setPartialQty] = useState<number | null>(null);
  const [completingQty, setCompletingQty] = useState<number | null>(null);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyValue, setQtyValue] = useState(item.quantity);
  const { delete: deleteItem, updateStatus, update } = useQueue();
  const { colors } = useColors();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusColors = {
    pending: 'bg-[#2d2d2d] text-[#d1d5db]',
    printing: 'bg-[#ff9900] text-[#0a0a0a]',
    completed: 'bg-[#166534] text-[#86efac]',
    cancelled: 'bg-[#7f1d1d] text-[#fca5a5]',
  };

  // Build inventory map for the modal
  const colorInventory: Record<number, { inventoryGrams: number; lowThreshold: number; criticalThreshold: number }> = {};
  for (const c of colors) {
    colorInventory[c.id] = {
      inventoryGrams: c.inventoryGrams,
      lowThreshold: c.manufacturer?.lowThresholdG ?? 500,
      criticalThreshold: c.manufacturer?.criticalThresholdG ?? 200,
    };
  }

  const hasWeightedColors = (item.colors || []).some((c) => (c.weightGrams ?? 0) > 0);

  const doComplete = (qty: number) => {
    if (qty >= item.quantity) {
      updateStatus({ id: item.id, status: 'completed' });
    } else if (qty > 0) {
      update({ id: item.id, data: { quantity: item.quantity - qty } });
    }
    setCompletingQty(null);
  };

  const requestComplete = (qty: number) => {
    if (hasWeightedColors) {
      setCompletingQty(qty);
    } else {
      doComplete(qty);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItem(item.id);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'completed') {
      if (item.quantity > 1) {
        setPartialQty(item.quantity);
      } else {
        requestComplete(1);
      }
    } else {
      updateStatus({ id: item.id, status: newStatus });
    }
  };

  const handlePartialComplete = () => {
    if (partialQty === null) return;
    const qty = Math.max(1, Math.min(partialQty, item.quantity));
    setPartialQty(null);
    requestComplete(qty);
  };

  const handleQtySave = () => {
    const val = Math.max(1, qtyValue);
    if (val !== item.quantity) {
      update({ id: item.id, data: { quantity: val } });
    }
    setEditingQty(false);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleQtySave();
    if (e.key === 'Escape') { setQtyValue(item.quantity); setEditingQty(false); }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="card hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-4">
          {/* Checkbox (bulk select) */}
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(item.id, e.target.checked)}
              className="mt-1.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-[#ff9900]"
            />
          )}

          {/* Drag Handle */}
          <button
            className="cursor-grab active:cursor-grabbing text-[#6b7280] hover:text-[#d1d5db] pt-1"
            {...attributes}
            {...listeners}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-[#e5e5e5]">
                  {item.productName}
                </h3>
                {item.sku && (
                  <span className="inline-block mt-1 font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#2d2d2d', color: '#9ca3af' }}>{item.sku}</span>
                )}
                {item.details && (
                  <p className="text-base text-[#d1d5db] mt-2">{item.details}</p>
                )}
                {item.notes && (
                  <p className="text-base text-[#9ca3af] mt-2 italic">
                    Note: {item.notes}
                  </p>
                )}

                {/* Color swatches */}
                {(item.colors || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {(item.colors || []).map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        title={`${c.color?.name}${c.note ? ` — ${c.note}` : ''}`}
                        style={
                          c.isPrimary
                            ? { background: '#3a1f00', border: '1px solid #b45309', color: '#ff9900' }
                            : { background: '#2d2d2d', border: '1px solid #3a3a3a', color: '#9ca3af' }
                        }
                      >
                        <ColorSwatch hex={c.color?.hex || '#888'} name={c.color?.name || ''} size={12} />
                        <span>{c.isPrimary ? <strong>{c.color?.name}</strong> : c.color?.name}</span>
                        {c.note && <span style={{ opacity: 0.7 }}> · {c.note}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Badge — click to edit inline */}
              <div className="flex-shrink-0">
                {editingQty ? (
                  <div className="inline-flex items-center gap-1">
                    <span className="text-sm text-[#9ca3af]">Qty:</span>
                    <input
                      type="number"
                      min={1}
                      value={qtyValue}
                      onChange={(e) => setQtyValue(Number(e.target.value))}
                      onBlur={handleQtySave}
                      onKeyDown={handleQtyKeyDown}
                      autoFocus
                      className="w-16 px-2 py-1 rounded text-sm font-medium bg-[#1a1a1a] text-[#ff9900] border border-[#e68a00] text-center focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setQtyValue(item.quantity); setEditingQty(true); }}
                    title="Click to edit quantity"
                    className="inline-flex items-center px-4 py-2 rounded-full text-base font-medium bg-[#2d2d2d] text-[#ff9900] border border-[#3a3a3a] hover:border-[#e68a00] transition-colors cursor-pointer"
                  >
                    Qty: {item.quantity}
                  </button>
                )}
              </div>
            </div>

            {/* Partial complete UI */}
            {partialQty !== null && (
              <div className="mt-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[#d1d5db]">Complete how many?</span>
                <input
                  type="number"
                  min={1}
                  max={item.quantity}
                  value={partialQty}
                  onChange={(e) => setPartialQty(Number(e.target.value))}
                  autoFocus
                  className="w-16 px-2 py-1 rounded text-sm font-medium bg-[#2d2d2d] text-[#ff9900] border border-[#e68a00] text-center focus:outline-none"
                />
                <span className="text-sm text-[#9ca3af]">of {item.quantity}</span>
                <button onClick={handlePartialComplete} className="btn-primary btn-sm">
                  {partialQty >= item.quantity ? 'Complete All' : 'Next →'}
                </button>
                <button onClick={() => setPartialQty(null)} className="btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2d2d2d]">
              <div className="flex items-center gap-3">
                {/* Status Dropdown */}
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`
                    px-4 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer
                    ${statusColors[item.status]}
                  `}
                >
                  <option value="pending">Pending</option>
                  <option value="printing">Printing</option>
                  <option value="completed">Completed</option>
                </select>

                {item.priority > 0 && (
                  <span className="text-sm text-[#ff9900] font-medium">
                    Priority: {item.priority}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary btn-sm"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-danger btn-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <QueueItemEdit
          item={item}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
        />
      )}

      {completingQty !== null && (
        <FilamentImpactModal
          item={item}
          qty={completingQty}
          colorInventory={colorInventory}
          onConfirm={() => doComplete(completingQty)}
          onCancel={() => setCompletingQty(null)}
        />
      )}
    </>
  );
};
