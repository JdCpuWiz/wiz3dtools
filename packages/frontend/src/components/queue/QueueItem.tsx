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
  const { delete: deleteItem, updateStatus } = useQueue();

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
    // Auto-delete when status changes to completed
    if (newStatus === 'completed') {
      deleteItem(item.id);
    } else {
      updateStatus({ id: item.id, status: newStatus });
    }
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
                {item.details && (
                  <p className="text-base text-[#d1d5db] mt-2">{item.details}</p>
                )}
                {item.notes && (
                  <p className="text-base text-[#9ca3af] mt-2 italic">
                    Note: {item.notes}
                  </p>
                )}
              </div>

              {/* Quantity Badge */}
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-base font-medium bg-[#2d2d2d] text-[#ff9900] border border-[#3a3a3a]">
                  Qty: {item.quantity}
                </span>
              </div>
            </div>

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
