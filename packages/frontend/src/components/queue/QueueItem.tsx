import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QueueItem as QueueItemType } from '@wizqueue/shared';
import { useQueue } from '../../hooks/useQueue';
import { QueueItemEdit } from './QueueItemEdit';

interface QueueItemProps {
  item: QueueItemType;
}

export const QueueItem: React.FC<QueueItemProps> = ({ item }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [partialQty, setPartialQty] = useState<number | null>(null);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyValue, setQtyValue] = useState(item.quantity);
  const { delete: deleteItem, updateStatus, update } = useQueue();

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
        deleteItem(item.id);
      }
    } else {
      updateStatus({ id: item.id, status: newStatus });
    }
  };

  const handlePartialComplete = () => {
    if (partialQty === null) return;
    if (partialQty >= item.quantity) {
      deleteItem(item.id);
    } else if (partialQty > 0) {
      update({ id: item.id, data: { quantity: item.quantity - partialQty } });
    }
    setPartialQty(null);
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
                  {partialQty >= item.quantity ? 'Complete All' : 'Confirm'}
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

      <QueueItemEdit
        item={item}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
      />
    </>
  );
};
