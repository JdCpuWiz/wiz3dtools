import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useQueue } from '../../hooks/useQueue';
import { useColors } from '../../hooks/useColors';
import { usePrinters } from '../../hooks/usePrinters';
import { ColorPicker } from '../common/ColorPicker';
import { colorApi } from '../../services/api';
import type { QueueItem, UpdateQueueItemDto, ItemColorDto } from '@wizqueue/shared';

interface QueueItemEditProps {
  item: QueueItem;
  isOpen: boolean;
  onClose: () => void;
}

export const QueueItemEdit: React.FC<QueueItemEditProps> = ({
  item,
  isOpen,
  onClose,
}) => {
  const { updateAsync, invalidate } = useQueue();
  const { colors: availableColors } = useColors();
  const { printers } = usePrinters();
  const [draftColors, setDraftColors] = useState<ItemColorDto[]>([]);
  const [isInhouse, setIsInhouse] = useState(item.isInhouse ?? false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateQueueItemDto>();

  useEffect(() => {
    reset({
      productName: item.productName,
      details: item.details || '',
      quantity: item.quantity,
      priority: item.priority,
      notes: item.notes || '',
      printerName: item.printerName || '',
    });
    setIsInhouse(item.isInhouse ?? false);
    setDraftColors(
      (item.colors || []).map((c) => ({
        colorId: c.colorId,
        isPrimary: c.isPrimary,
        note: c.note,
        sortOrder: c.sortOrder,
        weightGrams: c.weightGrams ?? 0,
      })),
    );
  }, [item.id]);

  const onSubmit = async (data: UpdateQueueItemDto) => {
    await updateAsync({ id: item.id, data: { ...data, isInhouse } });
    await colorApi.setQueueItemColors(item.id, draftColors);
    invalidate();
    onClose();
  };

  const activePrinters = printers.filter((p) => p.active);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Queue Item">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* In-house toggle */}
        <div>
          <button
            type="button"
            onClick={() => setIsInhouse((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={isInhouse
              ? { background: '#1d4ed8', color: '#ffffff' }
              : { background: '#2d2d2d', color: '#9ca3af' }}
          >
            <span style={{ fontSize: 16 }}>{isInhouse ? '✓' : '○'}</span>
            In-house / Personal Print
          </button>
          {isInhouse && (
            <p className="text-xs text-iron-500 mt-1">
              Filament tracked automatically via Bambu monitor when the job finishes.
            </p>
          )}
        </div>

        <Input
          label="Product Name"
          {...register('productName', { required: 'Product name is required' })}
          error={errors.productName?.message}
        />

        {item.sku && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
            <p className="font-mono text-sm text-iron-400">{item.sku}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Details
          </label>
          <textarea
            {...register('details')}
            rows={3}
            className="input"
            placeholder="Color, size, material, specifications..."
          />
        </div>

        <Input
          label="Quantity"
          type="number"
          min={1}
          {...register('quantity', {
            required: 'Quantity is required',
            min: { value: 1, message: 'Quantity must be at least 1' },
            valueAsNumber: true,
          })}
          error={errors.quantity?.message}
        />

        <Input
          label="Priority"
          type="number"
          min={0}
          {...register('priority', {
            valueAsNumber: true,
          })}
          error={errors.priority?.message}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={2}
            className="input"
            placeholder="Additional notes or instructions..."
          />
        </div>

        {/* Printer assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Printer
          </label>
          <select
            {...register('printerName')}
            className="input"
          >
            <option value="">— unassigned —</option>
            {activePrinters.map((p) => (
              <option key={p.id} value={p.name}>{p.name}{p.model ? ` (${p.model})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Colors */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#ff9900' }}>
            Print Colors
          </label>
          <ColorPicker
            availableColors={availableColors}
            selected={draftColors}
            onChange={setDraftColors}
            maxColors={4}
            showWeight={true}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
