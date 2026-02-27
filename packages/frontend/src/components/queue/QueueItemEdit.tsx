import React from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useQueue } from '../../hooks/useQueue';
import type { QueueItem, UpdateQueueItemDto } from '@wizqueue/shared';

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
  const { update } = useQueue();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateQueueItemDto>({
    defaultValues: {
      productName: item.productName,
      details: item.details || '',
      quantity: item.quantity,
      priority: item.priority,
      notes: item.notes || '',
    },
  });

  const onSubmit = (data: UpdateQueueItemDto) => {
    update(
      { id: item.id, data },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Queue Item">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
