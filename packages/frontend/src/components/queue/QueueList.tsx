import React, { useMemo, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { useQueue } from '../../hooks/useQueue';
import { queueApi } from '../../services/api';
import { QueueItem } from './QueueItem';
import type { QueueFilter } from '../../App';

interface QueueListProps {
  filter: QueueFilter;
}

export const QueueList: React.FC<QueueListProps> = ({ filter }) => {
  const { items, isLoading, isError, error, reorder, invalidate } = useQueue();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      const active = items.filter(i => i.status !== 'completed' && i.status !== 'cancelled');
      return [...active].sort((a, b) => (a.status === 'printing' ? -1 : b.status === 'printing' ? 1 : 0));
    }
    return items.filter(item => item.status === filter);
  }, [items, filter]);

  // Drop any selected IDs that are no longer in the filtered list
  useEffect(() => {
    const visibleIds = new Set(filteredItems.map(i => i.id));
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredItems.findIndex((item) => item.id === active.id);
    const newIndex = filteredItems.findIndex((item) => item.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorder({ itemId: Number(active.id), newPosition: newIndex });
    }
  };

  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await Promise.all([...selectedIds].map(id => queueApi.updateStatus(id, status)));
      invalidate();
      toast.success(`${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'} set to ${status}`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to update some items');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-base text-white">Loading queue...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-base font-medium">Failed to load queue</p>
          <p className="text-base text-white mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="card text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          {filter === 'all' ? 'Queue is empty' : `No ${filter} items`}
        </h3>
        <p className="text-base text-white">
          {filter === 'all'
            ? 'Upload an invoice to get started, or add items manually.'
            : `There are no items with status "${filter}".`}
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.size === filteredItems.length;

  return (
    <div className="space-y-3">
      {/* Select-all row + bulk action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-white hover:text-white">
          <input
            type="checkbox"
            checked={allSelected && filteredItems.length > 0}
            onChange={handleSelectAll}
            className="h-4 w-4 cursor-pointer accent-[#ff9900]"
          />
          {allSelected ? 'Deselect all' : 'Select all'}
        </label>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[#ff9900] font-medium">{selectedIds.size} selected</span>
            <span className="text-[#4a4a4a]">|</span>
            <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>Set to:</span>
            {(['pending', 'printing', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleBulkStatus(s)}
                disabled={isBulkUpdating}
                className="btn-secondary btn-sm text-xs capitalize"
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[#6b7280] hover:text-[#9ca3af] ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
